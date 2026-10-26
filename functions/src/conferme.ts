// La conferma del responsabile (C3), la segnalazione (C3) e la revoca (C4).
//
// Qui sta il cuore della §1: «una conferma vale solo se arriva da un telefono verificato
// con codice SMS, e quel telefono deve essere lo stesso numero indicato dal lavoratore».
// Tutti i controlli che lo garantiscono sono in questo file, e nessuno di essi è
// ripetibile o aggirabile dal client, che su `richieste` e `conferme` non ha accesso.

import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import {
  adesso,
  db,
  fraGiorni,
  GIORNI_REVOCA,
  MAX_CONFERME_AL_GIORNO,
  RUOLI_RESPONSABILE,
  telefonoDiChiChiama,
  testoRichiesto,
  VERSIONE_CONSENSO,
} from './comune';
import { ricostruisciProfiloPubblico } from './profilo';
import { aggiornaResponsabileNoto, ricontrollaResponsabileNoto } from './responsabiliNoti';

type Richiesta = {
  workerUid: string;
  stagioneId: string;
  telefonoResponsabile: string;
  stato: string;
  scadeIl: Timestamp;
  /** Cosa è stato chiesto, congelato al momento dell'invio del link. */
  stagioneAlMomento?: {
    strutturaId: string;
    strutturaNome: string;
    strutturaComune: string;
    ruolo: string;
    dal: string;
    al: string;
    competenzeDichiarate: string[];
  };
};

type Stagione = {
  strutturaId: string;
  strutturaNome: string;
  strutturaComune: string;
  ruolo: string;
  dal: string;
  al: string;
  competenzeDichiarate: string[];
  stato: string;
  richiestaId: string | null;
};

/**
 * Trova la richiesta e controlla tutto quello che deve essere vero perché questa
 * persona, da questo telefono, possa toccare questa stagione.
 */
async function richiestaPerChiamante(token: string, telefono: string, statoAtteso: string) {
  const ref = db.doc(`richieste/${token}`);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError('not-found', 'Questo link non è valido.');

  const richiesta = snap.data() as Richiesta;

  // PC2: il telefono verificato deve essere quello a cui la richiesta è stata mandata.
  // Un link inoltrato a un'altra persona non funziona, ed è questo che rende vera ogni
  // conferma che si vede su Libretto.
  if (richiesta.telefonoResponsabile !== telefono) {
    throw new HttpsError('permission-denied', 'Questo link è stato inviato a un altro numero.');
  }

  if (richiesta.stato !== statoAtteso) {
    throw new HttpsError('failed-precondition', frasePerStato(richiesta.stato, statoAtteso));
  }

  return { ref, richiesta };
}

/**
 * La frase da mostrare quando il link non è nello stato giusto. Prima arrivava sullo
 * schermo del responsabile così com'era scritta per noi: «stato:usata».
 */
function frasePerStato(stato: string, statoAtteso: string): string {
  if (statoAtteso === 'usata') {
    if (stato === 'revocata') return 'Questa conferma è già stata revocata.';
    return 'Su questo link non c’è una conferma da revocare.';
  }
  if (stato === 'usata') return 'Questa conferma è già stata data.';
  if (stato === 'scaduta') return 'Questo link è scaduto.';
  return 'Questo link non è più valido.';
}

/**
 * Chiude un link scaduto e riporta la stagione al lavoratore come «scaduta», così può
 * rimandarla da L3.
 *
 * Senza l'aggiornamento della stagione restava «in attesa» per sempre: la richiesta era
 * già chiusa qui, e la pulizia notturna — che cerca solo le richieste ancora aperte —
 * non la guardava più. Il lavoratore avrebbe aspettato una risposta che non poteva più
 * arrivare, senza nemmeno il pulsante per rimandare.
 */
