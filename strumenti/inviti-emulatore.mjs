// Crea codici di invito nell'emulatore Firestore, per provare l'accesso in locale.
// Sul progetto vero i codici si creano dalla console Firebase (vedi README).
//
//   node strumenti/inviti-emulatore.mjs mike-2026 somma-2026
//
// Vuole l'emulatore già avviato (`npm run emulatori`).

import { readFile } from 'node:fs/promises';

const EMULATORE = process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080';

async function idProgetto() {
  if (process.env.GCLOUD_PROJECT) return process.env.GCLOUD_PROJECT;
  try {
    const contenuto = JSON.parse(await readFile(new URL('../.firebaserc', import.meta.url), 'utf8'));
    return contenuto.projects?.default ?? 'libretto';
  } catch {
    return 'libretto';
  }
}

const codici = process.argv.slice(2).map((c) => c.trim().toLowerCase().replace(/\s+/g, ''));
if (codici.length === 0) {
  console.error('Uso: node strumenti/inviti-emulatore.mjs <codice> [altro-codice…]');
  process.exit(1);
}

const progetto = await idProgetto();
const base = `http://${EMULATORE}/v1/projects/${progetto}/databases/(default)/documents/inviti`;

for (const codice of codici) {
  const risposta = await fetch(`${base}?documentId=${encodeURIComponent(codice)}`, {
    method: 'POST',
    // L'emulatore accetta "owner" come token di amministratore: scrive saltando le regole.
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer owner' },
    body: JSON.stringify({
      fields: {
        attivo: { booleanValue: true },
        usatoDa: { nullValue: null },
        nota: { stringValue: 'creato da strumenti/inviti-emulatore.mjs' },
      },
    }),
  });

  if (risposta.ok) {
    console.log(`✓ ${codice}`);
  } else {
    console.error(`✗ ${codice}: ${risposta.status} ${await risposta.text()}`);
    process.exitCode = 1;
  }
}
