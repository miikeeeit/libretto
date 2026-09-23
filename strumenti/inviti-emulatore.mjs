// Crea codici di invito nell'emulatore Firestore, per provare l'accesso in locale.
// Sul progetto vero i codici si creano dalla console Firebase (vedi README).
//
//   node strumenti/inviti-emulatore.mjs mike-2026 somma-2026
//
// Vuole l'emulatore già avviato (`npm run emulatori`).

import { scriviDocumento } from './emulatore.mjs';

const codici = process.argv.slice(2).map((c) => c.trim().toLowerCase().replace(/\s+/g, ''));
if (codici.length === 0) {
  console.error('Uso: node strumenti/inviti-emulatore.mjs <codice> [altro-codice…]');
  process.exit(1);
}

for (const codice of codici) {
  try {
    await scriviDocumento('inviti', codice, {
      attivo: { booleanValue: true },
      usatoDa: { nullValue: null },
      nota: { stringValue: 'creato da strumenti/inviti-emulatore.mjs' },
    });
    console.log(`✓ ${codice}`);
  } catch (errore) {
    console.error(`✗ ${codice}: ${errore.message}`);
    process.exitCode = 1;
  }
}
