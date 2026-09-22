// La copia pubblica del profilo, il CV e la cancellazione dell'account.
//
// `profiliPubblici` è una collezione a parte (§6) per un motivo solo: la pagina che apre
// un datore legge **un documento che contiene già solo ciò che può vedere**. Non filtra
// niente il browser. Se un domani si sbaglia una riga nella pagina pubblica, il peggio
// che può succedere è che non si veda qualcosa — mai che si veda qualcosa di privato,
// perché quel dato nel documento non c'è proprio.

import { randomUUID } from 'node:crypto';
import { getAuth } from 'firebase-admin/auth';
import { FieldValue } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { adesso, db, testoRichiesto } from './comune';

type Privacy = {
  pubblico: boolean;
  mostraTelefono: boolean;
  mostraInAttesa: boolean;
  mostraCv: boolean;
};

type Worker = {
  nome: string;
  cognome: string;
  fotoPath: string | null;
  telefono: string;
  ruoloPrincipale: string;
  comune: string;
  geohash: string;
  disponibile: boolean;
  stagioneDisponibile: string;
  slug: string;
  privacy: Privacy;
  cvPath: string | null;
};

type Stagione = {
  strutturaId: string;
  strutturaNome: string;
  strutturaComune: string;
  ruolo: string;
  dal: string;
  al: string;
  competenzeDichiarate: string[];
  competenzeConfermate: string[];
  stato: string;
  nascosta: boolean;
  riprenderebbe: boolean;
  ruoloResponsabile: string | null;
};

/** Ricostruisce da zero il documento pubblico di un lavoratore. */
async function ricostruisci(uid: string): Promise<void> {
  const workerSnap = await db.doc(`workers/${uid}`).get();

  // Profilo cancellato: sparisce anche la copia pubblica. Lo slug però non si libera:
  // se si riusasse, un vecchio link mostrerebbe la persona sbagliata.
  if (!workerSnap.exists) return;

  const worker = workerSnap.data() as Worker;
  const pubblico = db.doc(`profiliPubblici/${worker.slug}`);

  // Profilo privato o libretto sospeso (§8.5): il link non deve funzionare.
  const sospeso = (await db.doc(`sospensioni/${uid}`).get()).exists;
  if (!worker.privacy?.pubblico || sospeso) {
    await pubblico.delete().catch(() => undefined);
    return;
  }

  const stagioniSnap = await db.collection(`workers/${uid}/stagioni`).get();
  const stagioni = stagioniSnap.docs
    .map((d) => d.data() as Stagione)
    .filter((s) => !s.nascosta)
    .sort((a, b) => b.dal.localeCompare(a.dal));

  const confermate = stagioni.filter((s) => s.stato === 'confermata');

  // Quelle in attesa si mostrano solo se il lavoratore lo ha scelto, e non si dice mai
  // da chi si aspetta la conferma.
  const visibili = worker.privacy.mostraInAttesa
    ? stagioni.filter((s) => s.stato === 'confermata' || s.stato === 'in_attesa')
    : confermate;

  // Una competenza vale per quante **strutture** l'hanno confermata, non per quante
  // volte: tre stagioni nello stesso bar non fanno «confermata da 3».
  const strutturePerCompetenza = new Map<string, Set<string>>();
  for (const s of confermate) {
    for (const id of s.competenzeConfermate ?? []) {
      if (!strutturePerCompetenza.has(id)) strutturePerCompetenza.set(id, new Set());
      strutturePerCompetenza.get(id)!.add(s.strutturaId);
    }
  }
  const competenzeConfermate = Object.fromEntries(
    [...strutturePerCompetenza].map(([id, strutture]) => [id, strutture.size]),
  );

  // Dichiarate: quelle che il lavoratore dice di saper fare e che nessuno ha ancora
  // confermato. Restano separate, e in grigio (§4.3).
  const dichiarate = [
    ...new Set(
      visibili.flatMap((s) => s.competenzeDichiarate ?? []).filter((id) => !(id in competenzeConfermate)),
    ),
  ];

  await pubblico.set({
    nome: `${worker.nome} ${worker.cognome}`,
    // Il percorso, non un indirizzo: lo risolve la pagina, così vale uguale in locale
    // e online senza scrivere nel database un indirizzo che può cambiare.
    fotoPath: worker.fotoPath ?? null,
    ruoloPrincipale: worker.ruoloPrincipale,
    comune: worker.comune,
    geohash: worker.geohash,
    disponibile: worker.disponibile === true,
    stagioneDisponibile: worker.stagioneDisponibile ?? null,
    telefono: worker.privacy.mostraTelefono ? worker.telefono : null,
    stagioni: visibili.map((s) => ({
      struttura: s.strutturaNome,
      comune: s.strutturaComune,
      ruolo: s.ruolo,
      dal: s.dal,
      al: s.al,
      stato: s.stato,
      riprenderebbe: s.stato === 'confermata' && s.riprenderebbe === true,
      // Il ruolo di chi ha confermato, mai il suo nome (PC2).
      ruoloResponsabile: s.stato === 'confermata' ? (s.ruoloResponsabile ?? null) : null,
    })),
    competenze: { confermate: competenzeConfermate, dichiarate },
    riepilogo: {
      nStagioni: stagioni.length,
      nConfermate: confermate.length,
      nStrutture: new Set(confermate.map((s) => s.strutturaId)).size,
      nRiprenderebbe: confermate.filter((s) => s.riprenderebbe).length,
    },
    haCv: worker.privacy.mostraCv && worker.cvPath !== null,
    updatedAt: adesso(),
  });
}

