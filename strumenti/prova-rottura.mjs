// I test di rottura della settimana 5 (§11).
//
// Il criterio è «nessun caso rompe l'app», e i casi sono quelli in cui qualcuno prova a
// ottenere una conferma che non gli spetta, o in cui qualcosa va storto a metà. Qui non
// si passa da un browser: si chiamano le funzioni come le chiamerebbe qualcuno che ha
// scritto il suo client a mano, perché è così che si attacca un'app. Se un controllo
// esiste solo nell'interfaccia, questa prova lo scopre.
//
// Vuole emulatori avviati (`npm run emulatori`). Non serve `npm run dev`.
//
//   node strumenti/prova-rottura.mjs

import { createRequire } from 'node:module';
import { normalizzaTelefono, scriviDocumento } from './emulatore.mjs';

// Il codice della pulizia notturna si importa e si esegue per davvero, contro gli
// emulatori. Vuole le funzioni compilate: `npm --prefix functions run build`.
//
// Tutti e tre gli emulatori che la pulizia tocca, non solo Firestore: senza le altre due
// righe gli accessi e i file andavano ai servizi veri di Google, con le credenziali che
// il computer ha in tasca. Su un Mac con `gcloud` configurato la pulizia falliva a metà
// («No Firebase project was found») e la prova si fermava lì (2026-10-19).
process.env.FIRESTORE_EMULATOR_HOST ??= '127.0.0.1:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST ??= '127.0.0.1:9099';
process.env.FIREBASE_STORAGE_EMULATOR_HOST ??= '127.0.0.1:9199';
process.env.GCLOUD_PROJECT ??= process.env.LIBRETTO_PROGETTO ?? 'libretto-prova';
const { eseguiPulizia } = await import('../functions/lib/pulizia.js');
// Anche le chiamate che devono partire nello stesso istante si eseguono qui dentro:
// l'emulatore delle funzioni le mette in fila una dopo l'altra, mentre online girano
// davvero insieme, e una gara fra due chiamate lì non si vedrebbe mai.
const { confermaStagione, segnalaStagione, revocaConferma } = await import('../functions/lib/conferme.js');
const { creaRichiesta } = await import('../functions/lib/richieste.js');
// Per le gare riprodotte a comando (vedi `inMezzo`) e per la pagina pubblica ricostruita
// qui dentro. `db` è la stessa copia di Firestore che usano le funzioni compilate.
const { db } = await import('../functions/lib/comune.js');
const { ricostruisciProfiloPubblico } = await import('../functions/lib/profilo.js');
const { dopoStagioneCancellata } = await import('../functions/lib/stagioniCancellate.js');
// Lo stesso Timestamp che usa la pulizia, per farla girare «fra 91 giorni».
const requireFunzioni = createRequire(new URL('../functions/package.json', import.meta.url));
const { Timestamp } = requireFunzioni('firebase-admin/firestore');
const { getStorage } = requireFunzioni('firebase-admin/storage');

const PROGETTO = process.env.LIBRETTO_PROGETTO ?? 'libretto-prova';
const FIRESTORE = process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080';
const AUTH = process.env.FIREBASE_AUTH_EMULATOR_HOST ?? '127.0.0.1:9099';
const FUNZIONI = process.env.LIBRETTO_FUNZIONI ?? '127.0.0.1:5001';
const REGIONE = 'europe-west8';
// Il bucket di default dell'emulatore delle funzioni, quello che usa `eliminaAccount`:
// `FIREBASE_CONFIG` dell'emulatore dice `<progetto>.appspot.com`. Il controllo positivo
// della prova LF-11 (un file indicato nel profilo che oggi si cancella) lo conferma ogni
// volta: se il bucket fosse un altro, quel controllo diventerebbe rosso.
const BUCKET = process.env.LIBRETTO_BUCKET ?? `${PROGETTO}.appspot.com`;

const documenti = `http://${FIRESTORE}/v1/projects/${PROGETTO}/databases/(default)/documents`;

// ---------------------------------------------------------------- utilità

let passate = 0;
const fallite = [];

function ok(descrizione) {
  passate += 1;
  console.log(`  ✓ ${descrizione}`);
}

function no(descrizione, dettaglio) {
  fallite.push(`${descrizione} — ${dettaglio}`);
  console.log(`  ✗ ${descrizione}\n      ${dettaglio}`);
}

async function titolo(testo) {
  console.log(`\n${testo}`);
}

async function azzera() {
  await fetch(`${documenti.replace('/v1/', '/emulator/v1/')}`, { method: 'DELETE' });
  await fetch(`http://${AUTH}/emulator/v1/projects/${PROGETTO}/accounts`, { method: 'DELETE' });
}

/** Un utente verificato via telefono, con il suo gettone, come fosse entrato dall'app. */
async function entra(telefonoGrezzo) {
  const numero = normalizzaTelefono(telefonoGrezzo);
  const chiave = 'chiave-finta-per-emulatori';

  const inizio = await fetch(
    `http://${AUTH}/identitytoolkit.googleapis.com/v1/accounts:sendVerificationCode?key=${chiave}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phoneNumber: numero }),
    },
  ).then((r) => r.json());

  const codici = await fetch(`http://${AUTH}/emulator/v1/projects/${PROGETTO}/verificationCodes`).then(
    (r) => r.json(),
  );
  const codice = codici.verificationCodes.at(-1)?.code;

  const accesso = await fetch(
    `http://${AUTH}/identitytoolkit.googleapis.com/v1/accounts:signInWithPhoneNumber?key=${chiave}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionInfo: inizio.sessionInfo, code: codice }),
    },
  ).then((r) => r.json());

  if (!accesso.idToken) throw new Error(`Accesso fallito per ${numero}: ${JSON.stringify(accesso)}`);
  return { uid: accesso.localId, telefono: numero, gettone: accesso.idToken };
}

/** Chiama una funzione come la chiamerebbe l'app (o chi si è scritto il client a mano). */
async function chiama(nome, dati, chi = null) {
  const risposta = await fetch(`http://${FUNZIONI}/${PROGETTO}/${REGIONE}/${nome}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(chi ? { Authorization: `Bearer ${chi.gettone}` } : {}),
    },
    body: JSON.stringify({ data: dati }),
  });
  const corpo = await risposta.json().catch(() => ({}));
  return { ok: risposta.ok && !corpo.error, risultato: corpo.result, errore: corpo.error };
}

/**
 * Come `chiama`, ma dentro questo processo, per due chiamate che devono partire davvero
 * insieme (vedi sopra). Chi chiama arriva con il suo uid e il telefono verificato, come
 * glieli darebbe Firebase.
 */
async function chiamaInsieme(funzione, dati, chi) {
  try {
    const risultato = await funzione.run({
      data: dati,
      auth: { uid: chi.uid, token: { phone_number: chi.telefono } },
    });
    return { ok: true, risultato };
  } catch (errore) {
    return { ok: false, errore: { message: errore?.message ?? String(errore) } };
  }
}

async function deveFallire(descrizione, promessa) {
  const esito = await promessa;
  if (esito.ok) no(descrizione, 'la chiamata è andata a buon fine, e non doveva');
  else ok(`${descrizione} → «${esito.errore?.message ?? 'rifiutata'}»`);
  return esito;
}

async function deveRiuscire(descrizione, promessa) {
  const esito = await promessa;
  if (esito.ok) ok(descrizione);
  else no(descrizione, esito.errore?.message ?? 'rifiutata');
  return esito;
}

/** L'accesso con questo uid esiste ancora nell'emulatore Auth? */
async function esisteAccesso(uid) {
  const risposta = await fetch(
    `http://${AUTH}/identitytoolkit.googleapis.com/v1/projects/${PROGETTO}/accounts:lookup`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer owner' },
      body: JSON.stringify({ localId: [uid] }),
    },
  ).then((r) => r.json());
  return (risposta.users ?? []).length > 0;
}

async function leggi(percorso) {
  const risposta = await fetch(`${documenti}/${percorso}`, {
    headers: { Authorization: 'Bearer owner' },
  });
  return risposta.ok ? risposta.json() : null;
}

