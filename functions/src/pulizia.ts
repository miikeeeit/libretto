// La pulizia di ogni notte (§10).
//
// Fa due cose che senza di lei non succederebbero mai: chiude i link che nessuno ha
// usato, e cancella quello che non serve più tenere (§9, conservazione).
//
// Il secondo punto non è manutenzione, è privacy: in una richiesta chiusa restano il
// nome e il telefono di un responsabile che magari non ha nemmeno risposto. Tenerli lì
// per sempre sarebbe il contrario di quello che promette l'informativa.

import { FieldValue } from 'firebase-admin/firestore';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { Timestamp } from 'firebase-admin/firestore';
import { db } from './comune';

/** §9: le richieste chiuse si cancellano dopo 90 giorni. */
const GIORNI_CONSERVAZIONE = 90;

/** Quante ne tocca al massimo per notte, per non fare scritture infinite. */
const MASSIMO_PER_GIRO = 400;

export type EsitoPulizia = {
  scadute: number;
  cancellate: number;
  sbloccate: number;
};

/**
 * Le tre passate girano ognuna per conto suo. Prima erano in fila, e un errore nella
 * prima (successe online: mancava un indice, che l'emulatore non chiede) fermava anche
 * la seconda — cioè la cancellazione dopo 90 giorni che l'informativa promette. Ora se
 * una si rompe le altre vanno avanti, e l'errore si rilancia alla fine, così nei log
 * la pulizia risulta fallita e non passa inosservata.
 */
export async function eseguiPulizia(): Promise<EsitoPulizia> {
  const adesso = Timestamp.now();
  const errori: string[] = [];

  async function passata<T>(nome: string, lavoro: () => Promise<T>, seFallisce: T): Promise<T> {
    try {
      return await lavoro();
    } catch (errore) {
      console.error(`Pulizia, passata «${nome}» fallita:`, errore);
      errori.push(nome);
      return seFallisce;
    }
  }

  const scadute = await passata('link scaduti', () => chiudiLinkScaduti(adesso), 0);
  const cancellate = await passata('richieste vecchie', () => cancellaRichiesteVecchie(adesso), 0);
  const sbloccate = await passata('stagioni appese', () => sbloccaStagioniAppese(), 0);

  console.log(
    `Pulizia: ${scadute} richieste scadute, ${cancellate} cancellate, ${sbloccate} stagioni sbloccate.`,
  );
  if (errori.length > 0) throw new Error(`Pulizia incompleta: ${errori.join(', ')}.`);
  return { scadute, cancellate, sbloccate };
}

async function chiudiLinkScaduti(adesso: Timestamp): Promise<number> {
  // ---- 1 · I link non usati entro 30 giorni ------------------------------
  // La richiesta si chiude e la stagione torna visibile al lavoratore come «scaduta»,
  // con il pulsante per rimandarla (L3).
  const daScadere = await db
    .collection('richieste')
    .where('stato', '==', 'aperta')
    .where('scadeIl', '<', adesso)
    .limit(MASSIMO_PER_GIRO)
    .get();

  let scadute = 0;
  for (const richiesta of daScadere.docs) {
    const dati = richiesta.data() as { workerUid: string; stagioneId: string };
    const stagioneRef = db.doc(`workers/${dati.workerUid}/stagioni/${dati.stagioneId}`);
    const stagione = await stagioneRef.get();

    const lotto = db.batch();
    lotto.update(richiesta.ref, { stato: 'scaduta' });

    // Si tocca la stagione solo se sta ancora aspettando **questo** link: se il
    // lavoratore ne ha mandato un altro, o l'ha corretta, non c'entra più niente.
    if (stagione.exists && stagione.data()?.richiestaId === richiesta.id) {
      lotto.update(stagioneRef, {
        stato: 'scaduta',
        updatedAt: FieldValue.serverTimestamp(),
      });
    }

    await lotto.commit();
    scadute += 1;
  }
  return scadute;
}

async function cancellaRichiesteVecchie(adesso: Timestamp): Promise<number> {
  // ---- 2 · Quello che non serve più tenere -------------------------------
  const limite = Timestamp.fromMillis(adesso.toMillis() - GIORNI_CONSERVAZIONE * 24 * 60 * 60 * 1000);
  const vecchie = await db
    .collection('richieste')
    .where('createdAt', '<', limite)
    .limit(MASSIMO_PER_GIRO)
    .get();

  const lotto = db.batch();
  let cancellate = 0;
  for (const richiesta of vecchie.docs) {
    // Una richiesta ancora aperta non si tocca: vuol dire che è stata rimandata di
    // recente e il suo `scadeIl` è nel futuro.
    if (richiesta.data().stato === 'aperta') continue;
    lotto.delete(richiesta.ref);
    cancellate += 1;
  }
  if (cancellate > 0) await lotto.commit();
  return cancellate;
}

async function sbloccaStagioniAppese(): Promise<number> {
  // ---- 3 · Le stagioni rimaste appese ------------------------------------
  // Rete di sicurezza: una stagione «in attesa» il cui link non è più aperto non
  // aspetta più niente, e finché resta così il lavoratore non vede il pulsante per
  // rimandare. Succedeva quando un responsabile apriva un link già scaduto: la
  // richiesta si chiudeva lì e nessuno tornava a guardare la stagione. Quel caso ora
  // è chiuso alla fonte, ma questa passata prende qualunque altro modo di restare
  // appesi — compresi quelli che non abbiamo ancora immaginato.
  const appese = await db
    .collectionGroup('stagioni')
    .where('stato', '==', 'in_attesa')
    .limit(MASSIMO_PER_GIRO)
    .get();

  let sbloccate = 0;
  for (const stagione of appese.docs) {
    const richiestaId = stagione.data().richiestaId;
    if (typeof richiestaId !== 'string') continue;

    const richiesta = await db.doc(`richieste/${richiestaId}`).get();
    const ancoraAperta = richiesta.exists && richiesta.data()?.stato === 'aperta';
    if (ancoraAperta) continue;

    await stagione.ref.update({ stato: 'scaduta', updatedAt: FieldValue.serverTimestamp() });
    sbloccate += 1;
  }
  return sbloccate;
}

// Ogni notte alle tre, ora italiana: nessuno sta usando l'app, e se qualcosa va storto
// c'è tutta la giornata per accorgersene.
//
// Gli account inattivi non si cancellano da soli: la promessa dei tre anni è stata tolta
// dall'informativa il 2026-09-30 (DECISIONI.md). Se un giorno torna, serve leggere
// l'ultimo accesso da Firebase Auth, che non sta in Firestore.
export const pulizia = onSchedule(
  { schedule: '0 3 * * *', timeZone: 'Europe/Rome' },
  async () => {
    await eseguiPulizia();
  },
);
