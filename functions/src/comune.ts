// Le cose che servono a tutte le funzioni.
//
// Perché queste funzioni esistono (§10): tutto ciò che rende vera una conferma deve
// stare fuori dalla portata del client. Il telefono del responsabile, il confronto tra
// quel telefono e quello che ha verificato, lo stato "confermata": se una di queste cose
// si potesse scrivere dal telefono di chi ha interesse a falsificarla, Libretto sarebbe
// un CV con la grafica più bella.

import { initializeApp } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { HttpsError } from 'firebase-functions/v2/https';
import { setGlobalOptions } from 'firebase-functions/v2/options';

initializeApp();

// Stessa regione dei dati (PC1: Milano). I dati non escono dall'Italia.
setGlobalOptions({ region: 'europe-west8', maxInstances: 10 });

export const db = getFirestore();

/** Giorni di vita di un link di conferma (§6). */
export const GIORNI_SCADENZA = 30;

/** Giorni entro cui il responsabile può revocare la sua conferma (§4.2 C4). */
export const GIORNI_REVOCA = 30;

/** §8.4 */
export const MAX_CONFERME_AL_GIORNO = 10;
export const MAX_RICHIESTE_APERTE = 5;

/** §8.3: dopo tante conferme di lavoratori diversi nella stessa struttura, il numero è noto. */
export const CONFERME_PER_RESPONSABILE_NOTO = 3;

/** Versione del consenso che il responsabile accetta quando conferma (§9). */
export const VERSIONE_CONSENSO = '1';

/** I ruoli che il responsabile può dichiarare (§4.2 C3). */
export const RUOLI_RESPONSABILE = ['titolare', 'direttore', 'responsabile di sala', 'chef', 'altro'];

export type StatoRichiesta = 'aperta' | 'usata' | 'scaduta' | 'revocata';

export function adesso(): Timestamp {
  return Timestamp.now();
}

export function fraGiorni(giorni: number): Timestamp {
  return Timestamp.fromMillis(Date.now() + giorni * 24 * 60 * 60 * 1000);
}

/** Solo E.164. Non si normalizza niente qui: chi chiama manda già un numero pulito. */
export function telefonoValido(numero: unknown): numero is string {
  return typeof numero === 'string' && /^\+[1-9]\d{7,14}$/.test(numero);
}

/** "+393471234567" → "347 •••• 67": quello che si può mostrare senza essere collegati. */
export function mascheraTelefono(e164: string): string {
  const nazionale = e164.startsWith('+39') ? e164.slice(3) : e164.replace(/^\+/, '');
  if (nazionale.length < 6) return '•••••';
  return `${nazionale.slice(0, 3)} •••• ${nazionale.slice(-2)}`;
}

/** Il telefono verificato di chi sta chiamando, o niente se non ne ha uno. */
export function telefonoDiChiChiama(auth: { token?: { phone_number?: string } } | undefined): string {
  const numero = auth?.token?.phone_number;
  if (!telefonoValido(numero)) {
    throw new HttpsError('unauthenticated', 'Serve un numero di telefono verificato.');
  }
  return numero;
}

export function testoRichiesto(valore: unknown, massimo: number, campo: string): string {
  if (typeof valore !== 'string' || valore.trim() === '') {
    throw new HttpsError('invalid-argument', `Manca ${campo}.`);
  }
  const pulito = valore.trim().replace(/\s+/g, ' ');
  if (pulito.length > massimo) {
    throw new HttpsError('invalid-argument', `${campo} è troppo lungo.`);
  }
  return pulito;
}

/** Due periodi "YYYY-MM" si sovrappongono: il confronto fra stringhe basta. */
export function periodiSiSovrappongono(a: { dal: string; al: string }, b: { dal: string; al: string }): boolean {
  return a.dal <= b.al && a.al >= b.dal;
}

/** Un lavoratore sospeso (§8.5) non manda richieste finché l'admin non lo rivede. */
export async function controllaSospensione(workerUid: string): Promise<void> {
  const sospensione = await db.doc(`sospensioni/${workerUid}`).get();
  if (sospensione.exists) {
    throw new HttpsError(
      'permission-denied',
      'Il tuo libretto è sospeso: ci sono segnalazioni da controllare. Scrivi a chi gestisce Libretto.',
    );
  }
}
