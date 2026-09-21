// Prova del flusso vero con un browser, dall'accesso al libretto.
// È il criterio della settimana 1 — «ti registri e vedi il tuo profilo» — trasformato
// in qualcosa che si può rilanciare ogni volta che si tocca il codice.
// Qui dentro cresceranno i test di rottura della settimana 5.
//
// Serve tutto in piedi, in tre terminali:
//   1) npm run emulatori
//   2) npm run dev
//   3) node strumenti/prova-flusso.mjs
//
// La prima volta serve anche il browser: npx playwright install chromium
//
// Svuota gli emulatori a ogni giro, quindi non si lancia mai contro il progetto vero.

import { chromium } from 'playwright';

const BASE = process.env.LIBRETTO_BASE ?? 'http://127.0.0.1:5173';
const PROGETTO = process.env.LIBRETTO_PROGETTO ?? 'libretto-prova';
const FIRESTORE = process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080';
const AUTH = process.env.FIREBASE_AUTH_EMULATOR_HOST ?? '127.0.0.1:9099';
const CARTELLA = process.env.LIBRETTO_SCHERMATE ?? null;
const INVITO = 'prova-2026';

async function azzeraEmulatori() {
  await fetch(`http://${FIRESTORE}/emulator/v1/projects/${PROGETTO}/databases/(default)/documents`, {
    method: 'DELETE',
  });
  await fetch(`http://${AUTH}/emulator/v1/projects/${PROGETTO}/accounts`, { method: 'DELETE' });
  await fetch(
    `http://${FIRESTORE}/v1/projects/${PROGETTO}/databases/(default)/documents/inviti?documentId=${INVITO}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer owner' },
      body: JSON.stringify({ fields: { attivo: { booleanValue: true }, usatoDa: { nullValue: null } } }),
    },
  );
}

/** Il codice che l'emulatore avrebbe mandato via SMS. */
async function codiceSms() {
  const risposta = await fetch(`http://${AUTH}/emulator/v1/projects/${PROGETTO}/verificationCodes`);
  const { verificationCodes } = await risposta.json();
  return verificationCodes.at(-1)?.code;
}

async function schermata(page, nome) {
  if (CARTELLA) await page.screenshot({ path: `${CARTELLA}/${nome}.png` });
}

await azzeraEmulatori();

const browser = await chromium.launch();
// Le misure di un telefono, perché è da lì che la gente lo aprirà.
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });

const problemi = [];
page.on('pageerror', (e) => problemi.push(`errore di pagina: ${e}`));
page.on('response', (r) => {
  // L'emulatore Auth non implementa la configurazione di reCAPTCHA: succede solo in locale.
  if (r.status() >= 400 && !r.url().includes('recaptchaConfig')) {
    problemi.push(`HTTP ${r.status()} ${r.url()}`);
  }
});

let passi = 0;
function fatto(testo) {
  passi += 1;
  console.log(`${passi}. ${testo}`);
}

async function accedi(telefono, invito = INVITO) {
  await page.getByLabel('Codice di invito').fill(invito);
  await page.getByLabel('Il tuo numero di cellulare').fill(telefono);
  await page.getByText('Ho almeno 18 anni.').click();
  await page.getByText('Ho letto l’informativa').click();
  await page.getByRole('button', { name: 'Mandami il codice' }).click();
}

try {
  // ---- L1: accesso col telefono -------------------------------------------
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await schermata(page, '1-accesso');
  await accedi('347 123 4567');
  await page.getByRole('heading', { name: 'Scrivi il codice' }).waitFor({ timeout: 20000 });
  fatto('codice SMS chiesto al numero indicato');

  const codice = await codiceSms();
  if (!codice) throw new Error('Nessun codice nell’emulatore Auth.');
  await page.getByLabel('Codice di sei cifre').fill(codice);
  await page.getByRole('button', { name: 'Entra' }).click();

  // ---- L2: crea il profilo -------------------------------------------------
  await page.getByRole('heading', { name: /Crea il tuo libretto/i }).waitFor({ timeout: 20000 });
  fatto('telefono verificato, si passa alla creazione del profilo');

  await page.getByLabel('Nome', { exact: true }).fill('Mario');
  await page.getByLabel('Cognome').fill('Rossi');
  await page.getByLabel('Il ruolo che fai più spesso').selectOption('sala');
  await page.getByLabel('Il tuo comune').fill('terra');
  await page.getByRole('button', { name: 'Terracina' }).click();
  await schermata(page, '2-profilo');
  await page.getByRole('button', { name: /Crea il mio libretto/i }).click();

  // ---- L3: il mio libretto -------------------------------------------------
  await page.getByRole('heading', { name: 'Mario Rossi' }).waitFor({ timeout: 20000 });
  const sottotitolo = await page.locator('.sottotitolo').innerText();
  const indirizzo = await page.locator('.piede code').innerText();
  fatto(`profilo creato: ${sottotitolo}, indirizzo pubblico ${indirizzo}`);

  await page.getByText(/Disponibile per la stagione/).click();
  await page.waitForTimeout(1500);
  await schermata(page, '3-libretto');

  await page.reload({ waitUntil: 'load' });
  await page.getByRole('heading', { name: 'Mario Rossi' }).waitFor({ timeout: 20000 });
  if (!(await page.locator('.interruttore input').isChecked())) {
    throw new Error('La disponibilità non è stata salvata.');
  }
  fatto('dopo il ricarico è ancora collegato e la disponibilità è salvata');

  // ---- Il codice di invito è bruciato --------------------------------------
  await page.getByRole('button', { name: /Esci da Libretto/ }).click();
  await page.getByRole('heading', { name: 'Entra col tuo numero' }).waitFor({ timeout: 20000 });
  await accedi('348 999 8877');
  const avviso = await page.locator('.errore').innerText({ timeout: 20000 });
  if (!avviso.includes('già stato usato')) throw new Error(`Avviso inatteso: "${avviso}"`);
  fatto(`un secondo numero non riusa lo stesso invito: "${avviso}"`);

  // ---- Un codice inventato non fa partire nessun SMS ----------------------
  await page.reload({ waitUntil: 'load' });
  await accedi('349 111 2233', 'non-esiste');
  const avviso2 = await page.locator('.errore').innerText({ timeout: 20000 });
  if (!avviso2.includes('non esiste')) throw new Error(`Avviso inatteso: "${avviso2}"`);
  fatto(`un codice inventato si ferma prima dell'SMS: "${avviso2}"`);

  if (problemi.length > 0) throw new Error(`Problemi nel browser:\n  ${problemi.join('\n  ')}`);
  console.log('\nTutto a posto.');
} catch (errore) {
  console.error(`\nPROVA FALLITA: ${errore.message}`);
  await schermata(page, 'errore');
  if (problemi.length > 0) console.error(`  ${problemi.join('\n  ')}`);
  process.exitCode = 1;
} finally {
  await browser.close();
}
