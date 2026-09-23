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

import { normalizzaTelefono, scriviDocumento } from './emulatore.mjs';

// Il codice della pulizia notturna si importa e si esegue per davvero, contro gli
// emulatori. Vuole le funzioni compilate: `npm --prefix functions run build`.
process.env.FIRESTORE_EMULATOR_HOST ??= '127.0.0.1:8080';
process.env.GCLOUD_PROJECT ??= process.env.LIBRETTO_PROGETTO ?? 'libretto-prova';
const { eseguiPulizia } = await import('../functions/lib/pulizia.js');

const PROGETTO = process.env.LIBRETTO_PROGETTO ?? 'libretto-prova';
const FIRESTORE = process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080';
const AUTH = process.env.FIREBASE_AUTH_EMULATOR_HOST ?? '127.0.0.1:9099';
const FUNZIONI = process.env.LIBRETTO_FUNZIONI ?? '127.0.0.1:5001';
const REGIONE = 'europe-west8';

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
  await deveRiuscire(
    'confermare col link nuovo',
    chiama('confermaStagione', { token: secondo.risultato.token, ...CONFERMA_VALIDA }, responsabile),
  );
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

// ---------------------------------------------------------------- risultato

console.log(`\n${passate} prove passate, ${fallite.length} fallite.`);
if (fallite.length > 0) {
  console.error('\nNON VA:');
  fallite.forEach((f) => console.error(`  · ${f}`));
  process.exitCode = 1;
} else {
  console.log('Nessun caso rompe l’app.');
}
