// Il controllo prima di mandare online (settimana 6).
//
// Non prova il codice: quello lo fanno `npm test`, `prova:rottura` e `prova:flusso`.
// Qui si guardano le cose che si sbagliano quando si è di fretta e si sta per far
// entrare delle persone vere: puntare agli emulatori, dimenticare il progetto giusto,
// lasciare in giro un indirizzo email finto.
//
//   node strumenti/prontezza.mjs
//
// Esce con errore se c'è qualcosa che non deve andare online così com'è.

import { readFile } from 'node:fs/promises';

const radice = new URL('..', import.meta.url);

const blocchi = [];
const avvisi = [];

function ok(testo) {
  console.log(`  ✓ ${testo}`);
}

function blocca(testo, comeSiRisolve) {
  blocchi.push(`${testo} → ${comeSiRisolve}`);
  console.log(`  ✗ ${testo}\n      ${comeSiRisolve}`);
}

function avvisa(testo, perche) {
  avvisi.push(`${testo} — ${perche}`);
  console.log(`  ! ${testo}\n      ${perche}`);
}

async function leggi(nome) {
  try {
    return await readFile(new URL(nome, radice), 'utf8');
  } catch {
    return null;
  }
}

function valoriEnv(testo) {
  const valori = {};
  for (const riga of testo.split('\n')) {
    const pulita = riga.trim();
    if (pulita === '' || pulita.startsWith('#')) continue;
    const uguale = pulita.indexOf('=');
    if (uguale > 0) valori[pulita.slice(0, uguale).trim()] = pulita.slice(uguale + 1).trim();
  }
  return valori;
}

console.log('\nIl progetto Firebase');

const firebaserc = await leggi('.firebaserc');
let progettoConfigurato = null;
if (!firebaserc) {
  blocca('manca .firebaserc', 'cp .firebaserc.example .firebaserc e metti l’id del progetto');
} else {
  progettoConfigurato = JSON.parse(firebaserc).projects?.default;
  if (!progettoConfigurato || progettoConfigurato.includes('TUO')) {
    blocca('.firebaserc ha ancora il segnaposto', 'metti l’id vero del progetto Firebase');
  } else {
    ok(`progetto: ${progettoConfigurato}`);
  }
}

console.log('\nLa configurazione dell’app');

const env = await leggi('.env');
if (!env) {
  blocca('manca .env', 'cp .env.example .env e incolla la configurazione SDK dalla console');
} else {
  const valori = valoriEnv(env);

  if (valori.VITE_USA_EMULATORI === '1') {
    blocca(
      'VITE_USA_EMULATORI è 1',
      'la build punterebbe agli emulatori: mettilo a 0 prima del deploy',
    );
  } else {
    ok('non punta agli emulatori');
  }

  const obbligatorie = [
    'VITE_FIREBASE_API_KEY',
    'VITE_FIREBASE_AUTH_DOMAIN',
    'VITE_FIREBASE_PROJECT_ID',
    'VITE_FIREBASE_STORAGE_BUCKET',
    'VITE_FIREBASE_MESSAGING_SENDER_ID',
    'VITE_FIREBASE_APP_ID',
  ];
  const vuote = obbligatorie.filter((c) => !valori[c] || valori[c] === '');
  if (vuote.length > 0) {
    blocca(`configurazione incompleta: ${vuote.join(', ')}`, 'copiala dalla console Firebase');
  } else {
    ok('configurazione Firebase completa');
  }

  if (valori.VITE_FIREBASE_API_KEY?.includes('finta')) {
    blocca('la chiave è quella finta degli emulatori', 'metti quella del progetto vero');
  }

  if (
    progettoConfigurato &&
    valori.VITE_FIREBASE_PROJECT_ID &&
    valori.VITE_FIREBASE_PROJECT_ID !== progettoConfigurato
  ) {
    blocca(
      `.env punta a "${valori.VITE_FIREBASE_PROJECT_ID}" e .firebaserc a "${progettoConfigurato}"`,
      'l’app scriverebbe in un progetto e le regole andrebbero in un altro',
    );
  } else if (progettoConfigurato && valori.VITE_FIREBASE_PROJECT_ID) {
    ok('app e regole vanno sullo stesso progetto');
  }
}

console.log('\nLe scelte di prodotto');

const config = await leggi('src/config.ts');
if (!config) {
  blocca('manca src/config.ts', 'qualcosa non torna nel progetto');
} else {
  if (/BETA_SU_INVITO\s*=\s*true/.test(config)) {
    ok('si entra solo su invito (beta chiusa)');
  } else {
    avvisa(
      'la registrazione è aperta a tutti',
      'durante la beta dovrebbe essere su invito, e prima di aprirla serve PC5',
    );
  }

  const email = /EMAIL_PRIVACY\s*=\s*'([^']*)'/.exec(config)?.[1];
  if (!email || email.includes('example')) {
    avvisa(
      `l’email per le richieste privacy è un segnaposto (${email ?? 'mancante'})`,
      'per la beta chiusa può bastare, ma va messa quella vera prima di aprire a tutti (PC5)',
    );
  } else {
    ok(`email privacy: ${email}`);
  }

  const stagione = /STAGIONE_DISPONIBILITA\s*=\s*'([^']*)'/.exec(config)?.[1];
  const anno = new Date().getFullYear();
  if (stagione && Number(stagione) < anno) {
    avvisa(
      `la stagione della disponibilità è ${stagione}`,
      `siamo nel ${anno}: probabilmente va spostata avanti`,
    );
  } else if (stagione) {
    ok(`disponibilità per la stagione ${stagione}`);
  }
}

console.log('\nQueste non le posso controllare io');
console.log('  [ ] avviso di budget su Blaze, attivo e basso');
console.log('  [ ] invio SMS limitato alla sola Italia (Authentication → Settings)');
console.log('  [ ] i codici di invito creati in `inviti`');
console.log('  [ ] i numeri dei responsabili che conosci in `responsabiliNoti` (PC4)');
console.log('  [ ] informativa rivista da un professionista (PC5) — serve prima di aprire a tutti');

console.log('');
if (blocchi.length > 0) {
  console.error(`${blocchi.length} cose da sistemare prima del deploy:`);
  blocchi.forEach((b) => console.error(`  · ${b}`));
  process.exitCode = 1;
} else if (avvisi.length > 0) {
  console.log(`Si può mandare online. ${avvisi.length} cose da tenere a mente:`);
  avvisi.forEach((a) => console.log(`  · ${a}`));
} else {
  console.log('Tutto a posto: si può mandare online.');
}
