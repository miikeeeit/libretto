// La pulizia di ogni notte (§10).
//
// Fa due cose che senza di lei non succederebbero mai: chiude i link che nessuno ha
// usato, e cancella quello che non serve più tenere (§9, conservazione).
//
// Il secondo punto non è manutenzione, è privacy: in una richiesta chiusa restano il
// nome e il telefono di un responsabile che magari non ha nemmeno risposto. Tenerli lì
// per sempre sarebbe il contrario di quello che promette l'informativa.

import { getAuth } from 'firebase-admin/auth';
import { FieldValue } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { Timestamp } from 'firebase-admin/firestore';
import { db, telefonoValido } from './comune';
import { aggiornaStatisticheConferme } from './statistiche';

/** §9: le richieste chiuse si cancellano dopo 90 giorni. */
const GIORNI_CONSERVAZIONE = 90;

/** Quante ne tocca al massimo per notte, per non fare scritture infinite. */
const MASSIMO_PER_GIRO = 400;

export type EsitoPulizia = {
  scadute: number;
  cancellate: number;
  sbloccate: number;
  accessiTolti: number;
  responsabiliTolti: number;
  paginePubblicheTolte: number;
};

/**
 * Le passate girano ognuna per conto suo. Prima erano in fila, e un errore nella
 * prima (successe online: mancava un indice, che l'emulatore non chiede) fermava anche
 * la seconda — cioè la cancellazione dopo 90 giorni che l'informativa promette. Ora se
 * una si rompe le altre vanno avanti, e l'errore si rilancia alla fine, così nei log
 * la pulizia risulta fallita e non passa inosservata.
 */
export async function eseguiPulizia(adesso = Timestamp.now()): Promise<EsitoPulizia> {
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

  // Prima i conti, poi le cancellazioni: la misura deve vedere le richieste che la
  // pulizia sta per togliere.
  await passata('statistiche', () => aggiornaStatisticheConferme(adesso), null);
  const scadute = await passata('link scaduti', () => chiudiLinkScaduti(adesso), 0);
  const cancellate = await passata('richieste vecchie', () => cancellaRichiesteVecchie(adesso), 0);
  const sbloccate = await passata('stagioni appese', () => sbloccaStagioniAppese(), 0);
  const responsabiliTolti = await passata('responsabili senza conferme', () => togliResponsabiliSenzaConferme(adesso), 0);
  const accessiTolti = await passata('accessi che non servono più', () => togliAccessiInutili(adesso), 0);
  const paginePubblicheTolte = await passata('pagine pubbliche orfane', () => togliPaginePubblicheOrfane(), 0);

  console.log(
    `Pulizia: ${scadute} richieste scadute, ${cancellate} cancellate, ${sbloccate} stagioni sbloccate, ` +
      `${responsabiliTolti} responsabili e ${accessiTolti} accessi senza più motivo di restare, ` +
      `${paginePubblicheTolte} pagine pubbliche orfane.`,
  );
  if (errori.length > 0) throw new Error(`Pulizia incompleta: ${errori.join(', ')}.`);
  return { scadute, cancellate, sbloccate, accessiTolti, responsabiliTolti, paginePubblicheTolte };
}

function novantaGiorniPrima(adesso: Timestamp): number {
  return adesso.toMillis() - GIORNI_CONSERVAZIONE * 24 * 60 * 60 * 1000;
}

async function haConferme(responsabileUid: string): Promise<boolean> {
  const conferme = await db.collection('conferme').where('responsabileUid', '==', responsabileUid).limit(1).get();
  return !conferme.empty;
}

/**
 * ---- 4 · I responsabili che non hanno più conferme ----------------------
 * L'informativa promette che il numero di un responsabile se ne va con la richiesta,
 * dopo 90 giorni. Ma il numero stava anche in `responsabili/{uid}`, e restava per
 * sempre: anche dopo che la sua conferma era stata revocata, o che il lavoratore aveva
 * cancellato l'account portandosi via le conferme. Chi non ha più nessuna conferma in
 * piedi da 90 giorni non ha motivo di restare.
 */
async function togliResponsabiliSenzaConferme(adesso: Timestamp): Promise<number> {
  const limite = novantaGiorniPrima(adesso);
  const responsabili = await db.collection('responsabili').get();
  let tolti = 0;
  for (const r of responsabili.docs) {
    if (tolti >= MASSIMO_PER_GIRO) break;
    const ultimaVolta = (r.data().updatedAt as Timestamp | undefined)?.toMillis() ?? 0;
    if (ultimaVolta > limite) continue;
    if (await haConferme(r.id)) continue;
    // Con lui se ne va il documento che metteva in fila le conferme del suo numero
    // (`confermaStagione`), che ha il telefono nell'id. Prima di lui: se questa
    // cancellazione fallisce, `responsabili/{uid}` resta e la notte dopo si riprova;
    // nell'ordine inverso `limiti/{telefono}` restava senza più nessuno che lo ritrovasse.
    const telefono = r.data().telefono;
    if (telefonoValido(telefono)) await db.doc(`limiti/${telefono}`).delete();
    await r.ref.delete();
    tolti += 1;
  }
  return tolti;
}