async function scriviCampi(percorso, campi) {
  const chiavi = Object.keys(campi)
    .map((c) => `updateMask.fieldPaths=${c}`)
    .join('&');
  await fetch(`${documenti}/${percorso}?${chiavi}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer owner' },
    body: JSON.stringify({ fields: campi }),
  });
}

/**
 * Scrive dei campi come li scriverebbe il client del lavoratore: col suo gettone, quindi
 * passando dalle regole (a differenza di `scriviCampi`, che le scavalca). Restituisce lo
 * stato HTTP: 200 se le regole lo lasciano fare.
 */
async function scriviComeUtente(percorso, campi, utente) {
  const chiavi = Object.keys(campi)
    .map((c) => `updateMask.fieldPaths=${c}`)
    .join('&');
  const risposta = await fetch(`${documenti}/${percorso}?${chiavi}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${utente.gettone}` },
    body: JSON.stringify({ fields: campi }),
  });
  return risposta.status;
}

const attendi = (ms) => new Promise((fine) => setTimeout(fine, ms));

// ---- Le gare a comando --------------------------------------------------
// Le gare vere (due chiamate nello stesso istante) riescono a volte sì e a volte no. Per
// provare un difetto che sta in una finestra stretta fra «il codice ha letto» e «il codice
// scrive», qui si fa succedere un'azione **subito dopo** una lettura, prima che il codice
// che l'ha chiesta riprenda. Così la gara si riproduce sempre, non a volte.
//
// Funziona agganciandosi a `Query.get`, la stessa copia che usano le funzioni compilate
// (le letture `collection().get()` e `collectionGroup().get()` ci passano da lì, perché
// ereditano da `Query`). Non vede le letture dentro una transazione (`tx.get`) né i
// documenti singoli (`doc().get()`): quelle non passano da `Query.get`.
const prototipoQuery = Object.getPrototypeOf(db.collection('x').where('a', '==', 1));
const getOriginale = prototipoQuery.get;
if (
  db.collection('x').get !== getOriginale ||
  db.collectionGroup('x').get !== getOriginale ||
  db.doc('x/y').get === getOriginale
) {
  throw new Error('L’aiuto per le gare non è valido: Query.get non è più la lettura di collezioni e gruppi.');
}

/** Cosa fare dopo la prossima lettura che restituisce un documento voluto. Una volta sola. */
let dopoLaLettura = null;
/** Se è un elenco, tutti i percorsi dei documenti restituiti da ogni lettura. */
let registro = null;

prototipoQuery.get = async function (...argomenti) {
  const risultato = await getOriginale.apply(this, argomenti);
  if (registro) registro.push(...risultato.docs.map((d) => d.ref.path));
  const scatto = dopoLaLettura;
  if (scatto && risultato.docs.some((d) => scatto.quale(d.ref.path))) {
    // Una volta sola, e prima dell'azione: l'azione legge anche lei.
    dopoLaLettura = null;
    await scatto.azione();
  }
  return risultato;
};

/**
 * Arma l'azione: scatta dopo la prossima lettura che restituisce un documento per cui
 * `quale(percorso)` è vero. Restituisce lo stato, da guardare dopo: `scattata` (la lettura
 * è davvero avvenuta, altrimenti la prova non ha provato niente), `esito` e `errore`.
 */
function inMezzo(quale, azione) {
  const stato = { scattata: false, esito: undefined, errore: undefined };
  dopoLaLettura = {
    quale,
    azione: async () => {
      stato.scattata = true;
      try {
        stato.esito = await azione();
      } catch (errore) {
        stato.errore = errore;
      }
    },
  };
  return stato;
}

function disarma() {
  dopoLaLettura = null;
}

/** I percorsi dei documenti restituiti dalle letture fatte mentre gira `lavoro`. */
async function lettureDurante(lavoro) {
  const letti = [];
  registro = letti;
  try {
    await lavoro();
  } finally {
    registro = null;
  }
  return letti;
}

/** Un numero intero da un documento letto con `leggi`; `null` se il campo non c'è. */
function intero(documento, campo) {
  const valore = documento?.fields?.[campo]?.integerValue;
  return valore === undefined ? null : Number(valore);
}

/** Un file nello Storage dell'emulatore, dal processo (come la pulizia, che ci scrive e cancella). */
async function caricaFile(percorso, tipo) {
  await getStorage().bucket(BUCKET).file(percorso).save(Buffer.from('prova'), { contentType: tipo });
}

async function esisteFile(percorso) {
  const [esiste] = await getStorage().bucket(BUCKET).file(percorso).exists();
  return esiste;
}

/** Perché una prova rossa non lasci file in un emulatore che resta acceso. */
async function toglieFile(percorso) {
  await getStorage().bucket(BUCKET).file(percorso).delete({ ignoreNotFound: true });
}

/**
 * Le stagioni **confermate** che la pagina pubblica `profiliPubblici/<slug>` mostra, come
 * `{ struttura, comune }`. La scrive un trigger, in ritardo: con `aspetta` si dà tempo
 * fino a 6 secondi perché ne compaia una, per quando ci si aspetta che compaia.
 */
async function confermatePubbliche(slug, aspetta = false) {
  const fine = Date.now() + (aspetta ? 6000 : 0);
  for (;;) {
    const profilo = await leggi(`profiliPubblici/${slug}`);
    const confermate = (profilo?.fields?.stagioni?.arrayValue?.values ?? [])
      .map((s) => s.mapValue?.fields ?? {})
      .filter((s) => s.stato?.stringValue === 'confermata')
      .map((s) => ({ struttura: s.struttura?.stringValue, comune: s.comune?.stringValue }));
    if (confermate.length > 0 || Date.now() >= fine) return confermate;
    await attendi(250);
  }
}

/** Un lavoratore con profilo e una stagione in bozza, pronto per chiedere conferme. */
async function preparaLavoratore(telefono, nome, invito) {
  const utente = await entra(telefono);
  await scriviDocumento('inviti', invito, {
    attivo: { booleanValue: true },
    usatoDa: { stringValue: utente.uid },
  });
  await scriviDocumento('slugs', `${nome.toLowerCase()}-0001`, { uid: { stringValue: utente.uid } });

  const adesso = new Date().toISOString();
  await scriviDocumento(`workers`, utente.uid, {
    nome: { stringValue: nome },
    cognome: { stringValue: 'Prova' },
    fotoPath: { nullValue: null },
    telefono: { stringValue: utente.telefono },
    ruoloPrincipale: { stringValue: 'bar' },
    comune: { stringValue: 'Terracina' },
    provincia: { stringValue: 'LT' },
    geohash: { stringValue: 'sr0abcd' },
    disponibile: { booleanValue: true },
    stagioneDisponibile: { stringValue: '2027' },
    slug: { stringValue: `${nome.toLowerCase()}-0001` },
    privacy: {
      mapValue: {
        fields: {
          pubblico: { booleanValue: true },
          mostraTelefono: { booleanValue: false },
          mostraInAttesa: { booleanValue: false },
          mostraCv: { booleanValue: false },
        },
      },
    },
    cvPath: { nullValue: null },
    consensi: {
      mapValue: {
        fields: {
          maggiorenne: { timestampValue: adesso },
          informativa: {
            mapValue: { fields: { versione: { stringValue: '1' }, ts: { timestampValue: adesso } } },
          },
        },
      },
    },
    invito: { stringValue: invito },
    createdAt: { timestampValue: adesso },
    updatedAt: { timestampValue: adesso },
  });

  return utente;
}

async function creaStagione(uid, id, modifiche = {}) {
  const adesso = new Date().toISOString();
  await scriviDocumento(`workers/${uid}/stagioni`, id, {
    strutturaId: { stringValue: 'struttura-1' },
    strutturaNome: { stringValue: 'Bar Somma' },
    strutturaComune: { stringValue: 'Terracina' },
    ruolo: { stringValue: 'bar' },
    dal: { stringValue: '2026-05' },
    al: { stringValue: '2026-09' },
    competenzeDichiarate: {
      arrayValue: { values: [{ stringValue: 'bar.caffetteria' }, { stringValue: 'generale.cassa' }] },
    },
    competenzeConfermate: { arrayValue: { values: [] } },
    stato: { stringValue: 'bozza' },
    nascosta: { booleanValue: false },
    riprenderebbe: { booleanValue: false },
    ruoloResponsabile: { nullValue: null },
    richiestaId: { nullValue: null },
    createdAt: { timestampValue: adesso },
    updatedAt: { timestampValue: adesso },
    ...modifiche,
  });
}

const CONFERMA_VALIDA = {
  competenzeConfermate: ['bar.caffetteria'],
  riprenderebbe: false,
  ruoloResponsabile: 'titolare',
  consenso: true,
};

// ---------------------------------------------------------------- le prove

await azzera();

// ---- Chi prova a confermarsi da solo ------------------------------------
await titolo('Chi prova a confermarsi da solo');
{
  const mario = await preparaLavoratore('347 100 0001', 'Mario', 'inv-1');
  await creaStagione(mario.uid, 'sua');

  await deveFallire(
    'il proprio numero come responsabile',
    chiama('creaRichiesta', { stagioneId: 'sua', nomeResponsabile: 'Io', telefonoResponsabile: mario.telefono }, mario),
  );

  // Un collega che ha lavorato nella stessa struttura nello stesso periodo (§8.2).
  const collega = await preparaLavoratore('347 100 0002', 'Gino', 'inv-2');
  await creaStagione(collega.uid, 'stessoPosto');

  await deveFallire(
    'il numero di un collega della stessa struttura e periodo',
    chiama(
      'creaRichiesta',
      { stagioneId: 'sua', nomeResponsabile: 'Gino', telefonoResponsabile: collega.telefono },
      mario,
    ),
  );

  // Decisione del 7 ottobre: un collega che Mike conosce come responsabile (il suo
  // numero è in `responsabiliNoti`) può confermare anche se ha lavorato lì nello stesso
  // periodo. Succede: il capo sala è spesso uno stagionale anche lui.
  // L'id scritto a mano come capita nella console («0039 347 100 0002»): deve valere lo
  // stesso. L'8 ottobre un id «quasi giusto» ha tenuto bloccato un collega.
  const t = collega.telefono;
  const scrittoAMano = `0039 ${t.slice(3, 6)} ${t.slice(6, 9)} ${t.slice(9)}`;
  await scriviDocumento('responsabiliNoti', scrittoAMano, { nota: { stringValue: 'capo sala' } });
  await deveRiuscire(
    'il collega che è un responsabile noto può confermare',
    chiama(
      'creaRichiesta',
      { stagioneId: 'sua', nomeResponsabile: 'Gino', telefonoResponsabile: collega.telefono },
      mario,
    ),
  );

  await deveFallire(
    'una richiesta senza essere collegati',
    chiama('creaRichiesta', { stagioneId: 'sua', nomeResponsabile: 'X', telefonoResponsabile: '+393480000001' }),
  );

  await deveFallire(
    'una richiesta per la stagione di un altro',
    chiama(
      'creaRichiesta',
      { stagioneId: 'stessoPosto', nomeResponsabile: 'X', telefonoResponsabile: '+393480000001' },
      mario,
    ),
  );
}

// ---- Il link e chi lo apre ----------------------------------------------
await titolo('Il link e chi lo apre');
{
  await azzera();
  const mario = await preparaLavoratore('347 200 0001', 'Mario', 'inv-1');
  await creaStagione(mario.uid, 'sua');

  const esito = await deveRiuscire(
    'la richiesta si crea',
    chiama(
      'creaRichiesta',
      { stagioneId: 'sua', nomeResponsabile: 'Ciro', telefonoResponsabile: '+393482000002' },
      mario,
    ),
  );
  const token = esito.risultato.token;

  const estraneo = await entra('349 999 0001');
  await deveFallire(
    'confermare da un numero diverso da quello indicato',
    chiama('confermaStagione', { token, ...CONFERMA_VALIDA }, estraneo),
  );

  const responsabile = await entra('348 200 0002');
  await deveFallire(
    'confermare senza il consenso',
    chiama('confermaStagione', { token, ...CONFERMA_VALIDA, consenso: false }, responsabile),
  );
  await deveFallire(
    'confermare con un ruolo inventato',
    chiama('confermaStagione', { token, ...CONFERMA_VALIDA, ruoloResponsabile: 'proprietario' }, responsabile),
  );
  await deveFallire(
    'confermare un link che non esiste',
    chiama('confermaStagione', { token: 'token-inventato', ...CONFERMA_VALIDA }, responsabile),
  );

  // Competenze che il lavoratore non ha dichiarato: si scartano, non si aggiungono.
  const buona = await deveRiuscire(
    'la conferma dal numero giusto',
    chiama(
      'confermaStagione',
      { token, ...CONFERMA_VALIDA, competenzeConfermate: ['bar.caffetteria', 'cucina.pasticceria'] },
      responsabile,
    ),
  );
  if (buona.risultato?.competenzeConfermate?.includes('cucina.pasticceria')) {
    no('una competenza non dichiarata non si può aggiungere', 'è stata confermata comunque');
  } else {
    ok('una competenza non dichiarata viene scartata, non aggiunta');
  }

  await deveFallire(
    'confermare due volte lo stesso link',
    chiama('confermaStagione', { token, ...CONFERMA_VALIDA }, responsabile),
  );

  const letta = await chiama('leggiRichiesta', { token });
  if (letta.risultato?.stato === 'usata') ok('il link usato si legge come «usata»');
  else no('il link usato si legge come «usata»', `stato: ${letta.risultato?.stato}`);

  // Chi ha mandato il link e lo riapre dalla chat deve sapere che è il suo, e nessun
  // altro deve sentirselo dire.
  const [suo, delResponsabile, anonimo] = await Promise.all([
    chiama('leggiRichiesta', { token }, mario),
    chiama('leggiRichiesta', { token }, responsabile),
    chiama('leggiRichiesta', { token }),
  ]);
  if (
    suo.risultato?.tuaRichiesta === true &&
    delResponsabile.risultato?.tuaRichiesta !== true &&
    anonimo.risultato?.tuaRichiesta !== true
  ) {
    ok('il link si riconosce come «tuo» solo da chi l’ha mandato');
  } else {
    no(
      'il link si riconosce come «tuo» solo da chi l’ha mandato',
      JSON.stringify([suo.risultato?.tuaRichiesta, delResponsabile.risultato?.tuaRichiesta, anonimo.risultato?.tuaRichiesta]),
    );
  }
}

// ---- Il link scaduto ----------------------------------------------------
await titolo('Il link scaduto, e la pulizia che lo chiude');
{
  await azzera();
  const mario = await preparaLavoratore('347 300 0001', 'Mario', 'inv-1');
  await creaStagione(mario.uid, 'sua');

  const esito = await chiama(
    'creaRichiesta',
    { stagioneId: 'sua', nomeResponsabile: 'Ciro', telefonoResponsabile: '+393483000002' },
    mario,
  );
  const token = esito.risultato.token;

  // Si sposta la scadenza nel passato, come fossero passati 31 giorni.
  const passato = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  await scriviCampi(`richieste/${token}`, { scadeIl: { timestampValue: passato } });

  const letta = await chiama('leggiRichiesta', { token });
  if (letta.risultato?.stato === 'scaduta') ok('un link vecchio si legge come «scaduta»');
  else no('un link vecchio si legge come «scaduta»', `stato: ${letta.risultato?.stato}`);

  const responsabile = await entra('348 300 0002');
  await deveFallire(
    'confermare un link scaduto',
    chiama('confermaStagione', { token, ...CONFERMA_VALIDA }, responsabile),
  );

  // La pulizia notturna chiude la richiesta e riporta la stagione al lavoratore.
  // Si chiama il codice vero della funzione, compilato: una pianificata non si può
  // invocare dall'esterno, e rifarne la logica qui vorrebbe dire provare una copia.
  await eseguiPulizia();

  const stagione = await leggi(`workers/${mario.uid}/stagioni/sua`);
  if (stagione?.fields?.stato?.stringValue === 'scaduta') {
    ok('la stagione di un link scaduto torna «scaduta» e si può rimandare');
  } else {
    no('la stagione di un link scaduto torna «scaduta»', `stato: ${stagione?.fields?.stato?.stringValue}`);
  }
}

// ---- La rete di sicurezza della pulizia ---------------------------------
await titolo('Una stagione rimasta appesa');
{
  await azzera();
  const mario = await preparaLavoratore('347 350 0001', 'Mario', 'inv-1');
  await creaStagione(mario.uid, 'sua');

  const esito = await chiama(
    'creaRichiesta',
    { stagioneId: 'sua', nomeResponsabile: 'Ciro', telefonoResponsabile: '+393483500002' },
    mario,
  );

  // Si chiude la richiesta lasciando la stagione «in attesa»: è lo stato in cui non
  // aspetta più niente e il lavoratore non ha nemmeno il pulsante per rimandare.
  await scriviCampi(`richieste/${esito.risultato.token}`, { stato: { stringValue: 'scaduta' } });

  await eseguiPulizia();

  const stagione = await leggi(`workers/${mario.uid}/stagioni/sua`);
  if (stagione?.fields?.stato?.stringValue === 'scaduta') {
    ok('la pulizia sblocca una stagione che aspettava un link già chiuso');
  } else {
    no('la pulizia sblocca una stagione appesa', `stato: ${stagione?.fields?.stato?.stringValue}`);
  }
}

// ---- La stagione corretta dopo aver mandato il link ---------------------
await titolo('La stagione corretta dopo aver mandato il link');
{
  await azzera();
  const mario = await preparaLavoratore('347 400 0001', 'Mario', 'inv-1');
  await creaStagione(mario.uid, 'sua');

  const primo = await chiama(
    'creaRichiesta',
    { stagioneId: 'sua', nomeResponsabile: 'Ciro', telefonoResponsabile: '+393484000002' },
    mario,
  );
  const tokenVecchio = primo.risultato.token;

  // Il lavoratore cambia struttura e periodo, come farebbe da L4 dopo un «non
  // corrisponde». Il link vecchio non deve poter confermare i dati nuovi.
  await scriviCampi(`workers/${mario.uid}/stagioni/sua`, {
    strutturaNome: { stringValue: 'Un altro posto' },
    stato: { stringValue: 'bozza' },
    richiestaId: { nullValue: null },
  });

  const letta = await chiama('leggiRichiesta', { token: tokenVecchio });
  if (letta.risultato?.stato === 'revocata') ok('il link di una stagione corretta non è più valido');
  else no('il link di una stagione corretta non è più valido', `stato: ${letta.risultato?.stato}`);

  const responsabile = await entra('348 400 0002');
  await deveFallire(
    'confermare una stagione cambiata dopo l’invio',
    chiama('confermaStagione', { token: tokenVecchio, ...CONFERMA_VALIDA }, responsabile),
  );

  // Rimandando, il link vecchio muore per davvero e ne nasce uno solo valido.
  const secondo = await chiama(
    'creaRichiesta',
    { stagioneId: 'sua', nomeResponsabile: 'Ciro', telefonoResponsabile: '+393484000002' },
    mario,
  );
  await deveFallire(
    'confermare col link di prima dopo un rinvio',
    chiama('confermaStagione', { token: tokenVecchio, ...CONFERMA_VALIDA }, responsabile),
  );
  const vecchia = await leggi(`richieste/${tokenVecchio}`);
  if (vecchia?.fields?.stato?.stringValue === 'revocata') {
    ok('rimandando, il link della stagione corretta si chiude davvero');
  } else {
    no('rimandando, il link della stagione corretta si chiude davvero', `stato: ${vecchia?.fields?.stato?.stringValue}`);
  }
  await deveRiuscire(
    'confermare col link nuovo',
    chiama('confermaStagione', { token: secondo.risultato.token, ...CONFERMA_VALIDA }, responsabile),
  );
}

await titolo('Correggere e rimandare non consuma il limite di cinque');
{
  // Prima un link di una stagione corretta restava aperto e contava nel limite per
  // 30 giorni: dopo poche correzioni non si poteva più chiedere niente.
  await azzera();
  const mario = await preparaLavoratore('347 410 0001', 'Mario', 'inv-1');
  await creaStagione(mario.uid, 'sua');
  let ultimo = null;
  for (let i = 0; i < 7; i += 1) {
    ultimo = await chiama(
      'creaRichiesta',
      { stagioneId: 'sua', nomeResponsabile: 'Ciro', telefonoResponsabile: '+393484100002' },
      mario,
    );
    await scriviCampi(`workers/${mario.uid}/stagioni/sua`, {
      strutturaNome: { stringValue: `Correzione ${i}` },
      stato: { stringValue: 'bozza' },
      richiestaId: { nullValue: null },
    });
  }
  if (ultimo?.ok) ok('sette invii con correzioni in mezzo, nessun blocco');
  else no('sette invii con correzioni in mezzo, nessun blocco', ultimo?.errore?.message);
}

await titolo('Il link di un altro scritto sulla propria stagione');
{
  // Le regole ora lo impediscono dal client, ma il server non deve fidarsi: chi conosce
  // il link di un altro (gli è arrivato da responsabile) lo mette su una sua stagione e
  // chiede una conferma, sperando che creaRichiesta lo revochi.
  await azzera();
  const anna = await preparaLavoratore('347 420 0001', 'Anna', 'inv-1');
  await creaStagione(anna.uid, 'sua');
  const diAnna = await chiama(
    'creaRichiesta',
    { stagioneId: 'sua', nomeResponsabile: 'Ciro', telefonoResponsabile: '+393484200009' },
    anna,
  );

  const furbo = await preparaLavoratore('347 420 0002', 'Furbo', 'inv-2');
  await creaStagione(furbo.uid, 'sua', { richiestaId: { stringValue: diAnna.risultato.token } });
  await chiama(
    'creaRichiesta',
    { stagioneId: 'sua', nomeResponsabile: 'Pino', telefonoResponsabile: '+393484200008' },
    furbo,
  );

  const richiesta = await leggi(`richieste/${diAnna.risultato.token}`);
  if (richiesta?.fields?.stato?.stringValue === 'aperta') ok('il link di un altro resta aperto');
  else no('il link di un altro resta aperto', `stato: ${richiesta?.fields?.stato?.stringValue}`);
}

// ---- La stagione cambiata restando «in attesa» --------------------------
await titolo('La stagione cambiata di sotto al responsabile');
{
  await azzera();
  const mario = await preparaLavoratore('347 450 0001', 'Mario', 'inv-1');
  await creaStagione(mario.uid, 'sua');

  const esito = await chiama(
    'creaRichiesta',
    { stagioneId: 'sua', nomeResponsabile: 'Ciro', telefonoResponsabile: '+393484500002' },
    mario,
  );
  const token = esito.risultato.token;

  // Le regole non lo permettono più dal client, ma qui si scrive scavalcandole: serve a
  // provare che il **server** rifiuta comunque, e non solo l'interfaccia. Il responsabile
  // del Bar Somma non deve poter confermare un posto dove non ha visto nessuno.
  await scriviCampi(`workers/${mario.uid}/stagioni/sua`, {
    strutturaNome: { stringValue: 'Hotel Che Non Esiste' },
    strutturaId: { stringValue: 'struttura-99' },
  });

  const letta = await chiama('leggiRichiesta', { token });
  if (letta.risultato?.struttura === 'Hotel Che Non Esiste') {
    no('il link non deve mostrare dati cambiati dopo l’invio', 'mostra la struttura nuova');
  } else {
    ok('il link di una stagione cambiata non mostra i dati nuovi');
  }

  const responsabile = await entra('348 450 0002');
  await deveFallire(
    'confermare una stagione cambiata restando in attesa',
    chiama('confermaStagione', { token, ...CONFERMA_VALIDA }, responsabile),
  );
  await deveFallire(
    'segnalare con lo stesso link',
    chiama('segnalaStagione', { token, motivo: 'mai_lavorato' }, responsabile),
  );
}

// ---- Cancellare la stagione per scansare la segnalazione ----------------
await titolo('Cancellare la stagione per scansare la segnalazione');
{
  await azzera();
  const mario = await preparaLavoratore('347 470 0001', 'Mario', 'inv-1');
  await creaStagione(mario.uid, 'sua');

  const esito = await chiama(
    'creaRichiesta',
    { stagioneId: 'sua', nomeResponsabile: 'Ciro', telefonoResponsabile: '+393484700002' },
    mario,
  );

  // Il lavoratore cancella la stagione appena vede arrivare la risposta.
  await fetch(`${documenti}/workers/${mario.uid}/stagioni/sua`, {
    method: 'DELETE',
    headers: { Authorization: 'Bearer owner' },
  });

  const responsabile = await entra('348 470 0002');
  await deveRiuscire(
    'la segnalazione passa anche senza la stagione',
    chiama('segnalaStagione', { token: esito.risultato.token, motivo: 'mai_lavorato' }, responsabile),
  );

  const segnalazioni = await fetch(`${documenti}/segnalazioni`, {
    headers: { Authorization: 'Bearer owner' },
  }).then((r) => r.json());
  if ((segnalazioni.documents ?? []).length === 1) {
    ok('la segnalazione resta registrata: cancellare la stagione non la evita');
  } else {
    no('la segnalazione resta registrata', `trovate ${(segnalazioni.documents ?? []).length}`);
  }
}

// ---- I limiti della §8.4 ------------------------------------------------
await titolo('I limiti della §8.4');
{
  await azzera();
  const mario = await preparaLavoratore('347 500 0001', 'Mario', 'inv-1');

  for (let i = 0; i < 6; i += 1) {
    await creaStagione(mario.uid, `stagione-${i}`, {
      strutturaId: { stringValue: `struttura-${i}` },
      dal: { stringValue: `202${i}-05` },
      al: { stringValue: `202${i}-09` },
    });
  }

  for (let i = 0; i < 5; i += 1) {
    const esito = await chiama(
      'creaRichiesta',
      { stagioneId: `stagione-${i}`, nomeResponsabile: 'Ciro', telefonoResponsabile: `+39348500000${i}` },
      mario,
    );
    if (!esito.ok) no(`la richiesta numero ${i + 1} doveva passare`, esito.errore?.message);
  }
  ok('cinque richieste aperte si possono avere');

  await deveFallire(
    'la sesta richiesta aperta',
    chiama(
      'creaRichiesta',
      { stagioneId: 'stagione-5', nomeResponsabile: 'Ciro', telefonoResponsabile: '+393485000099' },
      mario,
    ),
  );

  // Una stagione cancellata non aspetta più il suo link: non deve contare nel limite.
  await fetch(`${documenti}/workers/${mario.uid}/stagioni/stagione-0`, {
    method: 'DELETE',
    headers: { Authorization: 'Bearer owner' },
  });
  await deveRiuscire(
    'cancellata una stagione in attesa, la sesta richiesta passa',
    chiama(
      'creaRichiesta',
      { stagioneId: 'stagione-5', nomeResponsabile: 'Ciro', telefonoResponsabile: '+393485000099' },
      mario,
    ),
  );
}

await titolo('Il «responsabile noto» guadagnato e perso');
{
  // Tre lavoratori diversi nella stessa struttura lo rendono noto; una revoca che lo
  // porta sotto la soglia glielo toglie.
  await azzera();
  const responsabile = await entra('348 510 0009');
  const token = [];
  for (let i = 0; i < 3; i += 1) {
    const lavoratore = await preparaLavoratore(`347 510 000${i}`, `Lav${i}`, `inv-${i}`);
    await creaStagione(lavoratore.uid, 'sua');
    const esito = await chiama(
      'creaRichiesta',
      { stagioneId: 'sua', nomeResponsabile: 'Ciro', telefonoResponsabile: '+393485100009' },
      lavoratore,
    );
    token.push(esito.risultato.token);
    await chiama('confermaStagione', { token: esito.risultato.token, ...CONFERMA_VALIDA }, responsabile);
  }
  const prima = await leggi(`responsabili/${responsabile.uid}`);
  if (prima?.fields?.verificatoAdmin?.booleanValue === true) ok('tre lavoratori diversi: diventa noto');
  else no('tre lavoratori diversi: diventa noto', JSON.stringify(prima?.fields?.verificatoAdmin));

  await chiama('revocaConferma', { token: token[0] }, responsabile);
  const dopo = await leggi(`responsabili/${responsabile.uid}`);
  if (dopo?.fields?.verificatoAdmin?.booleanValue === false) ok('una revoca sotto la soglia toglie il titolo');
  else no('una revoca sotto la soglia toglie il titolo', JSON.stringify(dopo?.fields?.verificatoAdmin));
}

await titolo('Quanti confermano entro 7 giorni (condizione 2 del dopo-V1)');
{
  // Quattro richieste partite dieci giorni fa: una confermata subito, una segnalata,
  // una ancora aperta, una sostituita da un invio nuovo (che non deve contare). Più una
  // partita ieri, che non ha ancora avuto la sua settimana e non deve contare.
  await azzera();
  const dieciGiorniFa = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString();
  const token = {};
  for (const [i, nome] of ['confermata', 'segnalata', 'aperta', 'sostituita', 'recente'].entries()) {
    const lavoratore = await preparaLavoratore(`347 520 000${i}`, `Stat${i}`, `inv-${i}`);
    await creaStagione(lavoratore.uid, 'sua');
    const esito = await chiama(
      'creaRichiesta',
      { stagioneId: 'sua', nomeResponsabile: 'Ciro', telefonoResponsabile: `+39348520009${i}` },
      lavoratore,
    );
    token[nome] = { valore: esito.risultato.token, lavoratore };
  }
  const responsabile = (i) => entra(`348 520 009${i}`);
  await chiama('confermaStagione', { token: token.confermata.valore, ...CONFERMA_VALIDA }, await responsabile(0));
  await chiama('segnalaStagione', { token: token.segnalata.valore, motivo: 'dati_sbagliati' }, await responsabile(1));
  await chiama(
    'creaRichiesta',
    { stagioneId: 'sua', nomeResponsabile: 'Ciro', telefonoResponsabile: '+393485200093' },
    token.sostituita.lavoratore,
  );
  // Si sposta indietro la partenza delle prime quattro; la conferma resta di oggi, ma
  // a quella si dà la stessa data, così risulta arrivata subito.
  for (const nome of ['confermata', 'segnalata', 'aperta', 'sostituita']) {
    await scriviCampi(`richieste/${token[nome].valore}`, { createdAt: { timestampValue: dieciGiorniFa } });
  }
  const conferme = await leggi('conferme');
  await scriviCampi(conferme.documents[0].name.split('/documents/')[1], {
    createdAt: { timestampValue: dieciGiorniFa },
  });

  await eseguiPulizia();
  const statistiche = (await leggi('statistiche/conferme'))?.fields ?? {};
  const numero = (campo) => Number(statistiche[campo]?.integerValue ?? -1);
  const atteso =
    numero('richiesteConsiderate') === 3 &&
    numero('confermateEntro7Giorni') === 1 &&
    numero('segnalate') === 1 &&
    numero('ancoraAperte') === 1 &&
    numero('percentualeEntro7Giorni') === 33;
  if (atteso) ok('la misura conta 3 richieste, 1 confermata entro 7 giorni: 33%');
  else no('la misura conta 3 richieste, 1 confermata entro 7 giorni: 33%', JSON.stringify(statistiche));
}

// ---- Il tetto di conferme per numero -----------------------------------
await titolo('Il tetto di dieci conferme in ventiquattr’ore');
{
  await azzera();
  const responsabile = await entra('348 600 0001');

  // Undici lavoratori diversi, tutti con una stagione da confermare allo stesso numero.
  for (let i = 0; i < 11; i += 1) {
    const lavoratore = await preparaLavoratore(`347 60${i} 1000`, `Tizio${i}`, `inv-${i}`);
    await creaStagione(lavoratore.uid, 'sua', {
      strutturaId: { stringValue: `struttura-${i}` },
    });
    const esito = await chiama(
      'creaRichiesta',
      { stagioneId: 'sua', nomeResponsabile: 'Ciro', telefonoResponsabile: responsabile.telefono },
      lavoratore,
    );
    const conferma = await chiama('confermaStagione', { token: esito.risultato.token, ...CONFERMA_VALIDA }, responsabile);

    if (i < 10 && !conferma.ok) no(`la conferma numero ${i + 1} doveva passare`, conferma.errore?.message);
    if (i === 10) {
      if (conferma.ok) no('l’undicesima conferma in un giorno', 'è passata, e non doveva');
      else ok(`l’undicesima conferma in un giorno → «${conferma.errore?.message}»`);
    }
  }
  ok('dieci conferme al giorno per numero si possono fare');
}

// ---- Segnalazioni e sospensione ----------------------------------------
await titolo('«Non ha mai lavorato qui», due volte');
{
  await azzera();
  const mario = await preparaLavoratore('347 700 0001', 'Mario', 'inv-1');

  // Un link partito prima della sospensione: dopo, non deve più poter confermare.
  await creaStagione(mario.uid, 'prima', { strutturaId: { stringValue: 'struttura-8' } });
  const linkPrima = await chiama(
    'creaRichiesta',
    { stagioneId: 'prima', nomeResponsabile: 'Ciro', telefonoResponsabile: '+393487000088' },
    mario,
  );

  for (let i = 0; i < 2; i += 1) {
    await creaStagione(mario.uid, `stagione-${i}`, {
      strutturaId: { stringValue: `struttura-${i}` },
      dal: { stringValue: `202${i}-05` },
      al: { stringValue: `202${i}-09` },
    });
    const esito = await chiama(
      'creaRichiesta',
      { stagioneId: `stagione-${i}`, nomeResponsabile: 'Ciro', telefonoResponsabile: `+39348700000${i}` },
      mario,
    );
    const responsabile = await entra(`348 700 000${i}`);
    await chiama('segnalaStagione', { token: esito.risultato.token, motivo: 'mai_lavorato' }, responsabile);
  }

  const prima = await leggi(`workers/${mario.uid}/stagioni/stagione-0`);
  if (prima?.fields?.stato?.stringValue === 'non_confermata') {
    ok('la stagione segnalata diventa «non confermata»');
  } else {
    no('la stagione segnalata diventa «non confermata»', `stato: ${prima?.fields?.stato?.stringValue}`);
  }

  if (await leggi(`sospensioni/${mario.uid}`)) ok('due segnalazioni sospendono il libretto');
  else no('due segnalazioni sospendono il libretto', 'nessuna sospensione scritta');

  // La sospensione deve togliere subito il profilo dalla rete, non alla prossima
  // scrittura: la sospensione blocca proprio le scritture di quel lavoratore.
  if (await leggi('profiliPubblici/mario-0001')) {
    no('un libretto sospeso non è più pubblico', 'la pagina pubblica esiste ancora');
  } else {
    ok('un libretto sospeso non è più pubblico');
  }

  await creaStagione(mario.uid, 'nuova', { strutturaId: { stringValue: 'struttura-9' } });
  await deveFallire(
    'chiedere conferme con il libretto sospeso',
    chiama(
      'creaRichiesta',
      { stagioneId: 'nuova', nomeResponsabile: 'Ciro', telefonoResponsabile: '+393487000099' },
      mario,
    ),
  );

  const responsabilePrima = await entra('348 700 0088');
  await deveFallire(
    'confermare un link partito prima della sospensione',
    chiama('confermaStagione', { token: linkPrima.risultato.token, ...CONFERMA_VALIDA }, responsabilePrima),
  );

  // Chi ha segnalato non vede un bottone Revoca che non ha niente da togliere.
  const responsabile0 = await entra('348 700 0000');
  const segnalata = await leggi('segnalazioni');
  const tokenSegnalato = segnalata?.documents?.[0]?.fields?.richiestaId?.stringValue;
  const vista = await chiama('leggiRichiesta', { token: tokenSegnalato }, responsabile0);
  if (vista.risultato?.stato === 'usata' && vista.risultato?.revocabile === false) {
    ok('dopo un «non corrisponde» non si offre la revoca');
  } else {
    no('dopo un «non corrisponde» non si offre la revoca', JSON.stringify(vista.risultato));
  }

  // Eliminando l'account, le segnalazioni su di lui se ne vanno con il resto.
  await chiama('eliminaAccount', { conferma: 'ELIMINA' }, mario);
  const rimaste = await leggi('segnalazioni');
  if ((rimaste?.documents ?? []).length === 0) ok('eliminando l’account spariscono anche le segnalazioni');
  else no('eliminando l’account spariscono anche le segnalazioni', `${rimaste.documents.length} rimaste`);
}

// ---- Lo stesso link usato due volte nello stesso istante ----------------
// Un doppio tap, una rete che va e viene, o un client scritto a mano che manda la stessa
// chiamata due volte insieme. La §8.5 vuole due segnalazioni per sospendere: da un link
// solo deve uscirne una, altrimenti un responsabile da solo sospende un libretto.
await titolo('Lo stesso link usato due volte nello stesso istante');
// Trovato il 2026-10-19: `segnalaStagione` leggeva la richiesta fuori da una transazione,
// e tre chiamate insieme scrivevano tre segnalazioni (rossa quattro volte su cinque).
// Corretto la sera stessa rileggendo la richiesta dentro una transazione, come la
// conferma e la revoca. Da allora la prova gira sempre.
{
  await azzera();
  const mario = await preparaLavoratore('347 710 0001', 'Mario', 'inv-1');
  await creaStagione(mario.uid, 'sua');
  const esito = await chiama(
    'creaRichiesta',
    { stagioneId: 'sua', nomeResponsabile: 'Ciro', telefonoResponsabile: '+393487100002' },
    mario,
  );
  const ciro = await entra('348 710 0002');
  const token = esito.risultato.token;

  // Tre insieme e non due: con due, a volte una finisce prima che l'altra parta.
  await Promise.all(
    [1, 2, 3].map(() => chiamaInsieme(segnalaStagione, { token, motivo: 'mai_lavorato' }, ciro)),
  );
  const segnalazioni = (await leggi('segnalazioni'))?.documents ?? [];
  if (segnalazioni.length === 1) ok('tre «mai lavorato qui» insieme dallo stesso link fanno una segnalazione');
  else no('tre «mai lavorato qui» insieme dallo stesso link fanno una segnalazione', `${segnalazioni.length} segnalazioni`);
  if (await leggi(`sospensioni/${mario.uid}`)) {
    no('un link solo non sospende il libretto', 'il libretto è sospeso');
  } else {
    ok('un link solo non sospende il libretto');
  }

  // Conferma e «non corrisponde» insieme sullo stesso link: vince una delle due, e la
  // stagione resta coerente con quella che ha vinto. Un lavoratore nuovo, perché quello
  // di sopra, se la prova è rossa, è sospeso e non manda più richieste.
  const lucia = await preparaLavoratore('347 710 0003', 'Lucia', 'inv-2');
  await creaStagione(lucia.uid, 'altra', { strutturaId: { stringValue: 'struttura-2' } });
  const seconda = await chiama(
    'creaRichiesta',
    { stagioneId: 'altra', nomeResponsabile: 'Ciro', telefonoResponsabile: '+393487100002' },
    lucia,
  );
  const [conferma, segnala] = await Promise.all([
    chiamaInsieme(confermaStagione, { token: seconda.risultato.token, ...CONFERMA_VALIDA }, ciro),
    chiamaInsieme(segnalaStagione, { token: seconda.risultato.token, motivo: 'dati_sbagliati' }, ciro),
  ]);
  const altra = (await leggi(`workers/${lucia.uid}/stagioni/altra`))?.fields ?? {};
  const conferme = ((await leggi('conferme'))?.documents ?? []).filter(
    (d) => d.fields?.stagioneId?.stringValue === 'altra',
  );
  const coerente =
    conferma.ok !== segnala.ok &&
    (conferma.ok
      ? altra.stato?.stringValue === 'confermata' && conferme.length === 1
      : altra.stato?.stringValue === 'non_confermata' && conferme.length === 0);
  if (coerente) ok('conferma e «non corrisponde» insieme: ne passa una sola, e la stagione le dà ragione');
  else {
    no(
      'conferma e «non corrisponde» insieme: ne passa una sola, e la stagione le dà ragione',
      `conferma ${conferma.ok ? 'passata' : 'rifiutata'}, segnalazione ${segnala.ok ? 'passata' : 'rifiutata'}, ` +
        `stagione «${altra.stato?.stringValue}», ${conferme.length} conferme`,
    );
  }
}

// ---- Il tetto di dieci conferme, con le conferme insieme ---------------
// La §8.4 conta le conferme delle ultime 24 ore prima della transazione: quattro conferme
// partite insieme dallo stesso numero leggevano tutte lo stesso conteggio e passavano
// tutte, oltre il tetto. Dentro la transazione si rilegge, e si mettono in fila.
await titolo('Il tetto di dieci conferme, con le conferme insieme');
{
  await azzera();
  const responsabile = await entra('348 720 0001');
  const token = [];
  for (let i = 0; i < 12; i += 1) {
    const lavoratore = await preparaLavoratore(`347 72${String(i).padStart(2, '0')} 001`, `Caio${i}`, `inv-${i}`);
    await creaStagione(lavoratore.uid, 'sua', { strutturaId: { stringValue: `struttura-${i}` } });
    const esito = await chiama(
      'creaRichiesta',
      { stagioneId: 'sua', nomeResponsabile: 'Ciro', telefonoResponsabile: responsabile.telefono },
      lavoratore,
    );
    token.push(esito.risultato.token);
  }
  // Otto una alla volta, poi quattro insieme: ne devono passare due, non quattro.
  for (const t of token.slice(0, 8)) {
    await chiama('confermaStagione', { token: t, ...CONFERMA_VALIDA }, responsabile);
  }
  const insieme = await Promise.all(
    token.slice(8).map((t) => chiamaInsieme(confermaStagione, { token: t, ...CONFERMA_VALIDA }, responsabile)),
  );
  const passate = insieme.filter((e) => e.ok).length;
  const conferme = (await leggi('conferme'))?.documents ?? [];
  if (conferme.length === 10 && passate === 2) {
    ok('quattro conferme insieme oltre l’ottava: ne passano due, e il tetto resta dieci');
  } else {
    no('quattro conferme insieme oltre l’ottava: ne passano due, e il tetto resta dieci', `${passate} passate insieme, ${conferme.length} conferme in tutto`);
  }
}

// ---- Il nome della struttura cambiato sotto al link ---------------------
// La conferma si difende con tre controlli (token, stato, paragone con la foto
// `stagioneAlMomento`), e il terzo guardava strutturaId, ruolo, dal e al, ma **non il nome
// né il comune della struttura**. Il nome è quello che il responsabile legge nel messaggio
// («Bar Somma») e quello che la pagina pubblica mostra come confermato.
//
// Le regole non lasciano cambiare il nome di una stagione già «in attesa»: un update dal
// client la riporta sempre in bozza. Quello stato però si raggiunge con la gara di
// `creaRichiesta`, che legge la stagione (richieste.ts, `stagioneRef.get()`) e molto dopo
// scrive con un batch (`lotto.commit()`) senza rileggere: se il lavoratore cambia il nome
// dal client in mezzo, il batch mette «in attesa» la bozza col nome nuovo, mentre la foto
// ha il nome vecchio. Qui lo stato che esce dalla gara si ricrea a mano, scrivendo da
// Admin dopo `creaRichiesta` solo nome e comune e lasciando stato e token intatti (la
// gara vera è provata sotto, «Il nome cambiato mentre la richiesta parte»).
await titolo('Il nome della struttura cambiato sotto al link');
{
  await azzera();

  // Controllo: senza toccare niente, la conferma passa. Serve a dire che le rosse qui
  // sotto non dipendono da altro.
  const intatto = await preparaLavoratore('347 920 0001', 'Anna', 'inv-0');
  await creaStagione(intatto.uid, 'sua');
  const primo = await chiama(
    'creaRichiesta',
    { stagioneId: 'sua', nomeResponsabile: 'Ciro', telefonoResponsabile: '+393489200090' },
    intatto,
  );
  await deveRiuscire(
    'senza toccare la stagione, la conferma passa',
    chiama('confermaStagione', { token: primo.risultato.token, ...CONFERMA_VALIDA }, await entra('348 920 0090')),
  );

  const casi = [
    { nome: 'il solo nome', campi: { strutturaNome: 'Hotel Miramare' } },
    { nome: 'il solo comune', campi: { strutturaComune: 'Sperlonga' } },
    { nome: 'nome e comune', campi: { strutturaNome: 'Hotel Miramare', strutturaComune: 'Sperlonga' } },
  ];

  for (const [i, caso] of casi.entries()) {
    const lavoratore = await preparaLavoratore(`347 921 000${i}`, `Mario${i}`, `inv-${i + 1}`);
    await creaStagione(lavoratore.uid, 'sua');
    const esito = await chiama(
      'creaRichiesta',
      { stagioneId: 'sua', nomeResponsabile: 'Ciro', telefonoResponsabile: `+39348921009${i}` },
      lavoratore,
    );
    const token = esito.risultato.token;

    // Lo stato dopo la gara: «in attesa», stesso token, ma nome e/o comune già cambiati.
    await scriviCampi(
      `workers/${lavoratore.uid}/stagioni/sua`,
      Object.fromEntries(Object.entries(caso.campi).map(([k, v]) => [k, { stringValue: v }])),
    );

    const responsabile = await entra(`348 921 009${i}`);
    const conferma = await deveFallire(
      `confermare dopo aver cambiato ${caso.nome} della struttura`,
      chiama('confermaStagione', { token, ...CONFERMA_VALIDA }, responsabile),
    );

    // E la pagina pubblica non deve mostrare come confermata la struttura che nessuno ha
    // visto: se la conferma è passata si dà tempo al trigger di scriverla.
    const slug = `mario${i}-0001`;
    const confermate = await confermatePubbliche(slug, conferma.ok);
    const sbagliata = confermate.find(
      (s) =>
        (caso.campi.strutturaNome !== undefined && s.struttura === caso.campi.strutturaNome) ||
        (caso.campi.strutturaComune !== undefined && s.comune === caso.campi.strutturaComune),
    );
    if (sbagliata) {
      no(
        `la pagina pubblica non mostra come confermato ${caso.nome} cambiato`,
        `profiliPubblici/${slug} mostra «${sbagliata.struttura}», ${sbagliata.comune} come confermato: ` +
          'il responsabile aveva letto «Bar Somma», Terracina',
      );
    } else {
      ok(`la pagina pubblica non mostra come confermato ${caso.nome} cambiato`);
    }
  }
}

// ---- Il nome cambiato mentre la richiesta parte -------------------------
// La versione di raggiungibilità: non si scrive niente da Admin, si fa la gara. Fino a 20
// giri di `creaRichiesta` (dentro questo processo) e di una PATCH della stagione col
// gettone del lavoratore, quindi passando dalle regole, ritardata da 0 a 40 ms: da qualche
// parte cade fra la lettura della stagione e il batch che la mette «in attesa». Rossa se la
// stagione finisce «in attesa» col nome nuovo mentre la foto della richiesta ha il vecchio.
await titolo('Il nome cambiato mentre la richiesta parte');
{
  await azzera();
  const mario = await preparaLavoratore('347 930 0001', 'Mario', 'inv-1');
  await creaStagione(mario.uid, 'sua');
  const percorso = `workers/${mario.uid}/stagioni/sua`;
  const GIRI = 20;

  // Un giro a vuoto, su un'altra stagione: il primo uso dei canali verso l'emulatore è
  // lento e sposterebbe i tempi del primo giro vero.
  await creaStagione(mario.uid, 'calda');
  await chiamaInsieme(
    creaRichiesta,
    { stagioneId: 'calda', nomeResponsabile: 'Ciro', telefonoResponsabile: '+393489300099' },
    mario,
  );

  let riuscite = 0;
  const vinte = [];
  for (let giro = 0; giro < GIRI; giro += 1) {
    // La stagione torna com'era: in bozza, «Bar Somma», senza link.
    await scriviCampi(percorso, {
      strutturaNome: { stringValue: 'Bar Somma' },
      stato: { stringValue: 'bozza' },
      richiestaId: { nullValue: null },
    });

    const ritardo = Math.round((giro * 40) / (GIRI - 1));
    const [richiesta, stato] = await Promise.all([
      chiamaInsieme(
        creaRichiesta,
        { stagioneId: 'sua', nomeResponsabile: 'Ciro', telefonoResponsabile: '+393489300002' },
        mario,
      ),
      (async () => {
        await attendi(ritardo);
        return scriviComeUtente(
          percorso,
          { strutturaNome: { stringValue: 'Hotel Miramare' }, stato: { stringValue: 'bozza' }, richiestaId: { nullValue: null } },
          mario,
        );
      })(),
    ]);
    if (stato === 200) riuscite += 1;

    const campi = (await leggi(percorso))?.fields ?? {};
    const token = campi.richiestaId?.stringValue;
    const foto = token
      ? (await leggi(`richieste/${token}`))?.fields?.stagioneAlMomento?.mapValue?.fields?.strutturaNome?.stringValue
      : undefined;
    if (
      richiesta.ok &&
      campi.stato?.stringValue === 'in_attesa' &&
      campi.strutturaNome?.stringValue === 'Hotel Miramare' &&
      foto === 'Bar Somma'
    ) {
      vinte.push(ritardo);
    }
  }

  if (riuscite === 0) {
    no('la PATCH del lavoratore passa dalle regole', 'rifiutata in tutti i giri: la prova non prova niente');
  } else if (vinte.length > 0) {
    no(
      'richiesta e cambio del nome insieme: la stagione in attesa ha lo stesso nome della foto',
      `${vinte.length} giri su ${GIRI} (ritardi ${vinte.join(', ')} ms): «in attesa» con «Hotel Miramare», la foto dice «Bar Somma»`,
    );
  } else {
    ok(`richiesta e cambio del nome insieme: in ${GIRI} giri la stagione in attesa ha sempre il nome della foto`);
  }
}

// ---- Conferma e nuovo invio insieme, sulla stessa stagione --------------
// Il responsabile conferma il link T1 mentre il lavoratore lo rimanda (T2). `creaRichiesta`
// legge la stagione «in attesa», poi la conferma si completa, poi il suo batch revoca T1 e
// riporta la stagione «in attesa» con T2: la conferma resta in `conferme`, contata e
// pagata dal responsabile, ma sul libretto non c'è più, e il link che l'ha data risulta
// «revocato».
//
// Gli esiti giusti dipendono solo da chi arriva prima: vince la conferma (stagione
// confermata, T1 usata, una conferma, nessun T2 aperto) oppure vince il nuovo invio (T1
// revocata, T2 aperta, nessuna conferma); se entrambe vengono rifiutate, che resti tutto
// com'era. Il difetto è tutto il resto. Non si pretende che vinca sempre la conferma:
// chi rimanda per primo la fa morire legittimamente. Cinque volte, ogni volta con un
// ritardo diverso fra i due, per far cadere la lettura di `creaRichiesta` prima della fine
// della conferma.
await titolo('Conferma e nuovo invio insieme, sulla stessa stagione');
{
  await azzera();
  const GIRI = 5;
  const difetti = [];
  const esiti = { conferma: 0, invio: 0, nessuno: 0 };

  for (let giro = 0; giro < GIRI; giro += 1) {
    const lavoratore = await preparaLavoratore(`347 94${giro} 0001`, `Luca${giro}`, `inv-${giro}`);
    await creaStagione(lavoratore.uid, 'sua');
    const responsabile = await entra(`348 94${giro} 0002`);
    const primo = await chiama(
      'creaRichiesta',
      { stagioneId: 'sua', nomeResponsabile: 'Ciro', telefonoResponsabile: responsabile.telefono },
      lavoratore,
    );
    const T1 = primo.risultato.token;

    const ritardo = giro * 5;
    const [conferma, invio] = await Promise.all([
      chiamaInsieme(confermaStagione, { token: T1, ...CONFERMA_VALIDA }, responsabile),
      (async () => {
        await attendi(ritardo);
        return chiamaInsieme(
          creaRichiesta,
          { stagioneId: 'sua', nomeResponsabile: 'Ciro', telefonoResponsabile: `+39348940009${giro}` },
          lavoratore,
        );
      })(),
    ]);

    const stagione = (await leggi(`workers/${lavoratore.uid}/stagioni/sua`))?.fields ?? {};
    const statoT1 = (await leggi(`richieste/${T1}`))?.fields?.stato?.stringValue;
    const T2 = invio.ok ? invio.risultato.token : null;
    const statoT2 = T2 ? (await leggi(`richieste/${T2}`))?.fields?.stato?.stringValue : null;
    const conferme = ((await leggi('conferme'))?.documents ?? []).filter(
      (d) => d.fields?.workerUid?.stringValue === lavoratore.uid,
    ).length;

    const vinceConferma =
      stagione.stato?.stringValue === 'confermata' && statoT1 === 'usata' && conferme === 1 && statoT2 !== 'aperta';
    const vinceInvio =
      stagione.stato?.stringValue === 'in_attesa' &&
      stagione.richiestaId?.stringValue === T2 &&
      statoT1 === 'revocata' &&
      statoT2 === 'aperta' &&
      conferme === 0;
    const restaTutto =
      !conferma.ok &&
      !invio.ok &&
      stagione.stato?.stringValue === 'in_attesa' &&
      stagione.richiestaId?.stringValue === T1 &&
      statoT1 === 'aperta' &&
      conferme === 0;
    if (vinceConferma) esiti.conferma += 1;
    else if (vinceInvio) esiti.invio += 1;
    else if (restaTutto) esiti.nessuno += 1;
    else {
      difetti.push(
        `giro ${giro + 1} (ritardo ${ritardo} ms): conferma ${conferma.ok ? 'riuscita' : 'rifiutata'}, ` +
          `nuovo invio ${invio.ok ? 'riuscito' : 'rifiutato'}, stagione «${stagione.stato?.stringValue}», ` +
          `T1 «${statoT1}», T2 «${statoT2}», ${conferme} conferme`,
      );
    }
  }

  if (difetti.length === 0) {
    ok(
      `conferma e nuovo invio insieme, ${GIRI} volte: sempre uno solo dei due ` +
        `(${esiti.conferma} la conferma, ${esiti.invio} l’invio, ${esiti.nessuno} nessuno)`,
    );
  } else {
    no(
      'conferma e nuovo invio insieme: la stagione resta confermata con T1 usata, oppure T1 revocata senza conferma',
      `${difetti.length} giri su ${GIRI}:\n      ${difetti.join('\n      ')}`,
    );
  }
}

// ---- Il tetto di cinque richieste, con le richieste insieme -------------
// §8.4: cinque richieste aperte per lavoratore. `creaRichiesta` le conta prima del batch,
// fuori da una transazione: otto richieste partite insieme leggevano tutte «zero aperte» e
// passavano tutte. Si contano le richieste aperte la cui stagione le aspetta ancora, che
// sono quelle che il tetto deve fermare. Tre giri, su tre lavoratori nuovi: la gara non
// deve riuscire in nessuno.
await titolo('Il tetto di cinque richieste, con le richieste insieme');
{
  await azzera();
  const GIRI = 3;
  const risultati = [];

  for (let giro = 0; giro < GIRI; giro += 1) {
    const mario = await preparaLavoratore(`347 95${giro} 0001`, `Piera${giro}`, `inv-${giro}`);
    for (let i = 0; i < 8; i += 1) {
      await creaStagione(mario.uid, `stagione-${i}`, {
        strutturaId: { stringValue: `struttura-${i}` },
        dal: { stringValue: `202${i}-05` },
        al: { stringValue: `202${i}-09` },
      });
    }

    const esiti = await Promise.all(
      Array.from({ length: 8 }, (_, i) =>
        chiamaInsieme(
          creaRichiesta,
          { stagioneId: `stagione-${i}`, nomeResponsabile: 'Ciro', telefonoResponsabile: `+39348950${giro}00${i}` },
          mario,
        ),
      ),
    );

    const richieste = ((await leggi('richieste?pageSize=300'))?.documents ?? []).filter(
      (d) => d.fields?.workerUid?.stringValue === mario.uid && d.fields?.stato?.stringValue === 'aperta',
    );
    let aspettate = 0;
    for (const r of richieste) {
      const id = r.name.split('/').at(-1);
      const stagione = (await leggi(`workers/${mario.uid}/stagioni/${r.fields.stagioneId.stringValue}`))?.fields ?? {};
      if (stagione.richiestaId?.stringValue === id && stagione.stato?.stringValue === 'in_attesa') aspettate += 1;
    }
    risultati.push({ riuscite: esiti.filter((e) => e.ok).length, aspettate });
  }

  const troppe = risultati.filter((r) => r.aspettate > 5);
  if (troppe.length > 0) {
    no(
      'otto richieste insieme: al massimo cinque restano in attesa',
      `${troppe.length} giri su ${GIRI} oltre il tetto: ${risultati
        .map((r) => `${r.riuscite} riuscite e ${r.aspettate} in attesa`)
        .join('; ')} (atteso al massimo 5)`,
    );
  } else {
    ok(`otto richieste insieme, ${GIRI} volte: al massimo cinque restano in attesa (${risultati.map((r) => r.aspettate).join(', ')})`);
  }
}

// ---- Revoca -------------------------------------------------------------
await titolo('La revoca del responsabile');
{
  await azzera();
  const mario = await preparaLavoratore('347 800 0001', 'Mario', 'inv-1');
  await creaStagione(mario.uid, 'sua');

  const esito = await chiama(
    'creaRichiesta',
    { stagioneId: 'sua', nomeResponsabile: 'Ciro', telefonoResponsabile: '+393488000002' },
    mario,
  );
  const token = esito.risultato.token;
  const responsabile = await entra('348 800 0002');
  await chiama('confermaStagione', { token, ...CONFERMA_VALIDA }, responsabile);

  const vista = await chiama('leggiRichiesta', { token }, responsabile);
  if (vista.risultato?.revocabile === true) ok('chi ha confermato vede che può revocare');
  else no('chi ha confermato vede che può revocare', JSON.stringify(vista.risultato));

  const estraneo = await entra('349 999 0002');
  await deveFallire(
    'revocare la conferma di un altro',
    chiama('revocaConferma', { token }, estraneo),
  );

  await deveRiuscire('revocare la propria conferma', chiama('revocaConferma', { token }, responsabile));

  const stagione = await leggi(`workers/${mario.uid}/stagioni/sua`);
  const campi = stagione?.fields ?? {};
  if (campi.stato?.stringValue === 'bozza' && (campi.competenzeConfermate?.arrayValue?.values ?? []).length === 0) {
    ok('dopo la revoca la stagione torna in bozza e pulita');
  } else {
    no('dopo la revoca la stagione torna in bozza e pulita', JSON.stringify(campi.stato));
  }

  await deveFallire('revocare due volte', chiama('revocaConferma', { token }, responsabile));

  const struttura = await leggi('strutture/struttura-1');
  const conteggio = Number(struttura?.fields?.nConferme?.integerValue ?? 0);
  if (conteggio < 0) {
    no('i conteggi non scendono sotto zero', `strutture/struttura-1 ha nConferme ${conteggio}`);
  } else {
    ok(`i conteggi restano sani dopo la revoca (nConferme: ${conteggio})`);
  }
}

// ---- L'eliminazione dell'account -----------------------------------------
await titolo('L’eliminazione dell’account');
{
  await azzera();
  const mario = await preparaLavoratore('347 850 0001', 'Mario', 'inv-1');
  await creaStagione(mario.uid, 'sua');
  await creaStagione(mario.uid, 'altra', { strutturaId: { stringValue: 'struttura-2' } });

  const esito = await chiama(
    'creaRichiesta',
    { stagioneId: 'sua', nomeResponsabile: 'Ciro', telefonoResponsabile: '+393488500002' },
    mario,
  );
  const responsabile = await entra('348 850 0002');
  await chiama('confermaStagione', { token: esito.risultato.token, ...CONFERMA_VALIDA }, responsabile);
  await new Promise((r) => setTimeout(r, 1500));

  if (!(await leggi('profiliPubblici/mario-0001'))) {
    no('la pagina pubblica esiste prima della cancellazione', 'non c’era già');
  }

  await deveRiuscire('eliminare l’account', chiama('eliminaAccount', { conferma: 'ELIMINA' }, mario));

  // Si aspetta con calma: la cancellazione delle stagioni fa ripartire il trigger che
  // riscrive la pagina pubblica, ed è proprio lì che prima la pagina resuscitava —
  // restando leggibile a chiunque dopo che una persona aveva chiesto di cancellare tutto.
  await new Promise((r) => setTimeout(r, 4000));

  if (await leggi('profiliPubblici/mario-0001')) {
    no('dopo la cancellazione la pagina pubblica non torna', 'è stata riscritta dal trigger');
  } else {
    ok('dopo la cancellazione la pagina pubblica non torna');
  }

  if (await leggi(`workers/${mario.uid}`)) no('il profilo è cancellato', 'esiste ancora');
  else ok('il profilo è cancellato');

  if (await leggi(`responsabili/${mario.uid}`)) {
    no('il telefono di chi cancella sparisce', 'responsabili/{uid} esiste ancora');
  } else {
    ok('il telefono di chi cancella sparisce anche da `responsabili`');
  }
}

// ---- Il CV di un profilo che non lo mostra ------------------------------
await titolo('Il CV e la pagina pubblica');
{
  await azzera();
  const mario = await preparaLavoratore('347 900 0001', 'Mario', 'inv-1');
  await new Promise((r) => setTimeout(r, 1200));

  await deveFallire(
    'chiedere il CV di chi non ne ha uno',
    chiama('urlCv', { slug: 'mario-0001' }),
  );
  await deveFallire('chiedere il CV di un profilo inventato', chiama('urlCv', { slug: 'non-esiste' }));

  // Profilo reso privato: la pagina pubblica sparisce del tutto.
  await scriviCampi(`workers/${mario.uid}`, {
    privacy: {
      mapValue: {
        fields: {
          pubblico: { booleanValue: false },
          mostraTelefono: { booleanValue: false },
          mostraInAttesa: { booleanValue: false },
          mostraCv: { booleanValue: false },
        },
      },
    },
  });
  await new Promise((r) => setTimeout(r, 1500));
  if (await leggi('profiliPubblici/mario-0001')) {
    no('un profilo reso privato non è più leggibile', 'la pagina pubblica esiste ancora');
  } else {
    ok('un profilo reso privato non è più leggibile');
  }
}

// ---- Una stagione cancellata ------------------------------------------
await titolo('Una stagione cancellata si porta via la sua conferma');
{
  await azzera();
  const mario = await preparaLavoratore('347 960 0001', 'Mario', 'inv-1');
  await creaStagione(mario.uid, 'confermata');
  await creaStagione(mario.uid, 'in-attesa', { dal: { stringValue: '2025-05' }, al: { stringValue: '2025-09' } });
  const prima = await chiama(
    'creaRichiesta',
    { stagioneId: 'confermata', nomeResponsabile: 'Ciro', telefonoResponsabile: '+393489600002' },
    mario,
  );
  const ciro = await entra('348 960 0002');
  await chiama('confermaStagione', { token: prima.risultato.token, ...CONFERMA_VALIDA }, ciro);
  const seconda = await chiama(
    'creaRichiesta',
    { stagioneId: 'in-attesa', nomeResponsabile: 'Ciro', telefonoResponsabile: '+393489600002' },
    mario,
  );

  // Dal libretto non si può, ma le regole lo lasciano fare: è roba sua.
  await fetch(`${documenti}/workers/${mario.uid}/stagioni/confermata`, {
    method: 'DELETE',
    headers: { Authorization: 'Bearer owner' },
  });
  await fetch(`${documenti}/workers/${mario.uid}/stagioni/in-attesa`, {
    method: 'DELETE',
    headers: { Authorization: 'Bearer owner' },
  });
  await new Promise((r) => setTimeout(r, 2500));

  const conferme = await fetch(`${documenti}/conferme`, { headers: { Authorization: 'Bearer owner' } }).then((r) =>
    r.json(),
  );
  const responsabile = await leggi(`responsabili/${ciro.uid}`);
  if ((conferme.documents ?? []).length === 0 && responsabile?.fields?.nConferme?.integerValue === '0') {
    ok('la conferma di una stagione cancellata se ne va, e il conteggio scende');
  } else {
    no(
      'la conferma di una stagione cancellata se ne va, e il conteggio scende',
      `conferme: ${(conferme.documents ?? []).length}, nConferme: ${responsabile?.fields?.nConferme?.integerValue}`,
    );
  }
  const link = await leggi(`richieste/${seconda.risultato.token}`);
  if (link?.fields?.stato?.stringValue === 'revocata') ok('il link di una stagione cancellata si chiude');
  else no('il link di una stagione cancellata si chiude', `stato: ${link?.fields?.stato?.stringValue}`);
}

// ---- I numeri che non servono più --------------------------------------
await titolo('La pulizia dei numeri che non servono più (§9)');
{
  await azzera();
  const mario = await preparaLavoratore('347 950 0001', 'Mario', 'inv-1');
  await creaStagione(mario.uid, 'sua');
  const esito = await chiama(
    'creaRichiesta',
    { stagioneId: 'sua', nomeResponsabile: 'Ciro', telefonoResponsabile: '+393489500002' },
    mario,
  );
  const ciro = await entra('348 950 0002');
  await chiama('confermaStagione', { token: esito.risultato.token, ...CONFERMA_VALIDA }, ciro);

  // Chi ha aperto un link, ha verificato il numero e non ha confermato niente.
  const passante = await entra('348 950 0003');
  // Un responsabile la cui conferma non c'è più (revocata, o il lavoratore se n'è andato).
  const exResponsabile = await entra('348 950 0004');
  await scriviDocumento('responsabili', exResponsabile.uid, {
    telefono: { stringValue: exResponsabile.telefono },
    nConferme: { integerValue: '0' },
    updatedAt: { timestampValue: new Date().toISOString() },
  });
  // Una pagina pubblica rimasta senza nessuno dietro.
  await scriviDocumento('profiliPubblici', 'fantasma-0001', { nome: { stringValue: 'Fantasma' } });

  // Subito non si tocca niente: i 90 giorni non sono passati.
  await eseguiPulizia();
  if ((await esisteAccesso(passante.uid)) && (await esisteAccesso(exResponsabile.uid))) {
    ok('prima di 90 giorni gli accessi restano');
  } else {
    no('prima di 90 giorni gli accessi restano', 'qualcuno è stato tolto troppo presto');
  }

  await eseguiPulizia(Timestamp.fromMillis(Date.now() + 91 * 24 * 60 * 60 * 1000));

  if (!(await esisteAccesso(passante.uid)) && !(await esisteAccesso(exResponsabile.uid))) {
    ok('dopo 90 giorni si tolgono gli accessi di chi non ha libretto né conferme');
  } else {
    no('dopo 90 giorni si tolgono gli accessi di chi non ha libretto né conferme', 'sono ancora lì');
  }
  if (await leggi(`responsabili/${exResponsabile.uid}`)) {
    no('il numero di un responsabile senza più conferme se ne va', 'il documento è ancora lì');
  } else {
    ok('il numero di un responsabile senza più conferme se ne va');
  }
  if ((await esisteAccesso(mario.uid)) && (await esisteAccesso(ciro.uid)) && (await leggi(`responsabili/${ciro.uid}`))) {
    ok('restano il lavoratore e il responsabile che ha una conferma in piedi');
  } else {
    no('restano il lavoratore e il responsabile che ha una conferma in piedi', 'uno dei due è stato tolto');
  }
  if (await leggi('profiliPubblici/fantasma-0001')) {
    no('una pagina pubblica senza lavoratore dietro si toglie', 'è ancora leggibile');
  } else {
    ok('una pagina pubblica senza lavoratore dietro si toglie');
  }
}

// ---- L'aiuto per le gare ------------------------------------------------
// Prima delle prove che lo usano, una che dice che l'aiuto fa quello che promette: se
// smettesse di agganciarsi alla lettura, le gare qui sotto passerebbero senza essere mai
// partite. (Le prove di gara controllano anche `scattata`, ma questo dice subito perché.)
await titolo('L’aiuto per le gare scatta dopo la lettura, una volta sola');
{
  await azzera();
  for (const id of ['a', 'b']) await scriviDocumento('aiuto', id, { n: { integerValue: '1' } });
  await scriviDocumento('aiuto/a/figli', 'f', { n: { integerValue: '1' } });

  const letture = [
    ['una lettura di collezione', () => db.collection('aiuto').get()],
    ['una query con una condizione', () => db.collection('aiuto').where('n', '==', 1).get()],
    ['un gruppo di collezioni', () => db.collectionGroup('figli').get()],
  ];
  for (const [nome, leggiDaCapo] of letture) {
    let fatte = 0;
    const stato = inMezzo(
      (percorso) => percorso.startsWith('aiuto/'),
      async () => {
        // L'azione legge anche lei: non deve far ripartire se stessa.
        await db.collection('aiuto').get();
        fatte += 1;
      },
    );
    await leggiDaCapo();
    const allaPrima = fatte;
    await leggiDaCapo();
    disarma();
    if (stato.scattata && allaPrima === 1 && fatte === 1 && !stato.errore) {
      ok(`${nome}: l’azione è già fatta quando il codice riprende, e non si ripete`);
    } else {
      no(
        `${nome}: l’azione è già fatta quando il codice riprende, e non si ripete`,
        `scattata ${stato.scattata}, fatta alla prima lettura ${allaPrima} volte e in tutto ${fatte}, errore ${stato.errore ?? 'nessuno'}`,
      );
    }
  }
}

// ---- LF-2 · Il tetto di dieci conferme e l'account cancellato ----------
// Il tetto della §8.4 conta le conferme delle ultime 24 ore per **uid** del responsabile.
// L'uid è il suo accesso, e un accesso si cancella con `eliminaAccount` (che a chi non ha
// un libretto non chiede niente) e si rifà con lo stesso numero: uid nuovo, conteggio a
// zero, altre dieci conferme. Le conferme già date restano (sono dei lavoratori), ma non
// contano più per chi le ha date. Il tetto deve seguire il **numero**, non l'accesso.
await titolo('LF-2 · Il tetto di dieci conferme non si azzera cancellando l’account');
{
  await azzera();
  const primo = await entra('348 610 0001');

  // Dieci lavoratori diversi, in dieci strutture diverse, tutti allo stesso numero.
  const daConfermare = async (i, responsabile) => {
    const lavoratore = await preparaLavoratore(
      `347 61${String(i).padStart(2, '0')} 001`,
      `Tizio${i}`,
      `inv-${i}`,
    );
    await creaStagione(lavoratore.uid, 'sua', { strutturaId: { stringValue: `struttura-${i}` } });
    const esito = await chiama(
      'creaRichiesta',
      { stagioneId: 'sua', nomeResponsabile: 'Ciro', telefonoResponsabile: responsabile.telefono },
      lavoratore,
    );
    return esito.ok ? esito.risultato.token : null;
  };

  let date = 0;
  for (let i = 0; i < 10; i += 1) {
    const token = await daConfermare(i, primo);
    const conferma = token ? await chiama('confermaStagione', { token, ...CONFERMA_VALIDA }, primo) : null;
    if (conferma?.ok) date += 1;
    else no(`la conferma numero ${i + 1} doveva passare`, conferma?.errore?.message ?? 'la richiesta non è partita');
  }
  if (date === 10) ok('dieci conferme date dallo stesso numero');

  await deveRiuscire(
    'chi non ha un libretto può cancellare l’account',
    chiama('eliminaAccount', { conferma: 'ELIMINA' }, primo),
  );
  const secondo = await entra('348 610 0001');
  if (secondo.uid !== primo.uid && secondo.telefono === primo.telefono) {
    ok('rientrando con lo stesso numero l’accesso è nuovo (uid diverso)');
  } else {
    no('rientrando con lo stesso numero l’accesso è nuovo (uid diverso)', 'lo stesso uid: la prova non prova niente');
  }

  const undicesima = await daConfermare(10, secondo);
  const dopo = undicesima
    ? await chiama('confermaStagione', { token: undicesima, ...CONFERMA_VALIDA }, secondo)
    : { ok: false, errore: { message: 'la richiesta non è partita' } };
  if (dopo.ok) {
    no(
      'l’undicesima conferma in un giorno, dopo aver cancellato e rifatto l’accesso',
      'è passata, e non doveva: il tetto contava l’uid del responsabile, non il suo numero',
    );
  } else {
    ok(`l’undicesima conferma in un giorno, dopo aver cancellato e rifatto l’accesso → «${dopo.errore?.message}»`);
  }

  // Controllo: gli stessi dati, a un numero che non ha confermato niente, passano. Dice
  // che il rifiuto qui sopra è del tetto e non di una richiesta scritta male.
  const altro = await entra('348 610 0002');
  const dodicesima = await daConfermare(11, altro);
  await deveRiuscire(
    'controllo: un altro numero, alla sua prima conferma, passa',
    dodicesima
      ? chiama('confermaStagione', { token: dodicesima, ...CONFERMA_VALIDA }, altro)
      : Promise.resolve({ ok: false, errore: { message: 'la richiesta non è partita' } }),
  );
}

// ---- LF-6 · Ruolo e competenze solo della §7, in creaRichiesta ----------
// Le regole oggi lasciano scrivere qualunque testo (fino a 40 caratteri) come ruolo e
// qualunque lista come competenze dichiarate. Una stagione scritta così — da un client
// fatto a mano, prima che le regole si correggano — arriva a `creaRichiesta`, che ne fa
// la «foto» che il responsabile legge nel messaggio e che la conferma poi rispetta. Il
// server non deve fidarsi delle regole: ruolo e competenze fuori dalla §7 non partono.
await titolo('LF-6 · Ruolo e competenze solo della §7, in creaRichiesta');
{
  await azzera();
  const mario = await preparaLavoratore('347 640 0001', 'Mario', 'inv-1');
  const ciro = await entra('348 640 0002');
  await creaStagione(mario.uid, 'stellato', { ruolo: { stringValue: 'Pizzaiolo stellato' } });
  await creaStagione(mario.uid, 'libera', {
    strutturaId: { stringValue: 'struttura-2' },
    ruolo: { stringValue: 'bar' },
    competenzeDichiarate: {
      arrayValue: { values: [{ stringValue: 'bar.caffetteria' }, { stringValue: 'Sommelier AIS' }] },
    },
  });
  const invio = (stagioneId) => ({
    stagioneId,
    nomeResponsabile: 'Ciro',
    telefonoResponsabile: ciro.telefono,
  });

  await deveFallire('un ruolo di testo libero («Pizzaiolo stellato»)', chiama('creaRichiesta', invio('stellato'), mario));

  // Il ruolo è previsto, una competenza no: la richiesta parte, ma senza il testo libero.
  const esito = await deveRiuscire(
    'un ruolo previsto con una competenza di testo libero: la richiesta parte',
    chiama('creaRichiesta', invio('libera'), mario),
  );
  if (esito.ok) {
    const token = esito.risultato.token;
    const foto = (await leggi(`richieste/${token}`))?.fields?.stagioneAlMomento?.mapValue?.fields;
    const dichiarate = (foto?.competenzeDichiarate?.arrayValue?.values ?? []).map((v) => v.stringValue);
    if (dichiarate.length === 1 && dichiarate[0] === 'bar.caffetteria') {
      ok('nella richiesta restano solo le competenze della §7');
    } else {
      no(
        'nella richiesta restano solo le competenze della §7',
        `stagioneAlMomento.competenzeDichiarate: ${JSON.stringify(dichiarate)}, atteso ["bar.caffetteria"]`,
      );
    }

    // Il responsabile non deve poter confermare il testo libero nemmeno chiedendolo: la
    // conferma tiene solo ciò che era nel messaggio.
    const conferma = await chiama(
      'confermaStagione',
      { token, ...CONFERMA_VALIDA, competenzeConfermate: ['bar.caffetteria', 'Sommelier AIS'] },
      ciro,
    );
    const confermate = conferma.risultato?.competenzeConfermate ?? [];
    if (conferma.ok && confermate.length === 1 && confermate[0] === 'bar.caffetteria') {
      ok('il testo libero non arriva alla conferma');
    } else {
      no(
        'il testo libero non arriva alla conferma',
        conferma.ok ? `confermate: ${JSON.stringify(confermate)}` : `la conferma è stata rifiutata: ${conferma.errore?.message}`,
      );
    }
  }
}

// ---- LF-7 · La pagina pubblica legge solo le stagioni che può mostrare --
// `ricostruisci` (profilo.ts) legge **tutte** le stagioni del lavoratore a ogni scrittura
// di una stagione, e poi ne scarta la maggior parte in memoria. Con le bozze, le scadute e
// le non confermate che si accumulano, ogni modifica costa una lettura per stagione. La
// pagina pubblica ne può mostrare solo due tipi: confermate e (se il lavoratore lo vuole)
// in attesa. Il resto non deve essere letto affatto.
await titolo('LF-7 · La pagina pubblica legge solo le stagioni che può mostrare');
{
  await azzera();
  const mario = await preparaLavoratore('347 650 0001', 'Mario', 'inv-1');
  const stato = (nome) => ({ stato: { stringValue: nome } });
  await creaStagione(mario.uid, 'confermata', {
    ...stato('confermata'),
    competenzeConfermate: { arrayValue: { values: [{ stringValue: 'bar.caffetteria' }] } },
    ruoloResponsabile: { stringValue: 'titolare' },
    riprenderebbe: { booleanValue: true },
  });
  await creaStagione(mario.uid, 'attesa', { ...stato('in_attesa'), richiestaId: { stringValue: 'x' } });
  for (const id of ['bozza1', 'bozza2', 'bozza3']) await creaStagione(mario.uid, id, stato('bozza'));
  await creaStagione(mario.uid, 'respinta', stato('non_confermata'));
  await creaStagione(mario.uid, 'vecchia', stato('scaduta'));

  // Si lascia finire i trigger partiti dalle scritture qui sopra, poi si ricostruisce la
  // pagina da qui, contando cosa legge.
  await attendi(2000);
  const letti = await lettureDurante(() => ricostruisciProfiloPubblico(mario.uid));
  const sotto = `workers/${mario.uid}/stagioni/`;
  const stagioniLette = letti.filter((p) => p.startsWith(sotto)).map((p) => p.slice(sotto.length));
  const nonPubblicabili = stagioniLette.filter((id) => id !== 'confermata' && id !== 'attesa');
  if (nonPubblicabili.length === 0) {
    ok(`legge solo stagioni che può mostrare (${stagioniLette.length} su 7: ${stagioniLette.join(', ')})`);
  } else {
    no(
      'legge solo le stagioni confermate o in attesa',
      `ha letto ${stagioniLette.length} stagioni su 7; non pubblicabili: ${nonPubblicabili.join(', ')}`,
    );
  }

  // Comportamento invariato: la pagina mostra la confermata, col ruolo di chi ha confermato.
  const confermate = await confermatePubbliche('mario-0001', true);
  const pagina = (await leggi('profiliPubblici/mario-0001'))?.fields ?? {};
  const mostrate = (pagina.stagioni?.arrayValue?.values ?? []).map((s) => s.mapValue?.fields ?? {});
  const una = mostrate[0] ?? {};
  const competenza = pagina.competenze?.mapValue?.fields?.confermate?.mapValue?.fields?.['bar.caffetteria'];
  if (
    confermate.length === 1 &&
    mostrate.length === 1 &&
    una.struttura?.stringValue === 'Bar Somma' &&
    una.ruoloResponsabile?.stringValue === 'titolare' &&
    una.riprenderebbe?.booleanValue === true &&
    competenza?.integerValue === '1' &&
    pagina.riepilogo?.mapValue?.fields?.nConfermate?.integerValue === '1'
  ) {
    ok('la pagina pubblica mostra ancora la stagione confermata, col ruolo di chi ha confermato');
  } else {
    no('la pagina pubblica mostra ancora la stagione confermata', `mostrate ${mostrate.length}, confermate ${confermate.length}`);
  }
}

// ---- LF-8 · La revoca in gara con la stagione cancellata ----------------
// Il lavoratore cancella una stagione confermata: il trigger toglie la conferma e scala i
// conteggi di struttura e responsabile (`dopoStagioneCancellata`). Se in quell'istante il
// responsabile sta revocando la stessa conferma, `revocaConferma` l'ha già letta fuori
// dalla transazione e dentro non la riguarda: scala i conteggi una seconda volta, e
// struttura e responsabile finiscono a −1 (e il «responsabile noto» si calcola su numeri
// sbagliati). Qui la cancellazione succede esattamente fra la lettura della revoca e la
// sua transazione. Non si pretende che la revoca riesca o fallisca: solo che i conteggi
// restino quelli veri.
await titolo('LF-8 · La revoca in gara con la stagione cancellata');
{
  await azzera();
  const mario = await preparaLavoratore('347 660 0001', 'Mario', 'inv-1');
  const ciro = await entra('348 660 0002');
  await scriviDocumento('strutture', 'struttura-1', { nConferme: { integerValue: '0' } });
  await creaStagione(mario.uid, 'sua');
  const richiesta = await chiama(
    'creaRichiesta',
    { stagioneId: 'sua', nomeResponsabile: 'Ciro', telefonoResponsabile: ciro.telefono },
    mario,
  );
  const token = richiesta.risultato?.token;
  await chiama('confermaStagione', { token, ...CONFERMA_VALIDA }, ciro);

  const struttura = intero(await leggi('strutture/struttura-1'), 'nConferme');
  const responsabile = intero(await leggi(`responsabili/${ciro.uid}`), 'nConferme');
  if (struttura === 1 && responsabile === 1) {
    ok('prima della gara la struttura e il responsabile hanno una conferma');
  } else {
    no('prima della gara la struttura e il responsabile hanno una conferma', `struttura ${struttura}, responsabile ${responsabile}`);
  }

  // La conferma sparisce appena la revoca l'ha letta, prima che parta la sua transazione.
  const gara = inMezzo(
    (percorso) => percorso.startsWith('conferme/'),
    () => dopoStagioneCancellata(mario.uid, 'sua'),
  );
  await chiamaInsieme(revocaConferma, { token }, ciro);
  disarma();

  if (!gara.scattata || gara.errore) {
    no(
      'la cancellazione è scattata fra la lettura e la transazione della revoca',
      gara.errore ? String(gara.errore) : 'la revoca non ha letto la conferma da una query: la prova non prova niente',
    );
  }
  const rimaste = ((await leggi('conferme'))?.documents ?? []).length;
  const strutturaDopo = intero(await leggi('strutture/struttura-1'), 'nConferme');
  const responsabileDopo = intero(await leggi(`responsabili/${ciro.uid}`), 'nConferme');
  if (rimaste === 0) ok('dopo la gara non resta nessuna conferma');
  else no('dopo la gara non resta nessuna conferma', `${rimaste} conferme`);
  if (strutturaDopo === 0 && responsabileDopo === 0) {
    ok('dopo la gara i conteggi sono a zero, non sotto');
  } else {
    no(
      'dopo la gara i conteggi sono a zero, non sotto',
      `strutture/struttura-1.nConferme ${strutturaDopo}, responsabili/{uid}.nConferme ${responsabileDopo} (atteso 0 e 0: la conferma è stata scalata due volte)`,
    );
  }
}

// ---- LF-8 · La pulizia non riporta indietro una stagione rimandata ------
// `sbloccaStagioniAppese` cerca le stagioni «in attesa», e per ognuna guarda se il link
// che aspetta è ancora aperto; se non lo è la mette «scaduta». Ma la stagione l'ha letta
// prima, e la scrive dopo, senza rileggerla: se nel mezzo il lavoratore la rimanda (un
// link nuovo, la stagione di nuovo «in attesa» di quello), la pulizia ragiona sul link
// vecchio e mette «scaduta» sopra il link nuovo. Il responsabile del link nuovo trova una
// stagione che non lo aspetta più.
await titolo('LF-8 · La pulizia non riporta indietro una stagione appena rimandata');
{
  await azzera();
  const mario = await preparaLavoratore('347 670 0001', 'Mario', 'inv-1');
  const ciro = await entra('348 670 0002');
  // Una stagione appesa: «in attesa» di un link che la richiesta dà per chiuso.
  await creaStagione(mario.uid, 'appesa', {
    stato: { stringValue: 'in_attesa' },
    richiestaId: { stringValue: 'link-vecchio' },
  });
  const giorniFa = (giorni) => new Date(Date.now() - giorni * 24 * 60 * 60 * 1000).toISOString();
  await scriviDocumento('richieste', 'link-vecchio', {
    workerUid: { stringValue: mario.uid },
    stagioneId: { stringValue: 'appesa' },
    nomeResponsabile: { stringValue: 'Ciro' },
    telefonoResponsabile: { stringValue: ciro.telefono },
    stato: { stringValue: 'scaduta' },
    createdAt: { timestampValue: giorniFa(40) },
    scadeIl: { timestampValue: giorniFa(10) },
  });

  // Il lavoratore rimanda la stagione nell'istante in cui la pulizia l'ha appena letta.
  const gara = inMezzo(
    (percorso) => percorso === `workers/${mario.uid}/stagioni/appesa`,
    () =>
      chiamaInsieme(
        creaRichiesta,
        { stagioneId: 'appesa', nomeResponsabile: 'Ciro', telefonoResponsabile: ciro.telefono },
        mario,
      ),
  );
  await eseguiPulizia();
  disarma();

  const rimandata = gara.esito;
  if (!gara.scattata || gara.errore || !rimandata?.ok) {
    no(
      'il lavoratore ha rimandato la stagione mentre la pulizia la guardava',
      gara.errore
        ? String(gara.errore)
        : !gara.scattata
          ? 'la pulizia non ha letto la stagione dalla collectionGroup: la prova non prova niente'
          : `creaRichiesta rifiutata: ${rimandata?.errore?.message}`,
    );
  } else {
    const nuovo = rimandata.risultato.token;
    const stagione = (await leggi(`workers/${mario.uid}/stagioni/appesa`))?.fields ?? {};
    if (stagione.stato?.stringValue === 'in_attesa' && stagione.richiestaId?.stringValue === nuovo) {
      ok('la stagione rimandata resta «in attesa» del link nuovo');
    } else {
      no(
        'la stagione rimandata resta «in attesa» del link nuovo',
        `stato «${stagione.stato?.stringValue}», richiestaId ${stagione.richiestaId?.stringValue === nuovo ? 'quello nuovo' : stagione.richiestaId?.stringValue}: ` +
          'la pulizia ha ragionato sul link vecchio',
      );
    }
    await deveRiuscire(
      'il responsabile del link nuovo conferma',
      chiama('confermaStagione', { token: nuovo, ...CONFERMA_VALIDA }, ciro),
    );
  }
}

// ---- LF-9 · Una segnalazione già gestita non conta per la sospensione ---
// §8.5: due «non ha mai lavorato qui» sospendono il libretto, finché Mike non lo guarda.
// Quando Mike l'ha guardato e ha tolto la sospensione, le due segnalazioni restano nel
// database con `gestita: true`. Se poi arriva un solo «mai lavorato» nuovo, il conteggio
// (che non guarda `gestita`) ne trova ancora due e il libretto viene sospeso di nuovo per
// una segnalazione sola, e la pagina pubblica sparisce.
await titolo('LF-9 · Una segnalazione già gestita non conta più per la sospensione');
{
  await azzera();
  const mario = await preparaLavoratore('347 680 0001', 'Mario', 'inv-1');
  await scriviDocumento('segnalazioni', 'vecchia', {
    tipo: { stringValue: 'mai_lavorato' },
    workerUid: { stringValue: mario.uid },
    richiestaId: { stringValue: 'x' },
    createdAt: { timestampValue: new Date().toISOString() },
    gestita: { booleanValue: true },
  });
  await creaStagione(mario.uid, 'sua');
  const ciro = await entra('348 680 0002');
  const esito = await chiama(
    'creaRichiesta',
    { stagioneId: 'sua', nomeResponsabile: 'Ciro', telefonoResponsabile: ciro.telefono },
    mario,
  );

  // Prima della segnalazione la pagina c'è (la scrive un trigger, in ritardo).
  const pagina = async (aspetta) => {
    const fine = Date.now() + aspetta;
    for (;;) {
      const p = await leggi('profiliPubblici/mario-0001');
      if (p || Date.now() >= fine) return p;
      await attendi(250);
    }
  };
  if (await pagina(6000)) ok('prima della segnalazione la pagina pubblica c’è');
  else no('prima della segnalazione la pagina pubblica c’è', 'non è stata scritta: la prova non prova niente');

  await deveRiuscire(
    'un «non ha mai lavorato qui» nuovo',
    chiama('segnalaStagione', { token: esito.risultato?.token, motivo: 'mai_lavorato' }, ciro),
  );
  await attendi(1500);

  if (await leggi(`sospensioni/${mario.uid}`)) {
    no(
      'una segnalazione nuova e una già gestita non sospendono il libretto',
      'sospensioni/{uid} esiste: la segnalazione gestita è stata contata',
    );
  } else {
    ok('una segnalazione nuova e una già gestita non sospendono il libretto');
  }
  if (await pagina(0)) ok('la pagina pubblica resta');
  else no('la pagina pubblica resta', 'profiliPubblici/mario-0001 non c’è più');
}

// ---- LF-11 · Elimina l'account cancella sempre foto e CV ----------------
// `eliminaAccount` cancella i file che il profilo indica (`fotoPath`, `cvPath`). Ma il
// profilo può non indicarli più mentre i file ci sono ancora: l'app toglie il CV dal
// profilo anche quando la cancellazione del file fallisce (`src/lib/privacy.ts`, il
// `catch(() => undefined)` e poi `cvPath: null`). Chi poi chiede di cancellare tutto
// si porta via il profilo, ma il PDF resta nello Storage per sempre. I percorsi sono
// sempre `foto/{uid}` e `cv/{uid}`: si cancellano senza leggere il profilo.
await titolo('LF-11 · Elimina l’account cancella sempre foto e CV');
{
  await azzera();
  // Un lavoratore col profilo «pulito» e i file ancora nello Storage.
  const orfano = await preparaLavoratore('347 690 0001', 'Orfano', 'inv-1');
  // E uno col profilo che li indica: il caso che oggi funziona, e che dice che il bucket
  // dove si caricano i file qui è lo stesso dove cancella `eliminaAccount`.
  const normale = await preparaLavoratore('347 690 0002', 'Normale', 'inv-2');
  await scriviCampi(`workers/${normale.uid}`, {
    fotoPath: { stringValue: `foto/${normale.uid}` },
    cvPath: { stringValue: `cv/${normale.uid}` },
  });

  const file = [orfano, normale].flatMap((l) => [
    [`foto/${l.uid}`, 'image/png'],
    [`cv/${l.uid}`, 'application/pdf'],
  ]);
  for (const [percorso, tipo] of file) await caricaFile(percorso, tipo);
  const caricati = await Promise.all(file.map(([percorso]) => esisteFile(percorso)));
  if (caricati.every(Boolean)) {
    ok(`quattro file nello Storage dell’emulatore (${BUCKET})`);
  } else {
    no('quattro file nello Storage dell’emulatore', `caricati: ${JSON.stringify(caricati)}`);
  }

  await deveRiuscire('eliminare l’account di chi ha il profilo pulito', chiama('eliminaAccount', { conferma: 'ELIMINA' }, orfano));
  await deveRiuscire('eliminare l’account di chi ha i percorsi nel profilo', chiama('eliminaAccount', { conferma: 'ELIMINA' }, normale));

  // Controllo positivo: i file indicati nel profilo se ne vanno. Se restassero, il bucket
  // dove ha caricato questa prova non sarebbe quello di `eliminaAccount`.
  const normaleFoto = await esisteFile(`foto/${normale.uid}`);
  const normaleCv = await esisteFile(`cv/${normale.uid}`);
  if (!normaleFoto && !normaleCv) {
    ok('controllo: foto e CV indicati nel profilo se ne vanno (il bucket è quello giusto)');
  } else {
    no(
      'controllo: foto e CV indicati nel profilo se ne vanno',
      `restano ${[normaleFoto && 'la foto', normaleCv && 'il CV'].filter(Boolean).join(' e ')} anche con i percorsi nel profilo: ` +
        `il bucket ${BUCKET} non è quello di eliminaAccount, la prova non prova niente`,
    );
  }

  const orfanoFoto = await esisteFile(`foto/${orfano.uid}`);
  const orfanoCv = await esisteFile(`cv/${orfano.uid}`);
  if (!orfanoFoto) ok('la foto che il profilo non indica più se ne va con l’account');
  else no('la foto che il profilo non indica più se ne va con l’account', `foto/${orfano.uid} è ancora nello Storage`);
  if (!orfanoCv) ok('il CV che il profilo non indica più se ne va con l’account');
  else no('il CV che il profilo non indica più se ne va con l’account', `cv/${orfano.uid} è ancora nello Storage`);

  // Un emulatore che resta acceso non deve tenersi i file di una prova rossa.
  for (const [percorso] of file) await toglieFile(percorso);
}

// ---------------------------------------------------------------- risultato

console.log(`\n${passate} prove passate, ${fallite.length} fallite.`);
if (fallite.length > 0) {
  console.error('\nNON VA:');
  fallite.forEach((f) => console.error(`  · ${f}`));
  process.exitCode = 1;
} else {
  console.log('Nessun caso rompe l’app.');
}