async function chiudiPerScadenza(
  richiestaRef: ReturnType<typeof db.doc>,
  richiesta: Richiesta,
  token: string,
): Promise<void> {
  const stagioneRef = db.doc(`workers/${richiesta.workerUid}/stagioni/${richiesta.stagioneId}`);
  const stagione = await stagioneRef.get();

  const lotto = db.batch();
  lotto.update(richiestaRef, { stato: 'scaduta' });
  if (stagione.exists && stagione.data()?.richiestaId === token) {
    lotto.update(stagioneRef, { stato: 'scaduta', updatedAt: FieldValue.serverTimestamp() });
  }
  await lotto.commit();
}

export const confermaStagione = onCall(async (chiamata) => {
  const telefono = telefonoDiChiChiama(chiamata.auth);
  const responsabileUid = chiamata.auth!.uid;
  const token = testoRichiesto(chiamata.data?.token, 64, 'il link');

  const ruoloResponsabile = testoRichiesto(chiamata.data?.ruoloResponsabile, 40, 'il tuo ruolo');
  if (!RUOLI_RESPONSABILE.includes(ruoloResponsabile)) {
    throw new HttpsError('invalid-argument', 'Questo ruolo non è fra quelli previsti.');
  }

  if (chiamata.data?.consenso !== true) {
    throw new HttpsError('invalid-argument', 'Serve il consenso per pubblicare la conferma.');
  }

  const riprenderebbe = chiamata.data?.riprenderebbe === true;
  const competenzeRichieste: unknown = chiamata.data?.competenzeConfermate ?? [];
  if (!Array.isArray(competenzeRichieste) || competenzeRichieste.some((c) => typeof c !== 'string')) {
    throw new HttpsError('invalid-argument', 'Le competenze non sono nel formato giusto.');
  }

  const { ref: richiestaRef, richiesta } = await richiestaPerChiamante(token, telefono, 'aperta');

  // §8.5: un libretto sospeso non riceve conferme finché Mike non lo guarda. La
  // sospensione fermava le richieste nuove, ma i link già partiti si potevano ancora
  // confermare, e quelle conferme sarebbero comparse tutte insieme alla riapertura.
  if ((await db.doc(`sospensioni/${richiesta.workerUid}`).get()).exists) {
    throw new HttpsError(
      'failed-precondition',
      'Questo libretto è in revisione: per ora non si possono aggiungere conferme.',
    );
  }

  if (richiesta.scadeIl.toMillis() < Date.now()) {
    await chiudiPerScadenza(richiestaRef, richiesta, token);
    throw new HttpsError('failed-precondition', 'Questo link è scaduto.');
  }

  const stagioneRef = db.doc(`workers/${richiesta.workerUid}/stagioni/${richiesta.stagioneId}`);
  const [stagioneSnap, workerSnap] = await Promise.all([
    stagioneRef.get(),
    db.doc(`workers/${richiesta.workerUid}`).get(),
  ]);
  if (!stagioneSnap.exists || !workerSnap.exists) {
    throw new HttpsError('not-found', 'Questa stagione non c’è più.');
  }

  const stagione = stagioneSnap.data() as Stagione;
  const worker = workerSnap.data() as { telefono: string; nome: string };

  // Tre controlli, e servono tutti tre.
  //
  // Il token dice «questa stagione aspetta proprio questo link». Lo stato dice «e lo
  // sta ancora aspettando»: correggere una stagione la riporta in bozza, e da lì una
  // conferma non si dà più. Il confronto con la foto del momento dell'invio è quello
  // che tiene se i primi due vengono aggirati: senza, si poteva mandare il link per il
  // Bar Somma, cambiare struttura e periodo lasciando stato e token intatti, e farsi
  // confermare dal titolare del Bar Somma un posto dove non aveva visto nessuno. Anche
  // nome e comune: sono quello che il responsabile ha letto nel messaggio e quello che la
  // pagina pubblica mostra come confermato.
  const chiesto = richiesta.stagioneAlMomento;
  const uguale =
    chiesto !== undefined &&
    chiesto.strutturaId === stagione.strutturaId &&
    chiesto.strutturaNome === stagione.strutturaNome &&
    chiesto.strutturaComune === stagione.strutturaComune &&
    chiesto.ruolo === stagione.ruolo &&
    chiesto.dal === stagione.dal &&
    chiesto.al === stagione.al;

  if (stagione.richiestaId !== token || stagione.stato !== 'in_attesa' || !uguale) {
    throw new HttpsError('failed-precondition', 'Questo link non è più valido: la stagione è stata modificata.');
  }

  // §8.2: lo stesso telefono non può essere lavoratore e responsabile della stessa cosa.
  if (worker.telefono === telefono) {
    throw new HttpsError('permission-denied', 'Non si può confermare una stagione a sé stessi.');
  }

  // Si può confermare solo ciò che il lavoratore ha dichiarato **e** che era nel
  // messaggio: il responsabile toglie, non aggiunge, e non gli si può far confermare una
  // competenza aggiunta dopo che aveva aperto il link.
  const dichiarate = new Set(
    (chiesto.competenzeDichiarate ?? []).filter((c) => (stagione.competenzeDichiarate ?? []).includes(c)),
  );
  const competenzeConfermate = (competenzeRichieste as string[]).filter((c) => dichiarate.has(c));

  // §8.4: dieci conferme in ventiquattr'ore per numero. Chi ne fa di più non è un
  // titolare che si ricorda i suoi stagionali.
  //
  // Si contano le richieste che questo numero ha usato per confermare, non le conferme del
  // suo uid. L'uid è l'accesso, e un accesso si cancella e si rifà con lo stesso numero:
  // uid nuovo, conteggio a zero, altre dieci conferme. Le richieste invece restano anche
  // se il responsabile cancella l'account, e una revoca ne cambia lo stato ma non
  // `usataIl`: revocare e riconfermare non azzera il tetto.
  const recentiDelNumero = db
    .collection('richieste')
    .where('telefonoResponsabile', '==', telefono)
    .where('usataIl', '>=', Timestamp.fromMillis(Date.now() - 24 * 60 * 60 * 1000));
  const troppeConferme = () =>
    new HttpsError('resource-exhausted', 'Hai confermato molte stagioni nelle ultime ore. Riprova domani.');
  const recenti = await recentiDelNumero.count().get();
  if (recenti.data().count >= MAX_CONFERME_AL_GIORNO) throw troppeConferme();

  const confermaRef = db.collection('conferme').doc();
  const revocabileFinoA = fraGiorni(GIORNI_REVOCA);
  const strutturaRef = db.doc(`strutture/${stagione.strutturaId}`);
  // Un documento per numero, che ogni conferma legge e scrive. Il numero comincia con «+»,
  // un uid no: non si scontra con `limiti/{uid}` dei lavoratori (`creaRichiesta`).
  const limiteRef = db.doc(`limiti/${telefono}`);

  await db.runTransaction(async (tx) => {
    // Si rilegge dentro la transazione: se qualcuno ha confermato un istante prima,
    // il secondo tentativo si fermi qui e non scriva una seconda conferma.
    //
    // Anche il tetto della §8.4: il conteggio di sopra è fuori dalla transazione, e
    // quattro conferme partite insieme lo leggevano tutte uguale e passavano tutte.
    // `limiti/{telefono}` si legge qui perché ogni conferma lo scrive: così le conferme
    // dello stesso numero si mettono in fila, e chi arriva dopo riconta le richieste. Per
    // numero e non per uid (prima era `responsabili/{uid}`): due accessi con lo stesso
    // numero — il gettone di un account appena cancellato vale ancora fino a un'ora — non
    // si sarebbero messi in fila.
    const [controllo, stagioneOra, strutturaSnap, , recentiOra] = await Promise.all([
      tx.get(richiestaRef),
      tx.get(stagioneRef),
      tx.get(strutturaRef),
      tx.get(limiteRef),
      tx.get(recentiDelNumero.limit(MAX_CONFERME_AL_GIORNO)),
    ]);
    if (controllo.data()?.stato !== 'aperta') {
      throw new HttpsError('failed-precondition', 'Questa conferma è già stata registrata.');
    }
    if (recentiOra.size >= MAX_CONFERME_AL_GIORNO) throw troppeConferme();
    // E anche la stagione: i controlli di sopra la leggono fuori dalla transazione, e
    // se il lavoratore la correggeva proprio in quel momento la conferma finiva su una
    // stagione già diversa da quella del link.
    const ora = stagioneOra.data() as Stagione | undefined;
    if (
      !ora ||
      ora.richiestaId !== token ||
      ora.stato !== 'in_attesa' ||
      ora.strutturaId !== stagione.strutturaId ||
      ora.strutturaNome !== stagione.strutturaNome ||
      ora.strutturaComune !== stagione.strutturaComune ||
      ora.ruolo !== stagione.ruolo ||
      ora.dal !== stagione.dal ||
      ora.al !== stagione.al
    ) {
      throw new HttpsError('failed-precondition', 'Questo link non è più valido: la stagione è stata modificata.');
    }
    const strutturaEsiste = strutturaSnap.exists;

    tx.set(confermaRef, {
      workerUid: richiesta.workerUid,
      stagioneId: richiesta.stagioneId,
      strutturaId: stagione.strutturaId,
      responsabileUid,
      richiestaId: token,
      competenzeConfermate,
      riprenderebbe,
      ruoloResponsabile,
      consenso: { versione: VERSIONE_CONSENSO, ts: adesso() },
      revocabileFinoA,
      createdAt: adesso(),
    });

    tx.update(stagioneRef, {
      stato: 'confermata',
      competenzeConfermate,
      riprenderebbe,
      ruoloResponsabile,
      updatedAt: FieldValue.serverTimestamp(),
    });

    // `usataIl` è quello che conta il tetto della §8.4. Solo qui: una segnalazione usa
    // il link, ma non è una conferma.
    tx.update(richiestaRef, { stato: 'usata', usataIl: adesso() });
    tx.set(limiteRef, { ultimaConferma: adesso() });

    // Del responsabile si salva solo il telefono e dove ha confermato (§9).
    // `verificatoAdmin` non si scrive qui di proposito: Mike lo mette a mano per i
    // responsabili che conosce (PC4), e un merge con `false` gliel'avrebbe cancellato
    // a ogni conferma successiva.
    tx.set(
      db.doc(`responsabili/${responsabileUid}`),
      {
        telefono,
        strutture: FieldValue.arrayUnion(stagione.strutturaId),
        nConferme: FieldValue.increment(1),
        updatedAt: adesso(),
      },
      { merge: true },
    );

    if (strutturaEsiste) {
      tx.update(strutturaRef, { nConferme: FieldValue.increment(1) });
    }
  });

  await aggiornaResponsabileNoto(responsabileUid, telefono, stagione.strutturaId);

  return {
    nomeLavoratore: worker.nome,
    competenzeConfermate,
    revocabileFinoA: revocabileFinoA.toMillis(),
  };
});

