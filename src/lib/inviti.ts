// Beta su invito — decisione PC1 del 2026-09-21.
//
// Il codice si controlla prima di mandare l'SMS, perché ogni SMS costa.
// Il controllo è vero, non di facciata: i documenti `inviti` si leggono solo
// conoscendo il codice esatto (le regole vietano di elencarli), un codice si può
// collegare a un solo numero, e senza un codice collegato al proprio uid le regole
// non permettono di creare il profilo.
//
// I codici li crea Mike dalla console Firebase (vedi README).

import { doc, getDoc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { db } from './firebase';

export type EsitoInvito = { ok: true } | { ok: false; motivo: string };

/** Il codice si scrive come viene: si confronta sempre in minuscolo e senza spazi. */
export function normalizzaCodice(grezzo: string): string {
  return grezzo.trim().toLowerCase().replace(/\s+/g, '');
}

/**
 * Controllo prima dell'SMS: il codice esiste ed è attivo.
 *
 * Un codice già usato qui passa: prima dell'SMS non si sa ancora chi sta entrando, e
 * può essere chi l'ha usato, che torna dopo essere uscito o aver reinstallato l'app.
 * Di chi è il codice lo decide `collegaInvito` dopo la verifica del telefono.
 * Fermarlo qui chiudeva fuori proprio il suo proprietario (successo al primo giro vero).
 */
export async function controllaInvito(codice: string): Promise<EsitoInvito> {
  const pulito = normalizzaCodice(codice);
  if (pulito === '') return { ok: false, motivo: 'Scrivi il codice di invito.' };

  const snap = await getDoc(doc(db, 'inviti', pulito));
  if (!snap.exists()) return { ok: false, motivo: 'Questo codice non esiste.' };

  const dati = snap.data();
  if (dati.attivo !== true) return { ok: false, motivo: 'Questo codice non è più valido.' };

  return { ok: true };
}

/**
 * Dopo la verifica del telefono: il codice si intesta a questo uid.
 * Se due persone usano lo stesso codice nello stesso momento, il secondo perde:
 * le regole accettano l'aggiornamento solo se `usatoDa` è ancora vuoto.
 */
export async function collegaInvito(codice: string, uid: string): Promise<EsitoInvito> {
  try {
    await updateDoc(doc(db, 'inviti', normalizzaCodice(codice)), {
      usatoDa: uid,
      usatoIl: serverTimestamp(),
    });
    return { ok: true };
  } catch {
    // Prima qualunque rifiuto diventava «già usato da un altro numero», anche quando il
    // motivo era un altro (un codice creato senza `usatoDa`, la rete): si guarda il codice
    // e si dice quello che è vero.
    const snap = await getDoc(doc(db, 'inviti', normalizzaCodice(codice))).catch(() => null);
    const usatoDa = snap?.exists() ? snap.data().usatoDa : undefined;
    if (typeof usatoDa === 'string' && usatoDa !== uid) {
      return { ok: false, motivo: 'Questo codice è già stato usato da un altro numero.' };
    }
    if (snap?.exists() && snap.data().attivo !== true) {
      return { ok: false, motivo: 'Questo codice non è più valido.' };
    }
    return {
      ok: false,
      motivo: 'Non riesco a collegare il tuo codice. Riprova tra poco, e se non va scrivi a chi ti ha invitato.',
    };
  }
}

/** Il codice già collegato a questo uid, se c'è: serve a riprendere una registrazione interrotta. */
export async function invitoGiaCollegato(codice: string, uid: string): Promise<boolean> {
  const snap = await getDoc(doc(db, 'inviti', normalizzaCodice(codice)));
  return snap.exists() && snap.data().usatoDa === uid;
}
