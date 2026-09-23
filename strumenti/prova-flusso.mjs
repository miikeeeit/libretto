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
const FUNZIONI = process.env.LIBRETTO_FUNZIONI ?? '127.0.0.1:5001';
const CARTELLA = process.env.LIBRETTO_SCHERMATE ?? null;
const INVITO = 'prova-2026';
const RESPONSABILE_NOTO = '+393481112222';

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
  // §8.3 (PC4): il numero del responsabile della prova è uno di quelli che l'admin
  // conosce di persona, così si verifica che il flag scatti alla prima conferma.
  await fetch(
    `http://${FIRESTORE}/v1/projects/${PROGETTO}/databases/(default)/documents/responsabiliNoti?documentId=${encodeURIComponent(RESPONSABILE_NOTO)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer owner' },
      body: JSON.stringify({ fields: { nota: { stringValue: 'Bar Somma' } } }),
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

/**
 * La pagina pubblica la ricostruisce una Cloud Function dopo la scrittura, quindi non è
 * pronta nell'istante in cui si cambia un'impostazione: si ricarica finché non lo è.
 */
async function aspettaChe(pagina, condizione, descrizione, tentativi = 15) {
  for (let i = 0; i < tentativi; i += 1) {
    await pagina.reload({ waitUntil: 'load' });
    await pagina.waitForTimeout(500);
    if (await condizione(pagina)) return;
  }
  throw new Error(`Non è cambiato come doveva: ${descrizione}`);
}

async function testoDi(pagina) {
  return (await pagina.locator('body').innerText()).replace(/\s+/g, ' ');
}

/**
 * Confronto senza distinguere maiuscole e minuscole: alcune etichette sono scritte in
 * maiuscolo dal CSS, e quello che conta è che la frase ci sia.
 */
function contiene(testo, frase) {
  return testo.toLowerCase().includes(frase.toLowerCase());
}

/** Un PDF minimo ma valido, per provare il caricamento del CV. */
function pdfFinto() {
  return Buffer.from(
    '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n' +
      '2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n' +
      '3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj\n' +
      'trailer<</Root 1 0 R>>\n%%EOF\n',
  );
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
  const indirizzo = await page.getByRole('link', { name: 'Vedi la mia pagina' }).getAttribute('href');
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

  // ---- §8.3: il responsabile noto ------------------------------------------
  // Il flag non si vede da nessuna parte nella v1, quindi si guarda nel database:
  // serve ai controlli dell'admin e alla ricerca di gennaio.
  const responsabili = await fetch(
    `http://${FIRESTORE}/v1/projects/${PROGETTO}/databases/(default)/documents/responsabili`,
    { headers: { Authorization: 'Bearer owner' } },
  ).then((r) => r.json());
  const noto = (responsabili.documents ?? []).some(
    (d) => d.fields?.verificatoAdmin?.booleanValue === true,
  );
  if (!noto) throw new Error('Il numero in lista non è stato segnato come responsabile noto.');
  fatto('un numero della lista dell’admin è noto già dalla prima conferma');

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

  // ---- P1: la pagina pubblica, dal telefono di un altro --------------------
  // Il criterio della settimana 4: «apri il tuo link dal telefono di un altro e vedi
  // solo quello che devi vedere». Il datore non è collegato e non ha niente a che fare
  // con Libretto.
  const indirizzoPubblico = await page
    .getByRole('link', { name: 'Vedi la mia pagina' })
    .getAttribute('href');
  const slug = (indirizzoPubblico ?? '').replace('/p/', '');
  if (!slug) throw new Error('Non trovo il link della pagina pubblica in L3.');
  const datore = await telefonoDelResponsabile('datore');
  await datore.goto(`${BASE}/p/${slug}`, { waitUntil: 'load' });
  await datore.getByRole('heading', { name: 'Mario Rossi' }).waitFor({ timeout: 20000 });

  let pubblica = await testoDi(datore);
  // La frase in cima deve nominare chi ha confermato: è la risposta alla sola domanda
  // che si fa un datore, e nominare il Bar Somma dice più di «1 struttura».
  if (!contiene(pubblica, 'Bar Somma ha confermato una stagione di Mario')) {
    throw new Error(`Dichiarazione pubblica inattesa: "${pubblica}"`);
  }
  if (!contiene(pubblica, 'lo riprenderebbe')) {
    throw new Error('Manca la riga di «lo riprenderebbe» in pubblico.');
  }
  if (!contiene(pubblica, 'Confermata dal titolare') || !contiene(pubblica, 'Lo riprenderebbe')) {
    throw new Error('La stagione confermata non è mostrata come si deve.');
  }
  if (!contiene(pubblica, 'Cassa e chiusura di cassa')) {
    throw new Error('La competenza confermata non compare in pubblico.');
  }
  // Quello che NON si deve vedere: il telefono (spento per default), le stagioni in
  // bozza, e il nome di chi ha confermato.
  if (contiene(pubblica, 'Contatta su WhatsApp')) throw new Error('Il telefono è visibile senza averlo acceso.');
  if (contiene(pubblica, 'Ciro')) throw new Error('Il nome del responsabile è finito in pubblico.');
  if (contiene(pubblica, 'Cucina')) throw new Error('Una stagione in bozza è visibile in pubblico.');
  const sorgentePubblica = await datore.content();
  if (sorgentePubblica.includes('3471234567') || sorgentePubblica.includes('347 123 4567')) {
    throw new Error('Il numero del lavoratore è arrivato nella pagina pubblica.');
  }
  await schermata(datore, '12-pagina-pubblica');
  fatto('la pagina pubblica mostra le conferme e tiene nascosto il resto');

  // ---- L6: gli interruttori della privacy ----------------------------------
  await page.getByRole('link', { name: 'Impostazioni e privacy' }).click();
  await page.getByRole('heading', { name: 'Impostazioni e privacy' }).waitFor({ timeout: 20000 });
  await page.getByText('Mostra il mio numero').click();
  await aspettaChe(
    datore,
    async (p) => contiene(await testoDi(p), 'Contatta su WhatsApp'),
    'il numero acceso deve far comparire il pulsante WhatsApp',
  );
  fatto('accendendo «mostra il mio numero» compare il pulsante WhatsApp');

  // Nascondere la stagione confermata la toglie dalla pagina, non dal libretto.
  await page.getByText('Bar Somma · Bar').click();
  await aspettaChe(
    datore,
    async (p) => !contiene(await testoDi(p), 'Confermata dal titolare'),
    'la stagione nascosta deve sparire dalla pagina pubblica',
  );
  const senzaStagione = await testoDi(datore);
  if (!contiene(senzaStagione, 'Nessuno ha ancora confermato le stagioni di Mario')) {
    throw new Error(`Dichiarazione inattesa dopo aver nascosto: "${senzaStagione}"`);
  }
  await page.getByText('Bar Somma · Bar').click();
  await aspettaChe(
    datore,
    async (p) => contiene(await testoDi(p), 'Confermata dal titolare'),
    'rimostrando la stagione deve ricomparire',
  );
  fatto('nascondere e rimostrare una stagione funziona in entrambi i versi');

  // Il CV: privato, con un indirizzo che scade.
  await page.locator('#cv').setInputFiles({ name: 'cv.pdf', mimeType: 'application/pdf', buffer: pdfFinto() });
  await page.getByText('Mostra il CV sul mio profilo').waitFor({ timeout: 20000 });
  await page.getByText('Mostra il CV sul mio profilo').click();
  await aspettaChe(
    datore,
    async (p) => contiene(await testoDi(p), 'Scarica il CV'),
    'il CV acceso deve comparire in pubblico',
  );
  // Il pulsante c'è. Che il file sia davvero raggiungibile solo passando dal server si
  // prova chiamando la funzione direttamente: in un browser un PDF diventa un download,
  // e si finirebbe a provare Chromium invece di Libretto.
  const rispostaCv = await fetch(`http://${FUNZIONI}/${PROGETTO}/europe-west8/urlCv`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data: { slug } }),
  });
  const indirizzoCv = (await rispostaCv.json())?.result?.url;
  if (!indirizzoCv || !/cv(%2F|\/)/i.test(indirizzoCv)) {
    throw new Error(`Indirizzo del CV inatteso: ${indirizzoCv}`);
  }
  if (!(await fetch(indirizzoCv)).ok) throw new Error('Il CV non si scarica da quell’indirizzo.');

  // Lo stesso file, senza il permesso dato dal server, non si deve poter leggere: il CV
  // è privato, a differenza della foto (§10).
  const senzaPermesso = await fetch(indirizzoCv.split(/[?&]token=/)[0]);
  if (senzaPermesso.ok) throw new Error('Il CV si legge anche senza passare dal server.');
  fatto('il CV si scarica solo dall’indirizzo dato dal server, non a mano');

  // Il link spento: la pagina non è più disponibile per nessuno.
  await page.getByText('Il mio link funziona').click();
  await aspettaChe(
    datore,
    async (p) => contiene(await testoDi(p), 'Questa pagina non è disponibile'),
    'spegnendo il link la pagina deve sparire',
  );
  await schermata(datore, '13-link-spento');
  await page.getByText('Il mio link funziona').click();
  await aspettaChe(
    datore,
    async (p) => contiene(await testoDi(p), 'Mario Rossi'),
    'riaccendendo il link la pagina deve tornare',
  );
  fatto('spegnendo il link la pagina pubblica sparisce, e riaccendendolo torna');

  // Esportazione dei dati.
  const [scaricato] = await Promise.all([
    page.waitForEvent('download', { timeout: 20000 }),
    page.getByRole('button', { name: 'Scarica i miei dati' }).click(),
  ]);
  if (!scaricato.suggestedFilename().startsWith('libretto-')) {
    throw new Error(`Nome del file inatteso: ${scaricato.suggestedFilename()}`);
  }
  fatto(`i dati si scaricano: ${scaricato.suggestedFilename()}`);

  // ---- L6: eliminare l'account -------------------------------------------
  // §1, regola 3: con un tap sparisce tutto. È la prova che la promessa è vera.
  await page.getByRole('button', { name: 'Voglio eliminare il mio account' }).click();
  await page.getByLabel('Scrivi ELIMINA').fill('ELIMINA');
  await page.getByRole('button', { name: 'Elimina tutto' }).click();
  await page.getByRole('heading', { name: 'Entra col tuo numero' }).waitFor({ timeout: 40000 });

  await aspettaChe(
    datore,
    async (p) => contiene(await testoDi(p), 'Questa pagina non è disponibile'),
    'dopo l’eliminazione il link pubblico non deve funzionare',
  );

  // E nel database non resta niente di suo.
  const rimasti = await fetch(
    `http://${FIRESTORE}/v1/projects/${PROGETTO}/databases/(default)/documents/workers`,
    { headers: { Authorization: 'Bearer owner' } },
  ).then((r) => r.json());
  if ((rimasti.documents ?? []).length !== 0) throw new Error('Il profilo è ancora nel database.');

  const confermeRimaste = await fetch(
    `http://${FIRESTORE}/v1/projects/${PROGETTO}/databases/(default)/documents/conferme`,
    { headers: { Authorization: 'Bearer owner' } },
  ).then((r) => r.json());
  if ((confermeRimaste.documents ?? []).length !== 0) {
    throw new Error('Le conferme ricevute sono ancora nel database.');
  }
  fatto('eliminando l’account sparisce tutto: profilo, conferme e pagina pubblica');

  // ---- Il codice di invito è bruciato --------------------------------------
  // Dopo l'eliminazione si è già fuori: si prova a rientrare con lo stesso invito.
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