export const pubblicaProfilo = onDocumentWritten('workers/{uid}', (evento) =>
  ricostruisci(evento.params.uid),
);

export const pubblicaProfiloStagioni = onDocumentWritten('workers/{uid}/stagioni/{stagioneId}', (evento) =>
  ricostruisci(evento.params.uid),
);

/**
 * Il CV non è pubblico come la foto: si dà un indirizzo firmato che scade (§10).
 * Così chi si salva il link non può ripassarlo in giro un mese dopo, e se il lavoratore
 * spegne «mostra il CV» il file smette di essere raggiungibile.
 */
export const urlCv = onCall(async (chiamata) => {
  const slug = testoRichiesto(chiamata.data?.slug, 80, 'il profilo');

  const pubblico = await db.doc(`profiliPubblici/${slug}`).get();
  if (!pubblico.exists || pubblico.data()?.haCv !== true) {
    throw new HttpsError('not-found', 'Questo profilo non ha un CV da mostrare.');
  }

  // Dal documento pubblico non si risale a chi è: l'uid si ritrova dalla prenotazione
  // dello slug, che il client non può leggere.
  const prenotazione = await db.doc(`slugs/${slug}`).get();
  const uid = prenotazione.data()?.uid;
  if (!uid) throw new HttpsError('not-found', 'Questo profilo non esiste più.');

  const worker = (await db.doc(`workers/${uid}`).get()).data();
  if (!worker?.cvPath || worker.privacy?.mostraCv !== true || worker.privacy?.pubblico !== true) {
    throw new HttpsError('not-found', 'Questo profilo non ha un CV da mostrare.');
  }

  const file = getStorage().bucket().file(worker.cvPath);

  // Sull'emulatore non si possono firmare indirizzi, perché non ci sono le credenziali
  // del progetto: in locale si usa un gettone di download, che serve a poter provare
  // il flusso per davvero. In produzione si passa sempre per l'indirizzo firmato, che
  // scade da solo.
  const emulatore = process.env.FIREBASE_STORAGE_EMULATOR_HOST;
  if (emulatore) {
    const gettone = randomUUID();
    await file.setMetadata({ metadata: { firebaseStorageDownloadTokens: gettone } });
    const percorso = encodeURIComponent(worker.cvPath);
    return {
      url: `http://${emulatore}/v0/b/${file.bucket.name}/o/${percorso}?alt=media&token=${gettone}`,
      scadeFraMinuti: 0,
    };
  }

  const scadeFraMinuti = 15;
  const [url] = await file.getSignedUrl({
    action: 'read',
    expires: Date.now() + scadeFraMinuti * 60 * 1000,
  });
  return { url, scadeFraMinuti };
});

/**
 * L6 · Elimina il mio account.
 * §1, regola 3: il lavoratore può cancellare tutto con un tap. Qui «tutto» è tutto:
 * profilo, stagioni, richieste, conferme ricevute, foto, CV, copia pubblica e accesso.
 * Lo slug resta occupato di proposito, così un vecchio link non finisce su un'altra
 * persona che un giorno sceglie lo stesso nome.
 */
export const eliminaAccount = onCall(async (chiamata) => {
  const uid = chiamata.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Devi essere collegato.');
  if (chiamata.data?.conferma !== 'ELIMINA') {
    throw new HttpsError('invalid-argument', 'Serve la conferma scritta.');
  }

  const workerSnap = await db.doc(`workers/${uid}`).get();
  const worker = workerSnap.data() as Worker | undefined;

  if (worker?.slug) {
    await db.doc(`profiliPubblici/${worker.slug}`).delete().catch(() => undefined);
    await db.doc(`slugs/${worker.slug}`).set({ uid: null, liberatoIl: adesso() }, { merge: true });
  }

  const bucket = getStorage().bucket();
  await Promise.all(
    [worker?.fotoPath, worker?.cvPath]
      .filter((p): p is string => typeof p === 'string')
      .map((p) => bucket.file(p).delete().catch(() => undefined)),
  );

  // Le richieste aperte muoiono con l'account: i link in giro smettono di funzionare.
  const richieste = await db.collection('richieste').where('workerUid', '==', uid).get();
  const lottoRichieste = db.batch();
  richieste.docs.forEach((d) => lottoRichieste.delete(d.ref));
  await lottoRichieste.commit();

  // Le conferme ricevute se ne vanno con l'account, e con loro i conteggi che avevano
  // alzato: altrimenti una struttura resterebbe con «3 conferme» che non esistono più.
  const conferme = await db.collection('conferme').where('workerUid', '==', uid).get();
  const lottoConferme = db.batch();
  const daScalare = new Map<string, number>();
  for (const doc of conferme.docs) {
    const dati = doc.data() as { strutturaId?: string; responsabileUid?: string };
    for (const percorso of [
      dati.strutturaId ? `strutture/${dati.strutturaId}` : null,
      dati.responsabileUid ? `responsabili/${dati.responsabileUid}` : null,
    ]) {
      if (percorso) daScalare.set(percorso, (daScalare.get(percorso) ?? 0) + 1);
    }
    lottoConferme.delete(doc.ref);
  }
  for (const [percorso, quante] of daScalare) {
    lottoConferme.set(db.doc(percorso), { nConferme: FieldValue.increment(-quante) }, { merge: true });
  }
  await lottoConferme.commit();

  await db.doc(`sospensioni/${uid}`).delete().catch(() => undefined);
  await db.recursiveDelete(db.doc(`workers/${uid}`));

  // Anche l'accesso: il numero torna libero di registrarsi da capo, domani.
  await getAuth().deleteUser(uid).catch(() => undefined);

  return { ok: true };
});
