// Le due righe che servono a scrivere nell'emulatore Firestore, in un posto solo.
// L'emulatore accetta "owner" come token di amministratore: scrive saltando le regole,
// esattamente come farebbe una Cloud Function.

import { readFile } from 'node:fs/promises';

const EMULATORE = process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080';

export async function idProgetto() {
  if (process.env.GCLOUD_PROJECT) return process.env.GCLOUD_PROJECT;
  try {
    const contenuto = JSON.parse(await readFile(new URL('../.firebaserc', import.meta.url), 'utf8'));
    return contenuto.projects?.default ?? 'libretto';
  } catch {
    return 'libretto';
  }
}

/** Scrive un documento con un id preciso. `campi` è già nel formato di Firestore. */
export async function scriviDocumento(collezione, id, campi) {
  const progetto = await idProgetto();
  const base = `http://${EMULATORE}/v1/projects/${progetto}/databases/(default)/documents/${collezione}`;

  const risposta = await fetch(`${base}?documentId=${encodeURIComponent(id)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer owner' },
    body: JSON.stringify({ fields: campi }),
  });

  if (!risposta.ok) throw new Error(`${risposta.status} ${await risposta.text()}`);
}

/**
 * Da "347 123 4567" a "+393471234567". Senza prefisso si assume l'Italia, come
 * nell'app (`src/lib/telefono.ts`): qui è riscritta perché uno script in Node non può
 * importare il TypeScript del browser.
 */
export function normalizzaTelefono(grezzo) {
  const pulito = String(grezzo).replace(/[\s.\-()/]/g, '');
  let numero;
  if (pulito.startsWith('+')) numero = pulito;
  else if (pulito.startsWith('00')) numero = `+${pulito.slice(2)}`;
  else numero = `+39${pulito.replace(/^0+/, '')}`;
  return /^\+[1-9]\d{7,14}$/.test(numero) ? numero : null;
}