/**
 * ---- 5 · Gli accessi che non servono più -------------------------------
 * Chi apre un link di conferma verifica il suo numero, e da lì esiste un accesso con il
 * suo telefono dentro. Se poi non conferma — numero sbagliato, ci ha ripensato, era il
 * numero di un altro — quell'accesso restava per sempre, con un telefono che nessuno
 * aveva motivo di tenere. Lo stesso per chi ha verificato il numero e non ha mai creato il
 * libretto, insieme alla foto che magari aveva già caricato.
 *
 * Si toglie solo chi, da 90 giorni, non entra e non ha niente: nessun libretto, nessuna
 * conferma data, nessun codice di invito intestato (quello resta suo, e se tornasse
 * troverebbe il codice bruciato).
 */
async function togliAccessiInutili(adesso: Timestamp): Promise<number> {
  const limite = novantaGiorniPrima(adesso);
  const auth = getAuth();
  let tolti = 0;
  let pagina: string | undefined;

  do {
    const elenco = await auth.listUsers(1000, pagina);
    pagina = elenco.pageToken;

    for (const utente of elenco.users) {
      if (tolti >= MASSIMO_PER_GIRO) return tolti;
      const ultimoAccesso = Date.parse(utente.metadata.lastSignInTime || utente.metadata.creationTime);
      if (!(ultimoAccesso < limite)) continue;

      const uid = utente.uid;
      if ((await db.doc(`workers/${uid}`).get()).exists) continue;
      if (await haConferme(uid)) continue;
      const invito = await db.collection('inviti').where('usatoDa', '==', uid).limit(1).get();
      if (!invito.empty) continue;

      await cancellaFile(`foto/${uid}`);
      await cancellaFile(`cv/${uid}`);
      await db.doc(`responsabili/${uid}`).delete();
      // Come sopra: il documento di fila delle sue conferme se ne va con `responsabili/{uid}`.
      if (telefonoValido(utente.phoneNumber)) await db.doc(`limiti/${utente.phoneNumber}`).delete();
      await auth.deleteUser(uid);
      tolti += 1;
    }
  } while (pagina);

  return tolti;
}

async function cancellaFile(percorso: string): Promise<void> {
  try {
    await getStorage().bucket().file(percorso).delete({ ignoreNotFound: true });
  } catch (errore) {
    console.warn(`Pulizia: non riesco a cancellare ${percorso}:`, errore);
  }
}

/**
 * ---- 6 · Le pagine pubbliche senza più un lavoratore dietro --------------
 * La pagina pubblica la scrive un trigger, che gira un istante dopo le scritture. Se una
 * scrittura arriva mentre un account si sta cancellando, il trigger poteva rimettere in
 * piedi la pagina subito dopo che `eliminaAccount` l'aveva tolta: nome, foto e magari il
 * telefono di chi ha chiesto di sparire. Questa passata è la rete sotto quel caso.
 */
async function togliPaginePubblicheOrfane(): Promise<number> {
  const pagine = await db.collection('profiliPubblici').get();
  let tolte = 0;
  for (const pagina of pagine.docs) {
    const uid = (await db.doc(`slugs/${pagina.id}`).get()).data()?.uid;
    const viva = typeof uid === 'string' && (await db.doc(`workers/${uid}`).get()).exists;
    if (viva) continue;
    await pagina.ref.delete();
    tolte += 1;
  }
  return tolte;
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
  const limite = Timestamp.fromMillis(novantaGiorniPrima(adesso));
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

  // Stagione e richiesta si rileggono in una transazione: la stagione letta qui sopra può
  // essere già vecchia. Se il lavoratore la rimandava proprio adesso (link nuovo, di nuovo
  // «in attesa»), la pulizia ragionava sul link vecchio e metteva «scaduta» sopra quello
  // nuovo, e il responsabile trovava una stagione che non lo aspettava più.
  let sbloccate = 0;
  for (const stagione of appese.docs) {
    const richiestaId = stagione.data().richiestaId;
    if (typeof richiestaId !== 'string') continue;

    const sbloccata = await db.runTransaction(async (tx) => {
      const [ora, richiesta] = await Promise.all([
        tx.get(stagione.ref),
        tx.get(db.doc(`richieste/${richiestaId}`)),
      ]);
      const ancoraAppesa = ora.data()?.stato === 'in_attesa' && ora.data()?.richiestaId === richiestaId;
      const ancoraAperta = richiesta.exists && richiesta.data()?.stato === 'aperta';
      if (!ancoraAppesa || ancoraAperta) return false;

      tx.update(stagione.ref, { stato: 'scaduta', updatedAt: FieldValue.serverTimestamp() });
      return true;
    });
    if (sbloccata) sbloccate += 1;
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