/**
 * C3 · «Non corrisponde al vero».
 * Non è un giudizio e non diventa un giudizio (PC2.3): è un fatto, e serve solo a
 * togliere dal libretto una stagione che non c'è stata. Solo «non ha mai lavorato qui»
 * arriva all'admin.
 */
export const segnalaStagione = onCall(async (chiamata) => {
  const telefono = telefonoDiChiChiama(chiamata.auth);
  const token = testoRichiesto(chiamata.data?.token, 64, 'il link');
  const motivo = testoRichiesto(chiamata.data?.motivo, 30, 'il motivo');

  if (motivo !== 'mai_lavorato' && motivo !== 'dati_sbagliati') {
    throw new HttpsError('invalid-argument', 'Motivo non previsto.');
  }

  const { ref: richiestaRef, richiesta } = await richiestaPerChiamante(token, telefono, 'aperta');
  const stagioneRef = db.doc(`workers/${richiesta.workerUid}/stagioni/${richiesta.stagioneId}`);

  // In transazione, non in lotto, come la conferma e la revoca: tre «mai lavorato qui»
  // mandati insieme dallo stesso link (doppio tap, rete che va e viene) leggevano tutti
  // la richiesta ancora aperta e scrivevano tre segnalazioni, cioè la sospensione del
  // libretto (§8.5) da un link solo. Rileggendo la richiesta qui dentro, dal secondo in
  // poi si fermano.
  await db.runTransaction(async (tx) => {
    const [controllo, stagioneSnap] = await Promise.all([tx.get(richiestaRef), tx.get(stagioneRef)]);
    const statoOra = (controllo.data()?.stato as string | undefined) ?? '';
    if (statoOra !== 'aperta') {
      throw new HttpsError('failed-precondition', frasePerStato(statoOra, 'aperta'));
    }
    const stagione = stagioneSnap.data() as Stagione | undefined;

    // Gli stessi due controlli della conferma, che qui mancavano: con un link vecchio
    // ancora aperto si poteva far diventare «non confermata» una stagione che aspettava
    // un altro responsabile, e appioppare al lavoratore una segnalazione delle due che
    // sospendono il libretto.
    const chiesto = richiesta.stagioneAlMomento;
    const cambiata =
      stagione !== undefined &&
      (stagione.richiestaId !== token ||
        stagione.stato !== 'in_attesa' ||
        chiesto === undefined ||
        chiesto.strutturaId !== stagione.strutturaId ||
        chiesto.strutturaNome !== stagione.strutturaNome ||
        chiesto.strutturaComune !== stagione.strutturaComune ||
        chiesto.ruolo !== stagione.ruolo ||
        chiesto.dal !== stagione.dal ||
        chiesto.al !== stagione.al);
    if (cambiata) {
      throw new HttpsError('failed-precondition', 'Questo link non è più valido.');
    }

    // Se il lavoratore ha cancellato la stagione nel frattempo, la segnalazione si scrive
    // comunque: altrimenti bastava cancellarla per scansare la segnalazione, e l'intera
    // commit saltava per una `update` su un documento che non c'è più.
    if (stagioneSnap.exists) {
      tx.update(stagioneRef, {
        stato: 'non_confermata',
        richiestaId: null,
        updatedAt: FieldValue.serverTimestamp(),
      });
    }
    tx.update(richiestaRef, { stato: 'usata' });

    if (motivo === 'mai_lavorato') {
      tx.set(db.collection('segnalazioni').doc(), {
        tipo: motivo,
        richiestaId: token,
        workerUid: richiesta.workerUid,
        createdAt: adesso(),
        gestita: false,
      });
    }
  });

  // §8.5: dopo due «non ha mai lavorato qui» il libretto si sospende, finché l'admin
  // non lo guarda. Non è una punizione automatica definitiva: è un freno.
  //
  // Contano solo quelle che Mike non ha ancora guardato. Quando toglie la sospensione
  // mette `gestita: true` dalla console; prima le segnalazioni gestite contavano ancora, e
  // un solo «mai lavorato» nuovo bastava a sospendere di nuovo il libretto.
  if (motivo === 'mai_lavorato') {
    const segnalazioni = await db
      .collection('segnalazioni')
      .where('workerUid', '==', richiesta.workerUid)
      .where('tipo', '==', 'mai_lavorato')
      .where('gestita', '==', false)
      .count()
      .get();

    if (segnalazioni.data().count >= 2) {
      await db.doc(`sospensioni/${richiesta.workerUid}`).set({
        motivo: 'due segnalazioni «mai lavorato qui»',
        nSegnalazioni: segnalazioni.data().count,
        createdAt: adesso(),
      });
      // La sospensione deve togliere subito il profilo dalla rete: il trigger di
      // `pubblicaProfilo` non scatta, perché la sospensione non è scritta né nel
      // profilo né nelle stagioni.
      await ricostruisciProfiloPubblico(richiesta.workerUid);
    }
  }

  return { ok: true };
});

