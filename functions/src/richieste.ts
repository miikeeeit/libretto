// Creare una richiesta di conferma (L5) e leggerla dalla pagina del responsabile (C1).

import { randomBytes } from 'node:crypto';
import { FieldValue } from 'firebase-admin/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import {
  adesso,
  controllaSospensione,
  db,
  fraGiorni,
  GIORNI_SCADENZA,
  mascheraTelefono,
  MAX_RICHIESTE_APERTE,
  periodiSiSovrappongono,
  telefonoValido,
  testoRichiesto,
} from './comune';

/** 32 caratteri casuali, che sono anche l'id del documento (§6). */
function generaToken(): string {
  return randomBytes(24).toString('base64url');
}

/**
 * §8.2, seconda parte: non si può indicare come responsabile un numero che risulta
 * lavoratore nella stessa struttura e nello stesso periodo. È la frode più comoda —
 * due colleghi che si confermano a vicenda la stagione — e questo la rende scomoda.
 */
async function colleghiNonSiConfermano(
  telefonoResponsabile: string,
  workerUid: string,
  strutturaId: string,
  periodo: { dal: string; al: string },
): Promise<void> {
  const conQuelNumero = await db.collection('workers').where('telefono', '==', telefonoResponsabile).get();

  for (const altro of conQuelNumero.docs) {
    if (altro.id === workerUid) continue;
    const sueStagioni = await altro.ref.collection('stagioni').where('strutturaId', '==', strutturaId).get();
    const insieme = sueStagioni.docs.some((s) => {
      const dati = s.data() as { dal: string; al: string };
      return periodiSiSovrappongono(dati, periodo);
    });
    if (insieme) {
      throw new HttpsError(
        'failed-precondition',
        'Questo numero risulta di un collega che ha lavorato lì nello stesso periodo. La conferma deve arrivare da chi ti ha visto lavorare, non da chi lavorava con te.',
      );
    }
  }
}

export const creaRichiesta = onCall(async (richiesta) => {
  const workerUid = richiesta.auth?.uid;
  if (!workerUid) throw new HttpsError('unauthenticated', 'Devi essere collegato.');

  const stagioneId = testoRichiesto(richiesta.data?.stagioneId, 200, 'la stagione');
  const nomeResponsabile = testoRichiesto(richiesta.data?.nomeResponsabile, 80, 'il nome del responsabile');
  const telefonoResponsabile = richiesta.data?.telefonoResponsabile;

  if (!telefonoValido(telefonoResponsabile)) {
    throw new HttpsError('invalid-argument', 'Il numero del responsabile non è valido.');
  }

  await controllaSospensione(workerUid);

  const workerSnap = await db.doc(`workers/${workerUid}`).get();
  if (!workerSnap.exists) throw new HttpsError('failed-precondition', 'Prima crea il tuo libretto.');
  const worker = workerSnap.data() as { telefono: string; nome: string; cognome: string };

  // §8.2, prima parte: non si conferma da soli.
  if (telefonoResponsabile === worker.telefono) {
    throw new HttpsError('failed-precondition', 'Non puoi confermarti una stagione da solo.');
  }

  const stagioneRef = db.doc(`workers/${workerUid}/stagioni/${stagioneId}`);
  const stagioneSnap = await stagioneRef.get();
  if (!stagioneSnap.exists) throw new HttpsError('not-found', 'Questa stagione non c’è più.');
  const stagione = stagioneSnap.data() as {
    stato: string;
    strutturaId: string;
    strutturaNome: string;
    strutturaComune: string;
    ruolo: string;
    dal: string;
    al: string;
    competenzeDichiarate: string[];
    richiestaId: string | null;
  };

  if (stagione.stato === 'confermata') {
    throw new HttpsError('failed-precondition', 'Questa stagione è già confermata.');
  }

  await colleghiNonSiConfermano(telefonoResponsabile, workerUid, stagione.strutturaId, stagione);

  // §8.4: non più di cinque richieste aperte per volta. Quella che si sta rimandando
  // non si conta, perché sta per essere revocata.
  const aperte = await db
    .collection('richieste')
    .where('workerUid', '==', workerUid)
    .where('stato', '==', 'aperta')
    .get();
  const altreAperte = aperte.docs.filter((d) => d.id !== stagione.richiestaId).length;
  if (altreAperte >= MAX_RICHIESTE_APERTE) {
    throw new HttpsError(
      'resource-exhausted',
      `Hai già ${MAX_RICHIESTE_APERTE} richieste in attesa. Aspetta una risposta prima di mandarne altre.`,
    );
  }

  const token = generaToken();
  const lotto = db.batch();

  // Rimandare una richiesta uccide quella di prima: il link vecchio non deve più
  // funzionare, altrimenti resterebbero in giro due link per la stessa stagione.
  // Si controlla che esista ancora: dopo 90 giorni la pulizia l'ha cancellata (§9), e
  // una `update` su un documento che non c'è più faceva fallire ogni tentativo di
  // rimandare, per sempre.
  if (stagione.richiestaId && (await db.doc(`richieste/${stagione.richiestaId}`).get()).exists) {
    lotto.update(db.doc(`richieste/${stagione.richiestaId}`), { stato: 'revocata' });
  }

  lotto.set(db.doc(`richieste/${token}`), {
    workerUid,
    stagioneId,
    nomeResponsabile,
    telefonoResponsabile,
    stato: 'aperta',
    // Cosa si sta chiedendo, congelato adesso. È quello che il responsabile vedrà, ed è
    // il paragone con cui la conferma verrà accettata o rifiutata: senza, chi ha mandato
    // il link può cambiare struttura e periodo dopo averlo mandato, e nessuno — né il
    // responsabile né il server — ha modo di accorgersene.
    stagioneAlMomento: {
      strutturaId: stagione.strutturaId,
      strutturaNome: stagione.strutturaNome,
      strutturaComune: stagione.strutturaComune,
      ruolo: stagione.ruolo,
      dal: stagione.dal,
      al: stagione.al,
      competenzeDichiarate: stagione.competenzeDichiarate ?? [],
    },
    createdAt: adesso(),
    scadeIl: fraGiorni(GIORNI_SCADENZA),
  });

  lotto.update(stagioneRef, {
    stato: 'in_attesa',
    richiestaId: token,
    updatedAt: FieldValue.serverTimestamp(),
  });

  await lotto.commit();

  // Il link lo compone il client con il proprio indirizzo: così funziona uguale in
  // locale, in prova e online, senza configurare niente da nessuna parte.
  return { token, scadeFraGiorni: GIORNI_SCADENZA };
});

