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

  // Decisione del 7 ottobre: un collega che Mike conosce come responsabile (il suo
  // numero è in `responsabiliNoti`) può confermare anche se ha lavorato lì nello stesso
  // periodo. Succede: il capo sala è spesso uno stagionale anche lui.
  await scriviDocumento('responsabiliNoti', collega.telefono, { nota: { stringValue: 'capo sala' } });
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

// ---------------------------------------------------------------- risultato

console.log(`\n${passate} prove passate, ${fallite.length} fallite.`);
if (fallite.length > 0) {
  console.error('\nNON VA:');
  fallite.forEach((f) => console.error(`  · ${f}`));
  process.exitCode = 1;
} else {
  console.log('Nessun caso rompe l’app.');
}
