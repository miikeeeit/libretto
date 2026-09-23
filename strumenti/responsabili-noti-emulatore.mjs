// §8.3, PC4 · I responsabili che l'admin conosce di persona.
//
// Un numero che sta in questa lista diventa «noto» alla sua prima conferma, senza dover
// rincorrere il documento giusto in console dopo.
//
//   node strumenti/responsabili-noti-emulatore.mjs "347 123 4567=Bar Somma" "348 000 1111=Oasi"
//
// Sul progetto vero i numeri si aggiungono a mano dalla console (vedi README): sono due
// o tre, e così non serve scaricare una chiave di amministratore sul computer.
//
// Vuole l'emulatore già avviato (`npm run emulatori`).

import { normalizzaTelefono, scriviDocumento } from './emulatore.mjs';

const voci = process.argv.slice(2);
if (voci.length === 0) {
  console.error('Uso: node strumenti/responsabili-noti-emulatore.mjs "<numero>=<nota>" […]');
  process.exit(1);
}

for (const voce of voci) {
  const [grezzo, ...resto] = voce.split('=');
  const numero = normalizzaTelefono(grezzo ?? '');
  const nota = resto.join('=').trim();

  if (!numero) {
    console.error(`✗ ${grezzo}: non sembra un numero valido`);
    process.exitCode = 1;
    continue;
  }

  try {
    await scriviDocumento('responsabiliNoti', numero, {
      // La nota è solo per te: serve a ricordarti di chi è il numero.
      nota: { stringValue: nota || 'senza nota' },
      aggiuntoIl: { timestampValue: new Date().toISOString() },
    });
    console.log(`✓ ${numero}${nota ? ` · ${nota}` : ''}`);
  } catch (errore) {
    console.error(`✗ ${numero}: ${errore.message}`);
    process.exitCode = 1;
  }
}
