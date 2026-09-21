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

type Richiesta = {
  workerUid: string;
  stagioneId: string;
  telefonoResponsabile: string;
  stato: string;
  scadeIl: Timestamp;
};

type Stagione = {
  strutturaId: string;
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
    await richiestaRef.update({ stato: 'scaduta' });
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

  // La stagione è stata corretta dopo l'invio del link: quello che il responsabile
  // vedrebbe non è più quello per cui gli è arrivata la richiesta.
  if (stagione.richiestaId !== token) {
    throw new HttpsError('failed-precondition', 'Questo link non è più valido: la stagione è stata modificata.');
  }

  // §8.2: lo stesso telefono non può essere lavoratore e responsabile della stessa cosa.
  if (worker.telefono === telefono) {
    throw new HttpsError('permission-denied', 'Non si può confermare una stagione a sé stessi.');
  }

  // Si può confermare solo ciò che il lavoratore ha dichiarato: il responsabile toglie,
  // non aggiunge. Così una competenza confermata è sempre una che il lavoratore si è
  // preso la responsabilità di scrivere.
  const dichiarate = new Set(stagione.competenzeDichiarate ?? []);
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

  await aggiornaResponsabileNoto(responsabileUid, stagione.strutturaId);

  return {
    nomeLavoratore: worker.nome,
    competenzeConfermate,
    revocabileFinoA: revocabileFinoA.toMillis(),
  };
});

/**
 * §8.3: un numero che ha confermato almeno tre lavoratori diversi della stessa struttura
 * diventa un «responsabile noto». Nella v1 il dato non si vede da nessuna parte: serve
 * ai controlli dell'admin e servirà alla ricerca di gennaio.
 */
async function aggiornaResponsabileNoto(responsabileUid: string, strutturaId: string): Promise<void> {
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

  const lotto = db.batch();
  lotto.update(stagioneRef, {
    stato: 'non_confermata',
    richiestaId: null,
    updatedAt: FieldValue.serverTimestamp(),
  });
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

  // Si guarda cosa esiste ancora: una revoca non deve fallire perché nel frattempo il
  // lavoratore ha cancellato la stagione, né creare una struttura dal nulla con un
  // conteggio negativo.
  const [stagioneEsiste, strutturaEsiste] = await Promise.all([
    stagioneRef.get().then((s) => s.exists),
    strutturaRef.get().then((s) => s.exists),
  ]);

  const lotto = db.batch();

  lotto.delete(conferma.ref);

  // La stagione torna in bozza: sparisce dal profilo pubblico e il lavoratore può
  // ripartire da capo, invece di restare con addosso una stagione «non confermata»
  // per un errore di chi l'aveva confermata.
  if (stagioneEsiste) {
    lotto.update(stagioneRef, {
      stato: 'bozza',
      competenzeConfermate: [],
      riprenderebbe: false,
      ruoloResponsabile: null,
      richiestaId: null,
      updatedAt: FieldValue.serverTimestamp(),
    });
  }

  lotto.update(richiestaRef, { stato: 'revocata' });
  lotto.set(
    db.doc(`responsabili/${dati.responsabileUid}`),
    { nConferme: FieldValue.increment(-1) },
    { merge: true },
  );
  if (strutturaEsiste) {
    lotto.update(strutturaRef, { nConferme: FieldValue.increment(-1) });
  }

  await lotto.commit();
  return { ok: true };
});
