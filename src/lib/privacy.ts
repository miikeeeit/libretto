// L6 · Le cose che il lavoratore deve poter fare con un tap (§1, regola 3):
// nascondere, esportare, cancellare. Non sono funzioni «di contorno»: sono metà del
// motivo per cui uno si fida a scrivere le sue stagioni qui.

import { deleteObject, ref, uploadBytes } from 'firebase/storage';
import { doc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { db, storage } from './firebase';
import { elencaStagioni } from './stagioni';
import { leggiWorker } from './worker';
import type { Privacy } from './tipi';

export const MAX_CV_MB = 5;

export async function aggiornaPrivacy(uid: string, privacy: Privacy): Promise<void> {
  await updateDoc(doc(db, 'workers', uid), { privacy, updatedAt: serverTimestamp() });
}

/** Nascondere una stagione la toglie dalla pagina pubblica, non dal libretto. */
export async function nascondiStagione(uid: string, stagioneId: string, nascosta: boolean): Promise<void> {
  await updateDoc(doc(db, 'workers', uid, 'stagioni', stagioneId), {
    nascosta,
    updatedAt: serverTimestamp(),
  });
}

export async function caricaCv(uid: string, file: File): Promise<void> {
  if (file.type !== 'application/pdf') throw new Error('Il CV deve essere un PDF.');
  if (file.size > MAX_CV_MB * 1024 * 1024) {
    throw new Error(`Il PDF è troppo grande: il limite è ${MAX_CV_MB} MB.`);
  }
  const percorso = `cv/${uid}`;
  await uploadBytes(ref(storage, percorso), file, { contentType: 'application/pdf' });
  await updateDoc(doc(db, 'workers', uid), { cvPath: percorso, updatedAt: serverTimestamp() });
}

export async function rimuoviCv(uid: string, privacy: Privacy): Promise<void> {
  await deleteObject(ref(storage, `cv/${uid}`)).catch(() => undefined);
  await updateDoc(doc(db, 'workers', uid), {
    cvPath: null,
    privacy: { ...privacy, mostraCv: false },
    updatedAt: serverTimestamp(),
  });
}

/** Le date di Firestore in qualcosa che si possa leggere in un file di testo. */
function leggibile(valore: unknown): unknown {
  if (valore && typeof valore === 'object') {
    if ('toDate' in valore && typeof (valore as { toDate: unknown }).toDate === 'function') {
      return (valore as { toDate(): Date }).toDate().toISOString();
    }
    if (Array.isArray(valore)) return valore.map(leggibile);
    return Object.fromEntries(Object.entries(valore).map(([k, v]) => [k, leggibile(v)]));
  }
  return valore;
}

/**
 * «Scarica i miei dati». Contiene tutto quello che è suo: il profilo e le stagioni con
 * le conferme ricevute. Non contiene i dati di chi ha confermato — il numero di un
 * responsabile non è roba del lavoratore, ed è giusto che non lo sia.
 */
export async function esportaDati(uid: string): Promise<void> {
  const [profilo, stagioni] = await Promise.all([leggiWorker(uid), elencaStagioni(uid)]);

  const dati = {
    esportatoIl: new Date().toISOString(),
    profilo: leggibile(profilo),
    stagioni: stagioni.map(leggibile),
  };

  const file = new Blob([JSON.stringify(dati, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(file);
  const collegamento = document.createElement('a');
  collegamento.href = url;
  collegamento.download = `libretto-${new Date().toISOString().slice(0, 10)}.json`;
  collegamento.click();
  URL.revokeObjectURL(url);
}
