// §12: si contano solo gli eventi essenziali, e senza sapere di chi sono.
// L'uid non si salva: si salva un'impronta accorciata, così si possono contare
// le persone distinte senza poter risalire a chi sono. Niente analytics di terze parti,
// quindi niente banner dei cookie (§9).

import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';
import type { TipoEvento } from './tipi';

async function impronta(uid: string): Promise<string> {
  const dati = new TextEncoder().encode(`libretto:${uid}`);
  const digest = await crypto.subtle.digest('SHA-256', dati);
  return Array.from(new Uint8Array(digest).slice(0, 8))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/** Non blocca mai il flusso: se il conteggio non parte, l'app va avanti. */
export async function registraEvento(tipo: TipoEvento, uid?: string): Promise<void> {
  try {
    await addDoc(collection(db, 'eventi'), {
      tipo,
      uidAnonimo: uid ? await impronta(uid) : null,
      ts: serverTimestamp(),
    });
  } catch (errore) {
    console.warn('Evento non registrato:', tipo, errore);
  }
}
