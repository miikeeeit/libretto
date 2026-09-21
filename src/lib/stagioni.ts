// Le stagioni del libretto (L3, L4).
//
// Quello che il client può scrivere qui è solo la parte dichiarata: struttura, ruolo,
// periodo e competenze dichiarate. Le competenze confermate, «lo riprenderebbe», il
// ruolo del responsabile e lo stato «confermata» li scrive solo la Cloud Function, e le
// regole di sicurezza lo impongono — non è una gentilezza del frontend.

import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';
import { db } from './firebase';
import type { StagioneConId, StatoStagione } from './tipi';

/** §8.4: al massimo 5 richieste aperte per lavoratore. */
export const MAX_IN_ATTESA = 5;

export type DatiStagione = {
  strutturaId: string;
  strutturaNome: string;
  strutturaComune: string;
  ruolo: string;
  /** "2025-05" */
  dal: string;
  /** "2025-09" */
  al: string;
  competenzeDichiarate: string[];
};

function collezione(uid: string) {
  return collection(db, 'workers', uid, 'stagioni');
}

/** Dalla più recente, come in L3. */
export async function elencaStagioni(uid: string): Promise<StagioneConId[]> {
  const snap = await getDocs(query(collezione(uid), orderBy('dal', 'desc')));
  return snap.docs.map((d) => ({ ...(d.data() as StagioneConId), id: d.id }));
}

export async function leggiStagione(uid: string, stagioneId: string): Promise<StagioneConId | null> {
  const snap = await getDoc(doc(db, 'workers', uid, 'stagioni', stagioneId));
  return snap.exists() ? { ...(snap.data() as StagioneConId), id: snap.id } : null;
}

/** Nasce sempre in bozza: diventa "in attesa" solo quando parte la richiesta (L5). */
export async function creaStagione(uid: string, dati: DatiStagione): Promise<string> {
  const riferimento = await addDoc(collezione(uid), {
    ...dati,
    competenzeConfermate: [],
    stato: 'bozza' satisfies StatoStagione,
    nascosta: false,
    riprenderebbe: false,
    ruoloResponsabile: null,
    richiestaId: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return riferimento.id;
}

/**
 * Correggere una stagione la riporta in bozza.
 * È il caso di L3: il responsabile ha detto che i dati sono sbagliati, il lavoratore li
 * sistema e la richiesta riparte da capo. Una stagione già confermata non si tocca: se
 * si potesse cambiare la struttura dopo la conferma, la conferma non varrebbe niente.
 *
 * ATTENZIONE PER LA SETTIMANA 3. Qui `richiestaId` si azzera, ma il documento in
 * `richieste` resta «aperta»: dal client non si può chiudere, e va bene così, perché
 * quella collezione è solo delle Cloud Functions. Vuol dire che un link già mandato
 * continua a esistere dopo una correzione. Perciò `confermaStagione` deve controllare
 * che il `richiestaId` della stagione sia ancora uguale al token del link, e rifiutare
 * se non lo è: altrimenti si potrebbe cambiare struttura e periodo dopo aver mandato il
 * link, e farsi confermare una stagione diversa da quella per cui è arrivata la
 * richiesta. È il buco più grosso che questa schermata può aprire.
 */
export async function aggiornaStagione(
  uid: string,
  stagioneId: string,
  dati: DatiStagione,
): Promise<void> {
  await updateDoc(doc(db, 'workers', uid, 'stagioni', stagioneId), {
    ...dati,
    stato: 'bozza' satisfies StatoStagione,
    richiestaId: null,
    updatedAt: serverTimestamp(),
  });
}

/** §1, regola 3: è roba sua, si cancella quando vuole. */
export async function cancellaStagione(uid: string, stagioneId: string): Promise<void> {
  await deleteDoc(doc(db, 'workers', uid, 'stagioni', stagioneId));
}

export type Riepilogo = {
  nStagioni: number;
  nConfermate: number;
  nStrutture: number;
  nRiprenderebbe: number;
  nInAttesa: number;
};

/** I numeri in cima al libretto: "6 stagioni · 4 confermate · 3 lo riprenderebbero". */
export function riepiloga(stagioni: StagioneConId[]): Riepilogo {
  const confermate = stagioni.filter((s) => s.stato === 'confermata');
  return {
    nStagioni: stagioni.length,
    nConfermate: confermate.length,
    nStrutture: new Set(confermate.map((s) => s.strutturaId)).size,
    nRiprenderebbe: confermate.filter((s) => s.riprenderebbe).length,
    nInAttesa: stagioni.filter((s) => s.stato === 'in_attesa').length,
  };
}

/** Una stagione confermata non si modifica più: la conferma vale per quei dati. */
export function modificabile(stato: StatoStagione): boolean {
  return stato !== 'confermata';
}
