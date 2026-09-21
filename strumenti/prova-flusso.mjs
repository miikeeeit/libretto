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
const problemi = [];

function guarda(pagina, chi) {
  pagina.on('pageerror', (e) => problemi.push(`${chi}: errore di pagina: ${e}`));
  pagina.on('response', (r) => {
    // L'emulatore Auth non implementa la configurazione di reCAPTCHA: solo in locale.
    if (r.status() >= 400 && !r.url().includes('recaptchaConfig')) {
      problemi.push(`${chi}: HTTP ${r.status()} ${r.url()}`);
    }
  });
  return pagina;
}

// Le misure di un telefono, perché è da lì che la gente lo aprirà.
const SCHERMO = { viewport: { width: 390, height: 844 } };

// Il lavoratore e il responsabile sono due persone su due telefoni: due contesti
// separati, altrimenti si confermerebbe da solo — che è esattamente ciò che Libretto
// deve impedire.
const page = guarda(await (await browser.newContext(SCHERMO)).newPage(), 'lavoratore');

async function telefonoDelResponsabile(chi = 'responsabile') {
  const contesto = await browser.newContext(SCHERMO);
  return guarda(await contesto.newPage(), chi);
}

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

  // Salvata una stagione si arriva su L5, che è il senso di averla scritta: qui la
  // conferma la si chiede più avanti, quindi si torna al libretto.
  await page.getByRole('heading', { name: 'Chiedi la conferma' }).waitFor({ timeout: 20000 });
  await page.getByRole('link', { name: 'Torna al libretto' }).click();

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
  await page.getByRole('heading', { name: 'Chiedi la conferma' }).waitFor({ timeout: 20000 });
  await page.getByRole('link', { name: 'Torna al libretto' }).click();

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
  await page.locator('.elenco-stagioni li').nth(1).getByRole('link', { name: 'Correggi' }).click();
  await page.getByRole('heading', { name: 'Correggi la stagione' }).waitFor({ timeout: 20000 });
  await page.getByLabel('Che ruolo facevi').selectOption('cucina');
  await page.getByRole('button', { name: 'Salva le correzioni' }).click();
  await page.getByRole('heading', { name: 'Bar Somma' }).first().waitFor({ timeout: 20000 });
  const ruoloCorretto = await page.locator('.elenco-stagioni .sottotitolo').nth(1).innerText();
  if (!ruoloCorretto.startsWith('Cucina')) throw new Error(`Correzione non salvata: "${ruoloCorretto}"`);
  await schermata(page, '5-libretto-pieno');
  fatto(`stagione corretta: ora è "${ruoloCorretto}"`);

  // ---- L5: chiedere la conferma -------------------------------------------
  await page
    .locator('.elenco-stagioni li')
    .first()
    .getByRole('link', { name: 'Chiedi la conferma' })
    .click();
  await page.getByRole('heading', { name: 'Chiedi la conferma' }).waitFor({ timeout: 20000 });
  await page.getByLabel('Chi ti ha visto lavorare').fill('Ciro');
  await page.getByLabel('Il suo numero di cellulare').fill('348 111 2222');
  await page.getByRole('button', { name: 'Prepara il messaggio' }).click();

  const messaggio = await page.locator('.anteprima-messaggio').innerText({ timeout: 20000 });
  const token = /\/c\/([A-Za-z0-9_-]+)/.exec(messaggio)?.[1];
  if (!token) throw new Error(`Nessun link nel messaggio: "${messaggio}"`);
  if (!messaggio.startsWith('Ciao Ciro, sono Mario Rossi.')) {
    throw new Error(`Messaggio inatteso: "${messaggio}"`);
  }
  const whatsapp = await page.getByRole('link', { name: 'Manda su WhatsApp' }).getAttribute('href');
  if (!whatsapp?.startsWith('https://wa.me/393481112222?text=')) {
    throw new Error(`Link WhatsApp inatteso: ${whatsapp}`);
  }
  await schermata(page, '6-chiedi-conferma');
  fatto('richiesta creata, messaggio pronto per il WhatsApp del lavoratore');

  await page.getByRole('button', { name: 'Ho mandato il messaggio' }).click();
  const statoAttesa = await page.locator('.stato').first().innerText({ timeout: 20000 });
  if (statoAttesa.toLowerCase() !== 'in attesa') throw new Error(`Stato inatteso: "${statoAttesa}"`);
  fatto('la stagione è passata in attesa');

  // ---- C2: un numero che passa la maschera ma non è quello giusto ----------
  // 348 555 5522 ha le stesse cifre visibili di 348 111 2222: il controllo del client
  // lo lascia passare, e deve fermarlo il server. È la prova che conta.
  const impostore = await telefonoDelResponsabile('impostore');
  await impostore.goto(`${BASE}/c/${token}`, { waitUntil: 'load' });
  await impostore.getByRole('heading', { name: 'Per confermare, verifica il tuo numero' }).waitFor({ timeout: 20000 });
  await impostore.getByLabel('Il tuo numero di cellulare').fill('348 555 5522');
  await impostore.getByRole('button', { name: 'Mandami il codice' }).click();
  // Si aspetta la schermata del codice: l'emulatore lo elenca solo quando l'SMS è
  // davvero partito.
  await impostore.getByRole('heading', { name: 'Scrivi il codice' }).waitFor({ timeout: 20000 });
  await impostore.getByLabel('Codice di sei cifre').fill(await codiceSms());
  await impostore.getByRole('button', { name: 'Continua' }).click();
  await impostore
    .getByRole('heading', { name: 'Questo link è stato inviato a un altro numero' })
    .waitFor({ timeout: 20000 });
  await schermata(impostore, '7-numero-sbagliato');
  fatto('un altro numero, verificato per davvero, viene respinto dal server');

  // ---- C1-C4: la conferma vera ---------------------------------------------
  const responsabile = await telefonoDelResponsabile();
  await responsabile.goto(`${BASE}/c/${token}`, { waitUntil: 'load' });
  const righe = await responsabile.locator('.quattro-righe').innerText({ timeout: 20000 });
  if (!righe.includes('Mario Rossi') || !righe.includes('Bar Somma')) {
    throw new Error(`Le quattro righe non tornano: "${righe}"`);
  }
  if (righe.includes('347') || righe.includes('Ciro')) {
    throw new Error('La pagina di conferma mostra dati che non deve mostrare.');
  }
  // Il numero del responsabile non deve arrivare al browser nemmeno nascosto: se il
  // link finisse alla persona sbagliata, si porterebbe dietro il suo telefono.
  const sorgente = await responsabile.content();
  if (sorgente.includes('1112222') || sorgente.includes('111 2222')) {
    throw new Error('Il numero del responsabile è arrivato per intero nella pagina.');
  }
  await schermata(responsabile, '8-conferma-c1');

  await responsabile.getByLabel('Il tuo numero di cellulare').fill('348 111 2222');
  await responsabile.getByRole('button', { name: 'Mandami il codice' }).click();
  // Si aspetta la schermata del codice: l'emulatore lo elenca solo quando l'SMS è
  // davvero partito.
  await responsabile.getByRole('heading', { name: 'Scrivi il codice' }).waitFor({ timeout: 20000 });
  await responsabile.getByLabel('Codice di sei cifre').fill(await codiceSms());
  await responsabile.getByRole('button', { name: 'Continua' }).click();

  // C3: il responsabile toglie una competenza, aggiunge "lo riprenderei" e conferma.
  await responsabile.getByText('Togli quelle che non riconosci').waitFor({ timeout: 20000 });
  await responsabile.getByLabel('Caffetteria').uncheck();
  await responsabile.getByText('Lo riprenderei').click();
  await responsabile.getByLabel('Il tuo ruolo').selectOption('titolare');
  await responsabile.getByText('La mia conferma, senza il mio nome').click();
  await schermata(responsabile, '9-conferma-c3');
  await responsabile.getByRole('button', { name: 'Confermo, ha lavorato qui' }).click();

  await responsabile.getByRole('heading', { name: 'Fatto, grazie' }).waitFor({ timeout: 20000 });
  const grazie = await responsabile.locator('.scheda').innerText();
  if (!grazie.includes('Mario')) throw new Error(`Schermata finale inattesa: "${grazie}"`);
  await schermata(responsabile, '10-conferma-c4');
  fatto('conferma data dal numero giusto, con una competenza tolta e «lo riprenderei»');

  // ---- Il link non si riusa -------------------------------------------------
  const secondoGiro = await telefonoDelResponsabile('secondo giro');
  await secondoGiro.goto(`${BASE}/c/${token}`, { waitUntil: 'load' });
  await secondoGiro
    .getByRole('heading', { name: 'Questa conferma è già stata data. Grazie.' })
    .waitFor({ timeout: 20000 });
  fatto('lo stesso link non serve una seconda volta');

  // ---- Il libretto del lavoratore ------------------------------------------
  await page.reload({ waitUntil: 'load' });
  await page.locator('.stato--confermata').first().waitFor({ timeout: 20000 });
  const numeriFinali = await page.locator('.numeri').innerText();
  if (!numeriFinali.includes('1 confermata') || !numeriFinali.includes('1 lo riprenderebbe')) {
    throw new Error(`Numeri inattesi: "${numeriFinali}"`);
  }
  const conferma = await page.locator('.elenco-stagioni li').first().innerText();
  if (!conferma.includes('Confermata dal titolare')) {
    throw new Error(`Riga di conferma inattesa: "${conferma}"`);
  }
  if (conferma.includes('Caffetteria')) {
    throw new Error('Una competenza tolta dal responsabile risulta ancora confermata.');
  }
  if (!conferma.includes('Cassa e chiusura di cassa')) {
    throw new Error('La competenza confermata non compare.');
  }
  await schermata(page, '11-libretto-confermato');
  fatto(`il libretto vede la conferma: ${numeriFinali}`);

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
