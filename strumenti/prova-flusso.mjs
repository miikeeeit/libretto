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

  // ---- L4: la prima stagione, con una struttura nuova ----------------------
  await page.getByRole('link', { name: 'Aggiungi stagione' }).click();
  await page.getByRole('heading', { name: 'Aggiungi una stagione' }).waitFor({ timeout: 20000 });

  await page.getByLabel('Dove hai lavorato').fill('Bar Somma');
  await page.getByRole('button', { name: /^Aggiungi «Bar Somma»$/ }).click();
  await page.getByLabel('In che comune è').fill('terra');
  await page.getByRole('button', { name: 'Terracina' }).click();
  await page.getByLabel('Che ruolo facevi').selectOption('bar');
  await page.getByLabel('Mese di inizio').selectOption('5');
  await page.getByLabel('Mese di fine').selectOption('9');
  await page.getByLabel('Caffetteria').check();
  await page.getByLabel('Cassa e chiusura di cassa').check();
  await schermata(page, '4-stagione');
  await page.getByRole('button', { name: 'Salva la stagione' }).click();

  await page.getByRole('heading', { name: 'Bar Somma' }).waitFor({ timeout: 20000 });
  const numeri1 = await page.locator('.numeri').innerText();
  const stato1 = await page.locator('.stato').first().innerText();
  if (!numeri1.includes('1 stagione')) throw new Error(`Numeri inattesi: "${numeri1}"`);
  if (stato1.toLowerCase() !== 'bozza') throw new Error(`Stato inatteso: "${stato1}"`);
  fatto(`stagione salvata in bozza: ${numeri1}`);

  // ---- L4: la seconda, ritrovando la struttura dall'autocompletamento ------
  // Si scrive "somma", non "bar somma": è il modo in cui la gente cerca, e se qui
  // non la ritrova nascono due strutture uguali e «confermata da 2» diventa falso.
  await page.getByRole('link', { name: 'Aggiungi stagione' }).click();
  await page.getByRole('heading', { name: 'Aggiungi una stagione' }).waitFor({ timeout: 20000 });
  await page.getByLabel('Dove hai lavorato').fill('somma');
  await page.locator('.suggerimenti button', { hasText: 'Bar Somma' }).click({ timeout: 20000 });
  await page.getByLabel('Che ruolo facevi').selectOption('sala');
  await page.getByLabel('Mese di inizio').selectOption('6');
  await page.getByLabel('Anno di inizio').selectOption('2024');
  await page.getByLabel('Mese di fine').selectOption('8');
  await page.getByLabel('Anno di fine').selectOption('2024');
  await page.getByRole('button', { name: 'Salva la stagione' }).click();

  await page.locator('.elenco-stagioni li').nth(1).waitFor({ timeout: 20000 });
  const numeri2 = await page.locator('.numeri').innerText();
  if (!numeri2.includes('2 stagioni')) throw new Error(`Numeri inattesi: "${numeri2}"`);
  const strutture = await page.locator('.elenco-stagioni h3').allInnerTexts();
  if (strutture.length !== 2 || new Set(strutture).size !== 1) {
    throw new Error(`La struttura non è stata riusata: ${JSON.stringify(strutture)}`);
  }
  fatto(`seconda stagione sulla stessa struttura: ${numeri2}`);

  // Dalla più recente: la stagione del 2026 sta sopra quella del 2024.
  const periodi = await page.locator('.elenco-stagioni .aiuto').allInnerTexts();
  if (!periodi[0]?.includes('2026')) throw new Error(`Ordine inatteso: ${JSON.stringify(periodi)}`);
  fatto(`stagioni in ordine, dalla più recente: ${periodi[0]} poi ${periodi[1]}`);

  // ---- Correggere una stagione --------------------------------------------
  await page.locator('.elenco-stagioni li').first().getByRole('link', { name: 'Correggi' }).click();
  await page.getByRole('heading', { name: 'Correggi la stagione' }).waitFor({ timeout: 20000 });
  await page.getByLabel('Che ruolo facevi').selectOption('cucina');
  await page.getByRole('button', { name: 'Salva le correzioni' }).click();
  await page.getByRole('heading', { name: 'Bar Somma' }).first().waitFor({ timeout: 20000 });
  const ruoloCorretto = await page.locator('.elenco-stagioni .sottotitolo').first().innerText();
  if (!ruoloCorretto.startsWith('Cucina')) throw new Error(`Correzione non salvata: "${ruoloCorretto}"`);
  await schermata(page, '5-libretto-pieno');
  fatto(`stagione corretta: ora è "${ruoloCorretto}"`);

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