/**
 * C4 · «Hai confermato per errore? Revoca», entro 30 giorni.
 * Revocare cancella la conferma, non la marca come sbagliata: quello che il responsabile
 * ritira deve sparire, non restare come traccia di un giudizio (§9).
 */
export const revocaConferma = onCall(async (chiamata) => {
  const telefono = telefonoDiChiChiama(chiamata.auth);
  const token = testoRichiesto(chiamata.data?.token, 64, 'il link');

  const { ref: richiestaRef, richiesta } = await richiestaPerChiamante(token, telefono, 'usata');

  const conferme = await db.collection('conferme').where('richiestaId', '==', token).limit(1).get();
  const conferma = conferme.docs[0];
  if (!conferma) throw new HttpsError('not-found', 'Non trovo la conferma da revocare.');

  const dati = conferma.data() as { revocabileFinoA: Timestamp; strutturaId: string; responsabileUid: string };
  if (dati.revocabileFinoA.toMillis() < Date.now()) {
    throw new HttpsError(
      'failed-precondition',
      `Sono passati più di ${GIORNI_REVOCA} giorni. Scrivi all’indirizzo indicato nell’informativa.`,
    );
  }

  const stagioneRef = db.doc(`workers/${richiesta.workerUid}/stagioni/${richiesta.stagioneId}`);
  const strutturaRef = db.doc(`strutture/${dati.strutturaId}`);

  // In transazione, non in lotto: un doppio tap o un tentativo ripetuto dal telefono
  // scalava due volte i conteggi delle conferme, e la cancellazione della conferma non
  // dava errore la seconda volta, quindi non se ne accorgeva nessuno. Rileggendo lo
  // stato della richiesta dentro la transazione, il secondo giro si ferma qui.
  await db.runTransaction(async (tx) => {
    const controllo = await tx.get(richiestaRef);
    if (controllo.data()?.stato !== 'usata') {
      throw new HttpsError('failed-precondition', 'Questa conferma è già stata revocata.');
    }

    // Si guarda cosa esiste ancora: una revoca non deve fallire perché nel frattempo il
    // lavoratore ha cancellato la stagione, né creare una struttura dal nulla con un
    // conteggio negativo.
    //
    // E la conferma stessa: è stata trovata fuori dalla transazione, e se nel mezzo il
    // lavoratore ha cancellato la stagione, `dopoStagioneCancellata` l'ha già tolta e ha già
    // scalato i conteggi. Senza rileggerla qui si scalavano una seconda volta, e struttura e
    // responsabile finivano a −1.
    const [stagioneSnap, strutturaSnap, confermaOra] = await Promise.all([
      tx.get(stagioneRef),
      tx.get(strutturaRef),
      tx.get(conferma.ref),
    ]);
    if (!confermaOra.exists) throw new HttpsError('not-found', 'Non trovo la conferma da revocare.');

    tx.delete(conferma.ref);

    // La stagione torna in bozza: sparisce dal profilo pubblico e il lavoratore può
    // ripartire da capo, invece di restare con addosso una stagione «non confermata»
    // per un errore di chi l'aveva confermata.
    if (stagioneSnap.exists) {
      tx.update(stagioneRef, {
        stato: 'bozza',
        competenzeConfermate: [],
        riprenderebbe: false,
        ruoloResponsabile: null,
        richiestaId: null,
        updatedAt: FieldValue.serverTimestamp(),
      });
    }

    tx.update(richiestaRef, { stato: 'revocata' });
    tx.set(
      db.doc(`responsabili/${dati.responsabileUid}`),
      { nConferme: FieldValue.increment(-1) },
      { merge: true },
    );
    if (strutturaSnap.exists) {
      tx.update(strutturaRef, { nConferme: FieldValue.increment(-1) });
    }
  });

  await ricontrollaResponsabileNoto(dati.responsabileUid);

  return { ok: true };
});
