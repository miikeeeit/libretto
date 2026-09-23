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
  CONFERME_PER_RESPONSABILE_NOTO,
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

type Richiesta = {
  workerUid: string;
  stagioneId: string;
  telefonoResponsabile: string;
  stato: string;
  scadeIl: Timestamp;
  /** Cosa è stato chiesto, congelato al momento dell'invio del link. */
  stagioneAlMomento?: {
    strutturaId: string;
    ruolo: string;
    dal: string;
    al: string;
    competenzeDichiarate: string[];
  };
};

type Stagione = {
  strutturaId: string;
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
    throw new HttpsError('failed-precondition', `stato:${richiesta.stato}`);
  }

  return { ref, richiesta };
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
  // confermare dal titolare del Bar Somma un posto dove non aveva visto nessuno.
  const chiesto = richiesta.stagioneAlMomento;
  const uguale =
    chiesto !== undefined &&
    chiesto.strutturaId === stagione.strutturaId &&
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
  const recenti = await db
    .collection('conferme')
    .where('responsabileUid', '==', responsabileUid)
    .where('createdAt', '>=', Timestamp.fromMillis(Date.now() - 24 * 60 * 60 * 1000))
    .count()
    .get();
  if (recenti.data().count >= MAX_CONFERME_AL_GIORNO) {
    throw new HttpsError(
      'resource-exhausted',
      'Hai confermato molte stagioni nelle ultime ore. Riprova domani.',
    );
  }

  const confermaRef = db.collection('conferme').doc();
  const revocabileFinoA = fraGiorni(GIORNI_REVOCA);
  const strutturaRef = db.doc(`strutture/${stagione.strutturaId}`);

  await db.runTransaction(async (tx) => {
    // Si rilegge dentro la transazione: se qualcuno ha confermato un istante prima,
    // il secondo tentativo si fermi qui e non scriva una seconda conferma.
    const controllo = await tx.get(richiestaRef);
    if (controllo.data()?.stato !== 'aperta') {
      throw new HttpsError('failed-precondition', 'Questa conferma è già stata registrata.');
    }
    const strutturaEsiste = (await tx.get(strutturaRef)).exists;

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

    tx.update(richiestaRef, { stato: 'usata' });

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
 * §8.3 · «Responsabile noto». Nella v1 il dato non si vede da nessuna parte: serve ai
 * controlli dell'admin e servirà alla ricerca di gennaio. Due strade per diventarlo.
 *
 * La prima (PC4, 2026-09-23): il numero sta nella lista che Mike carica a mano, in
 * `responsabiliNoti`. Si controlla qui e non prima perché un responsabile esiste per
 * Libretto solo dopo aver verificato il suo numero la prima volta: fino a quel momento
 * non c'è nessun documento su cui mettere il flag. Così Mike può caricare i numeri
 * in anticipo e il flag si applica da solo alla prima conferma.
 *
 * La seconda: averne confermati tre diversi nella stessa struttura.
 */
async function aggiornaResponsabileNoto(
  responsabileUid: string,
  telefono: string,
  strutturaId: string,
): Promise<void> {
  const inLista = await db.doc(`responsabiliNoti/${telefono}`).get();
  if (inLista.exists) {
    await db.doc(`responsabili/${responsabileUid}`).set({ verificatoAdmin: true }, { merge: true });
    return;
  }

  const suoi = await db
    .collection('conferme')
    .where('responsabileUid', '==', responsabileUid)
    .where('strutturaId', '==', strutturaId)
    .get();

  const lavoratoriDiversi = new Set(suoi.docs.map((d) => (d.data() as { workerUid: string }).workerUid));
  if (lavoratoriDiversi.size >= CONFERME_PER_RESPONSABILE_NOTO) {
    await db.doc(`responsabili/${responsabileUid}`).set({ verificatoAdmin: true }, { merge: true });
  }
}

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
  const stagioneSnap = await stagioneRef.get();
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
      chiesto.dal !== stagione.dal ||
      chiesto.al !== stagione.al);
  if (cambiata) {
    throw new HttpsError('failed-precondition', 'Questo link non è più valido.');
  }

  const lotto = db.batch();
  // Se il lavoratore ha cancellato la stagione nel frattempo, la segnalazione si scrive
  // comunque: altrimenti bastava cancellarla per scansare la segnalazione, e l'intera
  // commit saltava per una `update` su un documento che non c'è più.
  if (stagioneSnap.exists) {
    lotto.update(stagioneRef, {
      stato: 'non_confermata',
      richiestaId: null,
      updatedAt: FieldValue.serverTimestamp(),
    });
  }
  lotto.update(richiestaRef, { stato: 'usata' });

  if (motivo === 'mai_lavorato') {
    lotto.set(db.collection('segnalazioni').doc(), {
      tipo: motivo,
      richiestaId: token,
      workerUid: richiesta.workerUid,
      createdAt: adesso(),
      gestita: false,
    });
  }

  await lotto.commit();

  // §8.5: dopo due «non ha mai lavorato qui» il libretto si sospende, finché l'admin
  // non lo guarda. Non è una punizione automatica definitiva: è un freno.
  if (motivo === 'mai_lavorato') {
    const segnalazioni = await db
      .collection('segnalazioni')
      .where('workerUid', '==', richiesta.workerUid)
      .where('tipo', '==', 'mai_lavorato')
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
    const [stagioneSnap, strutturaSnap] = await Promise.all([
      tx.get(stagioneRef),
      tx.get(strutturaRef),
    ]);

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

  return { ok: true };
});