/**
 * C1 · Quello che vede chi apre il link, senza essere collegato.
 * Restituisce solo le quattro righe della specifica e il numero mascherato: mai il
 * telefono del responsabile per intero, mai quello del lavoratore, mai il suo uid.
 */
export const leggiRichiesta = onCall(async (richiesta) => {
  const token = testoRichiesto(richiesta.data?.token, 64, 'il link');

  const snap = await db.doc(`richieste/${token}`).get();
  if (!snap.exists) return { stato: 'inesistente' as const, numeroCoincide: false };

  const dati = snap.data() as {
    workerUid: string;
    stagioneId: string;
    telefonoResponsabile: string;
    stato: string;
    scadeIl: { toMillis(): number };
    stagioneAlMomento?: {
      strutturaNome: string;
      strutturaComune: string;
      ruolo: string;
      dal: string;
      al: string;
      competenzeDichiarate: string[];
    };
  };

  // Se chi chiama ha già verificato un numero, si dice subito se è quello giusto: così
  // chi ha sbagliato numero lo scopre prima di riempire il modulo, non dopo (PC2).
  // Non si restituisce mai il numero, solo se coincide.
  const telefonoChiamante = richiesta.auth?.token?.phone_number;
  const numeroCoincide = telefonoChiamante === dati.telefonoResponsabile;

  const scaduta = dati.scadeIl.toMillis() < Date.now();
  const stato = dati.stato === 'aperta' && scaduta ? 'scaduta' : dati.stato;

  // Su un link non più valido non si dice niente di nessuno: solo perché non va.
  if (stato !== 'aperta') return { stato, numeroCoincide };

  // Senza la foto di cosa è stato chiesto non si può mostrare niente con onestà.
  if (!dati.stagioneAlMomento) return { stato: 'revocata' as const, numeroCoincide };

  const [workerSnap, stagioneSnap] = await Promise.all([
    db.doc(`workers/${dati.workerUid}`).get(),
    db.doc(`workers/${dati.workerUid}/stagioni/${dati.stagioneId}`).get(),
  ]);

  if (!workerSnap.exists || !stagioneSnap.exists) {
    return { stato: 'inesistente' as const, numeroCoincide };
  }

  const worker = workerSnap.data() as { nome: string; cognome: string };
  const stagione = stagioneSnap.data() as {
    strutturaNome: string;
    strutturaComune: string;
    ruolo: string;
    dal: string;
    al: string;
    competenzeDichiarate: string[];
    stato: string;
    richiestaId: string | null;
  };

  // Se la stagione è stata toccata dopo l'invio, il link non vale più: il responsabile
  // confermerebbe una cosa diversa da quella per cui gli è arrivata la richiesta. Lo
  // dice già qui, invece di farglielo scoprire dopo aver verificato il numero.
  if (stagione.richiestaId !== token || stagione.stato !== 'in_attesa') {
    return { stato: 'revocata' as const, numeroCoincide };
  }

  // Le quattro righe vengono dalla foto del momento dell'invio, non dallo stato
  // attuale: il responsabile deve leggere esattamente quello che gli è stato chiesto
  // nel messaggio WhatsApp.
  const chiesto = dati.stagioneAlMomento;

  return {
    stato: 'aperta' as const,
    numeroCoincide,
    nomeLavoratore: `${worker.nome} ${worker.cognome}`,
    nomeDiBattesimo: worker.nome,
    struttura: chiesto.strutturaNome,
    comune: chiesto.strutturaComune,
    ruolo: chiesto.ruolo,
    dal: chiesto.dal,
    al: chiesto.al,
    competenzeDichiarate: chiesto.competenzeDichiarate,
    telefonoMascherato: mascheraTelefono(dati.telefonoResponsabile),
  };
});
