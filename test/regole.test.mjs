// Test delle regole di sicurezza (§10).
//
// Non provano che l'app funziona: provano che l'app NON può fare quello che non deve.
// Sono la rete di sicurezza del principio della §1 — «ogni conferma che si vede è vera» —
// perché se dal client si potesse scrivere `stato: "confermata"`, tutto il resto non
// conterebbe niente.
//
//   npm test
//
// Si lanciano dentro l'emulatore Firestore, senza toccare il progetto vero.

import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { after, before, describe, it } from 'node:test';
import {
  collection,
  addDoc,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
} from 'firebase/firestore';

const LAVORATORE = 'uid-mario';
const TELEFONO = '+393471234567';
const ALTRO = 'uid-altro';
const INVITO = 'mike-2026';
const SLUG = 'mario-rossi-4f2a';

let env;

function comeMario() {
  return env.authenticatedContext(LAVORATORE, { phone_number: TELEFONO }).firestore();
}

function comeAltro() {
  return env.authenticatedContext(ALTRO, { phone_number: '+393480000000' }).firestore();
}

function senzaCollegarsi() {
  return env.unauthenticatedContext().firestore();
}

function profilo(modifiche = {}) {
  return {
    nome: 'Mario',
    cognome: 'Rossi',
    fotoPath: null,
    telefono: TELEFONO,
    ruoloPrincipale: 'sala',
    comune: 'Terracina',
    provincia: 'LT',
    geohash: 'sr0abcd',
    disponibile: false,
    stagioneDisponibile: '2027',
    slug: SLUG,
    privacy: { pubblico: true, mostraTelefono: false, mostraInAttesa: false, mostraCv: false },
    cvPath: null,
    consensi: { maggiorenne: serverTimestamp(), informativa: { versione: '1', ts: serverTimestamp() } },
    invito: INVITO,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...modifiche,
  };
}

function stagione(modifiche = {}) {
  return {
    strutturaId: 'struttura-1',
    strutturaNome: 'Agriturismo X',
    strutturaComune: 'Terracina',
    ruolo: 'sala',
    dal: '2025-05',
    al: '2025-09',
    competenzeDichiarate: ['sala.palmare', 'sala.rango'],
    competenzeConfermate: [],
    stato: 'bozza',
    nascosta: false,
    riprenderebbe: false,
    ruoloResponsabile: null,
    richiestaId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...modifiche,
  };
}

before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'libretto-prova-regole',
    firestore: { rules: readFileSync('firestore.rules', 'utf8') },
  });
});

after(async () => {
  await env?.cleanup();
});

/** Riporta il database allo stato di partenza: invito intestato a Mario, slug prenotato. */
async function preparaDati() {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'inviti', INVITO), { attivo: true, usatoDa: LAVORATORE });
    await setDoc(doc(db, 'inviti', 'libero-2026'), { attivo: true, usatoDa: null });
    await setDoc(doc(db, 'inviti', 'usato-2026'), { attivo: true, usatoDa: ALTRO });
    await setDoc(doc(db, 'inviti', 'spento-2026'), { attivo: false, usatoDa: null });
    // Creato dalla console con il solo `attivo`, senza il campo `usatoDa`.
    await setDoc(doc(db, 'inviti', 'senza-campo-2026'), { attivo: true });
    await setDoc(doc(db, 'slugs', SLUG), { uid: LAVORATORE });
    await setDoc(doc(db, 'slugs', 'preso-da-altri'), { uid: ALTRO });
  });
}

describe('inviti', () => {
  before(preparaDati);

  it('si legge conoscendo il codice esatto, anche senza essere collegati', async () => {
    // Serve così: il codice si controlla prima di mandare l'SMS, quando nessuno è collegato.
    await assertSucceeds(getDoc(doc(senzaCollegarsi(), 'inviti', 'libero-2026')));
  });

  it('non si può elencare', async () => {
    // Questo è ciò che rende il controllo qui sopra non pericoloso: i codici non si pescano.
    await assertFails(getDocs(collection(senzaCollegarsi(), 'inviti')));
  });

  it('si intesta al proprio uid', async () => {
    await assertSucceeds(
      updateDoc(doc(comeMario(), 'inviti', 'libero-2026'), { usatoDa: LAVORATORE, usatoIl: new Date() }),
    );
  });

  // Il 6 ottobre un collega si è sentito dire «codice già usato da un altro numero» con
  // un codice nuovo: creato dalla console senza `usatoDa`, la regola cercava un campo che
  // non c'era e rifiutava.
  it('si intesta anche se dalla console manca il campo usatoDa', async () => {
    await assertSucceeds(
      updateDoc(doc(comeMario(), 'inviti', 'senza-campo-2026'), { usatoDa: LAVORATORE, usatoIl: new Date() }),
    );
  });

  it('non si intesta a un altro uid', async () => {
    await preparaDati();
    await assertFails(updateDoc(doc(comeMario(), 'inviti', 'libero-2026'), { usatoDa: ALTRO }));
  });

  it('non si ruba un codice già usato', async () => {
    await assertFails(updateDoc(doc(comeMario(), 'inviti', 'usato-2026'), { usatoDa: LAVORATORE }));
  });

  it('un codice spento non si usa', async () => {
    await assertFails(updateDoc(doc(comeMario(), 'inviti', 'spento-2026'), { usatoDa: LAVORATORE }));
  });

  it('non si riaccende un codice spento', async () => {
    await assertFails(updateDoc(doc(comeMario(), 'inviti', 'spento-2026'), { attivo: true }));
  });

  it('non si creano codici dal client', async () => {
    await assertFails(setDoc(doc(comeMario(), 'inviti', 'inventato'), { attivo: true, usatoDa: null }));
  });
});

describe('indirizzi pubblici (slugs)', () => {
  before(preparaDati);

  it('si prenota col proprio uid', async () => {
    await assertSucceeds(setDoc(doc(comeMario(), 'slugs', 'mario-rossi-9999'), { uid: LAVORATORE }));
  });

  it('non si prenota a nome di un altro', async () => {
    await assertFails(setDoc(doc(comeMario(), 'slugs', 'mario-rossi-8888'), { uid: ALTRO }));
  });

  it('non si porta via un indirizzo già prenotato', async () => {
    await assertFails(setDoc(doc(comeMario(), 'slugs', 'preso-da-altri'), { uid: LAVORATORE }));
  });
});

describe('profilo del lavoratore', () => {
  before(preparaDati);

  it('si crea con invito intestato, slug prenotato e telefono verificato', async () => {
    await assertSucceeds(setDoc(doc(comeMario(), 'workers', LAVORATORE), profilo()));
  });

  it('non si crea senza codice di invito (beta chiusa, PC1)', async () => {
    await preparaDati();
    await assertFails(setDoc(doc(comeMario(), 'workers', LAVORATORE), profilo({ invito: null })));
  });

  it('non si crea con il codice di invito di un altro', async () => {
    await assertFails(setDoc(doc(comeMario(), 'workers', LAVORATORE), profilo({ invito: 'usato-2026' })));
  });

  it('non si crea con un indirizzo prenotato da un altro', async () => {
    await assertFails(
      setDoc(doc(comeMario(), 'workers', LAVORATORE), profilo({ slug: 'preso-da-altri' })),
    );
  });

  it('non si crea con un indirizzo che nessuno ha prenotato', async () => {
    await assertFails(setDoc(doc(comeMario(), 'workers', LAVORATORE), profilo({ slug: 'mai-visto-0000' })));
  });

  it('non si scrive un telefono diverso da quello verificato via SMS', async () => {
    await assertFails(
      setDoc(doc(comeMario(), 'workers', LAVORATORE), profilo({ telefono: '+393990000000' })),
    );
  });

  it('non si crea il profilo di un altro', async () => {
    await assertFails(setDoc(doc(comeMario(), 'workers', ALTRO), profilo()));
  });

  it('non si punta a una foto che non è la propria', async () => {
    await assertFails(
      setDoc(doc(comeMario(), 'workers', LAVORATORE), profilo({ fotoPath: `foto/${ALTRO}` })),
    );
  });

  it('i consensi della creazione portano l’ora del server', async () => {
    await assertFails(
      setDoc(
        doc(comeMario(), 'workers', LAVORATORE),
        profilo({ consensi: { maggiorenne: new Date('2020-01-01'), informativa: { versione: '1', ts: new Date('2020-01-01') } } }),
      ),
    );
  });

  it('non si crea un profilo senza i consensi', async () => {
    // Sono la base giuridica del trattamento (§9): senza, il profilo non esiste.
    const senzaConsensi = profilo();
    delete senzaConsensi.consensi;
    await assertFails(setDoc(doc(comeMario(), 'workers', LAVORATORE), senzaConsensi));

    await assertFails(
      setDoc(
        doc(comeMario(), 'workers', LAVORATORE),
        profilo({ consensi: { maggiorenne: new Date() } }),
      ),
    );
    await assertFails(
      setDoc(
        doc(comeMario(), 'workers', LAVORATORE),
        profilo({
          consensi: { maggiorenne: new Date(), informativa: { versione: '', ts: new Date() } },
        }),
      ),
    );
  });

  it('non si aggiungono campi non previsti', async () => {
    await assertFails(
      setDoc(doc(comeMario(), 'workers', LAVORATORE), profilo({ verificatoAdmin: true })),
    );
  });
});

describe('profilo già creato', () => {
  before(async () => {
    await preparaDati();
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'workers', LAVORATORE), profilo());
    });
  });

  it('lo legge il suo proprietario', async () => {
    await assertSucceeds(getDoc(doc(comeMario(), 'workers', LAVORATORE)));
  });

  it('non lo legge nessun altro', async () => {
    await assertFails(getDoc(doc(comeAltro(), 'workers', LAVORATORE)));
    await assertFails(getDoc(doc(senzaCollegarsi(), 'workers', LAVORATORE)));
  });

  it('non si elencano i profili', async () => {
    await assertFails(getDocs(collection(comeMario(), 'workers')));
  });

  it('la disponibilità si accende e si spegne', async () => {
    await assertSucceeds(
      updateDoc(doc(comeMario(), 'workers', LAVORATORE), { disponibile: true, updatedAt: new Date() }),
    );
  });

  it('la privacy si cambia', async () => {
    await assertSucceeds(
      updateDoc(doc(comeMario(), 'workers', LAVORATORE), {
        privacy: { pubblico: false, mostraTelefono: true, mostraInAttesa: true, mostraCv: false },
        updatedAt: new Date(),
      }),
    );
  });

  it('il telefono non si cambia', async () => {
    await assertFails(updateDoc(doc(comeMario(), 'workers', LAVORATORE), { telefono: '+393990000000' }));
  });

  it("l'indirizzo pubblico non si cambia", async () => {
    await assertFails(updateDoc(doc(comeMario(), 'workers', LAVORATORE), { slug: 'mario-il-migliore' }));
  });

  it('il codice di invito non si cambia', async () => {
    await assertFails(updateDoc(doc(comeMario(), 'workers', LAVORATORE), { invito: 'libero-2026' }));
  });

  it('i consensi non si possono cancellare dopo', async () => {
    await assertFails(updateDoc(doc(comeMario(), 'workers', LAVORATORE), { consensi: {} }));
    await assertFails(
      updateDoc(doc(comeMario(), 'workers', LAVORATORE), {
        consensi: { informativa: { versione: '2', ts: new Date() } },
      }),
    );
    // Accettare una versione nuova dell'informativa invece si deve poter fare, con l'ora
    // del server e senza toccare la dichiarazione dei 18 anni.
    await assertSucceeds(
      updateDoc(doc(comeMario(), 'workers', LAVORATORE), {
        'consensi.informativa': { versione: '2', ts: serverTimestamp() },
        updatedAt: new Date(),
      }),
    );
  });

  it("i consensi non si retrodatano: l'ora è quella del server", async () => {
    await assertFails(
      updateDoc(doc(comeMario(), 'workers', LAVORATORE), {
        'consensi.informativa': { versione: '2', ts: new Date('2020-01-01') },
      }),
    );
    await assertFails(
      updateDoc(doc(comeMario(), 'workers', LAVORATORE), {
        'consensi.maggiorenne': serverTimestamp(),
      }),
    );
  });

  it('nome e cognome non si cambiano: le conferme sono di quella persona', async () => {
    await assertFails(updateDoc(doc(comeMario(), 'workers', LAVORATORE), { nome: 'Luca' }));
    await assertFails(updateDoc(doc(comeMario(), 'workers', LAVORATORE), { cognome: 'Bianchi' }));
  });

  it('il profilo non si cancella dal client: ci pensa eliminaAccount', async () => {
    await assertFails(deleteDoc(doc(comeMario(), 'workers', LAVORATORE)));
  });
});

describe('stagioni', () => {
  const percorso = ['workers', LAVORATORE, 'stagioni'];

  before(async () => {
    await preparaDati();
    await env.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      await setDoc(doc(db, 'workers', LAVORATORE), profilo());
      await setDoc(doc(db, ...percorso, 'esistente'), stagione());
    });
  });

  it('una stagione in bozza si crea', async () => {
    await assertSucceeds(setDoc(doc(comeMario(), ...percorso, 'nuova'), stagione()));
  });

  it('non si nasce «in attesa»: quello stato lo scrive solo creaRichiesta', async () => {
    await assertFails(
      setDoc(doc(comeMario(), ...percorso, 'furba0'), stagione({ stato: 'in_attesa' })),
    );
  });

  it('una stagione in attesa non si modifica restando in attesa', async () => {
    // È il buco grosso: si mandava il link per il Bar Somma, si cambiava struttura
    // tenendo lo stato «in attesa», e il responsabile confermava un altro posto.
    // Correggere una stagione deve riportarla in bozza, e allora il link non vale più.
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(
        doc(ctx.firestore(), ...percorso, 'inAttesa'),
        stagione({ stato: 'in_attesa', richiestaId: 'token-vivo' }),
      );
    });

    await assertFails(
      updateDoc(doc(comeMario(), ...percorso, 'inAttesa'), {
        strutturaNome: 'Un altro posto',
        stato: 'in_attesa',
        updatedAt: new Date(),
      }),
    );
    await assertSucceeds(
      updateDoc(doc(comeMario(), ...percorso, 'inAttesa'), {
        strutturaNome: 'Un altro posto',
        stato: 'bozza',
        richiestaId: null,
        updatedAt: new Date(),
      }),
    );
  });

  it('non si nasce già confermata', async () => {
    await assertFails(
      setDoc(doc(comeMario(), ...percorso, 'furba'), stagione({ stato: 'confermata' })),
    );
  });

  it('non si scrive «lo riprenderebbe» da soli', async () => {
    await assertFails(
      setDoc(doc(comeMario(), ...percorso, 'furba2'), stagione({ riprenderebbe: true })),
    );
  });

  it('non si scrivono competenze confermate da soli', async () => {
    await assertFails(
      setDoc(
        doc(comeMario(), ...percorso, 'furba3'),
        stagione({ competenzeConfermate: ['sala.palmare'] }),
      ),
    );
  });

  it('non si scrive il ruolo del responsabile da soli', async () => {
    await assertFails(
      setDoc(doc(comeMario(), ...percorso, 'furba4'), stagione({ ruoloResponsabile: 'titolare' })),
    );
  });

  it('una stagione esistente non si promuove a confermata', async () => {
    await assertFails(
      updateDoc(doc(comeMario(), ...percorso, 'esistente'), { stato: 'confermata' }),
    );
  });

  it('una stagione esistente non si riempie di conferme a mano', async () => {
    await assertFails(
      updateDoc(doc(comeMario(), ...percorso, 'esistente'), {
        competenzeConfermate: ['sala.palmare'],
        riprenderebbe: true,
      }),
    );
  });

  it('una stagione respinta si corregge e torna in bozza', async () => {
    // È il caso di L3: il responsabile dice che i dati sono sbagliati, il lavoratore li
    // sistema e la richiesta riparte da capo.
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), ...percorso, 'respinta'), stagione({ stato: 'non_confermata' }));
    });
    await assertSucceeds(
      updateDoc(doc(comeMario(), ...percorso, 'respinta'), {
        strutturaNome: 'Agriturismo Y',
        stato: 'bozza',
        updatedAt: new Date(),
      }),
    );
  });

  // Il link di una stagione lo scrive solo creaRichiesta. Se lo scrivesse il client,
  // chi conosce il link di un altro — per esempio perché gli è arrivato da responsabile —
  // potrebbe metterlo su una sua stagione e farlo revocare da creaRichiesta, che chiude
  // il link precedente della stagione prima di mandarne uno nuovo.
  it('il link di una stagione non si scrive dal client, né creandola né correggendola', async () => {
    await assertFails(
      setDoc(doc(comeMario(), ...percorso, 'conLink'), stagione({ richiestaId: 'token-di-un-altro' })),
    );
    await assertFails(
      updateDoc(doc(comeMario(), ...percorso, 'esistente'), {
        richiestaId: 'token-di-un-altro',
        stato: 'bozza',
        updatedAt: new Date(),
      }),
    );
  });

  it('un periodo non finisce prima di cominciare', async () => {
    await assertFails(
      setDoc(doc(comeMario(), ...percorso, 'rovescia'), stagione({ dal: '2025-09', al: '2025-05' })),
    );
    await assertFails(
      updateDoc(doc(comeMario(), ...percorso, 'esistente'), {
        dal: '2025-09',
        al: '2025-05',
        stato: 'bozza',
        updatedAt: new Date(),
      }),
    );
    await assertSucceeds(
      setDoc(doc(comeMario(), ...percorso, 'unMese'), stagione({ dal: '2025-07', al: '2025-07' })),
    );
  });

  it('non si mette da soli lo stato «scaduta» o «non confermata»', async () => {
    // Li scrive solo la Cloud Function: "scaduta" la pulizia notturna, "non confermata"
    // il responsabile che dice che non corrisponde.
    await assertFails(updateDoc(doc(comeMario(), ...percorso, 'esistente'), { stato: 'scaduta' }));
    await assertFails(
      updateDoc(doc(comeMario(), ...percorso, 'esistente'), { stato: 'non_confermata' }),
    );
  });

  it('una stagione confermata si può nascondere, ma non modificare', async () => {
    // Nascondere è privacy (§1, regola 3) e deve funzionare sempre; cambiare i dati di
    // una stagione confermata no, altrimenti la conferma non varrebbe niente.
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(
        doc(ctx.firestore(), ...percorso, 'giaConfermata'),
        stagione({
          stato: 'confermata',
          competenzeConfermate: ['sala.palmare'],
          riprenderebbe: true,
          ruoloResponsabile: 'titolare',
        }),
      );
    });

    await assertSucceeds(
      updateDoc(doc(comeMario(), ...percorso, 'giaConfermata'), { nascosta: true, updatedAt: new Date() }),
    );
    await assertFails(
      updateDoc(doc(comeMario(), ...percorso, 'giaConfermata'), { strutturaNome: 'Un altro posto' }),
    );
    // Nascondere e insieme toccare un campo di fiducia non passa: i valori qui sono
    // diversi da quelli salvati, quindi è una modifica vera, non una scrittura a vuoto.
    await assertFails(
      updateDoc(doc(comeMario(), ...percorso, 'giaConfermata'), { nascosta: false, riprenderebbe: false }),
    );
    await assertFails(
      updateDoc(doc(comeMario(), ...percorso, 'giaConfermata'), {
        nascosta: false,
        competenzeConfermate: ['sala.palmare', 'sala.rango'],
      }),
    );
    await assertFails(
      updateDoc(doc(comeMario(), ...percorso, 'giaConfermata'), { nascosta: false, stato: 'bozza' }),
    );
  });

  it('i propri dati si correggono e si nascondono', async () => {
    await assertSucceeds(
      updateDoc(doc(comeMario(), ...percorso, 'esistente'), {
        ruolo: 'bar',
        nascosta: true,
        updatedAt: new Date(),
      }),
    );
  });

  it('le stagioni di un altro non si leggono né si scrivono', async () => {
    await assertFails(getDoc(doc(comeAltro(), ...percorso, 'esistente')));
    await assertFails(setDoc(doc(comeAltro(), ...percorso, 'intrusa'), stagione()));
  });

  it('una propria stagione si cancella', async () => {
    await assertSucceeds(deleteDoc(doc(comeMario(), ...percorso, 'esistente')));
  });
});

// ---- Ruoli e competenze della §7 ---------------------------------------
// Gli id dei ruoli e delle competenze stanno scritti in tre posti, perché nessuno dei tre
// può importare gli altri: `src/data/ruoli.ts` (l'app), `firestore.rules` (le regole) e
// `functions/src/ruoli.ts` (le funzioni). Qui i ruoli e le competenze dell'app si leggono
// **dal testo** del file, con espressioni regolari: gli script Node di questo repo non
// importano il TypeScript (vedi `strumenti/emulatore.mjs`).

/**
 * Le stringhe fra apici di una lista `[ ... ]`, saltando i commenti (che in italiano hanno
 * spesso un apostrofo). `da` è l'indice subito dopo la `[`; si ferma alla `]`.
 */
function stringheFraQuadre(testo, da) {
  const trovate = [];
  let i = da;
  while (i < testo.length) {
    const c = testo[i];
    if (c === ']') return trovate;
    if (c === '/' && testo[i + 1] === '/') {
      while (i < testo.length && testo[i] !== '\n') i += 1;
    } else if (c === '/' && testo[i + 1] === '*') {
      const fine = testo.indexOf('*/', i + 2);
      i = fine < 0 ? testo.length : fine + 2;
    } else if (c === "'" || c === '"' || c === '`') {
      let stringa = '';
      i += 1;
      while (i < testo.length && testo[i] !== c) {
        if (testo[i] === '\\') i += 1;
        stringa += testo[i];
        i += 1;
      }
      trovate.push(stringa);
      i += 1;
    } else {
      i += 1;
    }
  }
  return null;
}

/** La lista di stringhe che segue `intestazione` (un'espressione regolare che finisce con la `[`). */
function elencoDopo(testo, intestazione, cosaCerco) {
  const trovata = intestazione.exec(testo);
  assert.ok(trovata, `non trovo ${cosaCerco}`);
  const elenco = stringheFraQuadre(testo, trovata.index + trovata[0].length);
  assert.ok(elenco, `${cosaCerco}: l’elenco non finisce con una «]»`);
  return elenco;
}

/** Ruoli (con le loro competenze) e competenze di `src/data/ruoli.ts`, letti dal testo. */
function leggiRuoliDellApp() {
  const testo = readFileSync('src/data/ruoli.ts', 'utf8');

  const inizioCompetenze = testo.indexOf('export const COMPETENZE = {');
  const fineCompetenze = testo.indexOf('} as const', inizioCompetenze);
  assert.ok(inizioCompetenze >= 0 && fineCompetenze > inizioCompetenze, 'src/data/ruoli.ts: non trovo COMPETENZE');
  const competenze = [
    ...testo.slice(inizioCompetenze, fineCompetenze).matchAll(/^\s+'([A-Za-z]+\.[A-Za-z]+)':/gm),
  ].map((m) => m[1]);

  const inizioRuoli = testo.indexOf('export const RUOLI: Ruolo[] = [');
  assert.ok(inizioRuoli >= 0, 'src/data/ruoli.ts: non trovo RUOLI');
  const ruoli = [];
  const testaDiUnRuolo = /\{\s*id:\s*'([^']+)',\s*nome:\s*(?:'[^']*'|"[^"]*"),\s*competenze:\s*\[/g;
  for (const m of testo.slice(inizioRuoli).matchAll(testaDiUnRuolo)) {
    const elenco = stringheFraQuadre(testo, inizioRuoli + m.index + m[0].length);
    assert.ok(elenco, `src/data/ruoli.ts: l’elenco delle competenze di «${m[1]}» non finisce con una «]»`);
    ruoli.push({ id: m[1], competenze: elenco });
  }
  return { ruoli, competenze };
}

/** Due elenchi di id sono lo stesso insieme? Se no, dice quali mancano e quali sono di troppo. */
function stessoInsieme(copia, attesi, trovati) {
  const mancano = attesi.filter((id) => !trovati.includes(id));
  const inPiu = trovati.filter((id) => !attesi.includes(id));
  assert.ok(
    mancano.length === 0 && inPiu.length === 0,
    `${copia}: mancano ${JSON.stringify(mancano)}, in più ${JSON.stringify(inPiu)} rispetto a src/data/ruoli.ts`,
  );
}

describe('ruoli e competenze della §7', () => {
  const percorso = ['workers', LAVORATORE, 'stagioni'];
  const dellApp = leggiRuoliDellApp;

  before(async () => {
    await preparaDati();
    await env.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      await setDoc(doc(db, 'workers', LAVORATORE), profilo());
      // Stagioni scritte come le avrebbe lasciate un client a mano, prima che le regole
      // chiedessero ruoli e competenze della §7: restano nel database e devono restare gestibili.
      for (const id of ['liberaNascondi', 'liberaPeriodo', 'liberaRuolo', 'liberaCompetenza', 'liberaAltroRuolo']) {
        await setDoc(
          doc(db, ...percorso, id),
          stagione({ ruolo: 'Pizzaiolo stellato', competenzeDichiarate: ['Sommelier AIS'] }),
        );
      }
    });
  });

  it('src/data/ruoli.ts ha i 12 ruoli della §7, e ogni loro competenza esiste in COMPETENZE', () => {
    const { ruoli, competenze } = dellApp();
    assert.equal(ruoli.length, 12, `trovati ${ruoli.length} ruoli: ${ruoli.map((r) => r.id).join(', ')}`);
    assert.ok(competenze.length > 0, 'non ho trovato nessuna competenza in COMPETENZE');
    for (const ruolo of ruoli) {
      assert.ok(ruolo.competenze.length > 0, `il ruolo «${ruolo.id}» non ha competenze`);
      const sconosciute = ruolo.competenze.filter((c) => !competenze.includes(c));
      assert.deepEqual(sconosciute, [], `il ruolo «${ruolo.id}» ha competenze che non sono in COMPETENZE`);
    }
  });

  it('ogni ruolo della §7 si salva con tutte le sue competenze', async () => {
    // Protegge dalle regole troppo strette: un elenco sbagliato nelle regole bloccherebbe
    // chi sceglie quel ruolo o quella competenza in L4.
    const { ruoli } = dellApp();
    const rifiutati = [];
    for (const ruolo of ruoli) {
      try {
        await assertSucceeds(
          setDoc(
            doc(comeMario(), ...percorso, `ruolo-${ruolo.id}`),
            stagione({ ruolo: ruolo.id, competenzeDichiarate: ruolo.competenze }),
          ),
        );
      } catch {
        rifiutati.push(ruolo.id);
      }
    }
    assert.equal(
      rifiutati.length,
      0,
      `le regole rifiutano una stagione di questi ruoli, con tutte le loro competenze: ${rifiutati.join(', ')}`,
    );
  });

  it('una stagione non si crea con un ruolo di testo libero', async () => {
    // Controllo: la stessa stagione con un ruolo previsto si salva.
    await assertSucceeds(
      setDoc(
        doc(comeMario(), ...percorso, 'ruoloPrevisto'),
        stagione({ ruolo: 'bar', competenzeDichiarate: ['bar.caffetteria'] }),
      ),
    );
    await assertFails(
      setDoc(
        doc(comeMario(), ...percorso, 'ruoloLibero'),
        stagione({ ruolo: 'Pizzaiolo stellato', competenzeDichiarate: ['bar.caffetteria'] }),
      ),
    );
  });

  it('una stagione non si crea con competenze di testo libero', async () => {
    // Controllo: le stesse competenze, senza il testo libero, si salvano.
    await assertSucceeds(
      setDoc(
        doc(comeMario(), ...percorso, 'competenzePreviste'),
        stagione({ competenzeDichiarate: ['sala.palmare', 'sala.vino'] }),
      ),
    );
    await assertFails(
      setDoc(
        doc(comeMario(), ...percorso, 'competenzeLibere'),
        stagione({ competenzeDichiarate: ['sala.palmare', 'Sommelier AIS'] }),
      ),
    );
  });

  // Chi ha già una stagione col testo libero non deve restare bloccato: la deve poter
  // nascondere (privacy, §1 regola 3) e correggere. Quello che non si può è aggiungere
  // altro testo libero. Le modifiche sono quelle dell'app (`aggiornaStagione`): tutti i
  // dati della stagione, sempre in bozza e senza link.
  describe('una stagione già salvata con testo libero', () => {
    const comeLApp = (cambi) => {
      const { strutturaId, strutturaNome, strutturaComune, ruolo, dal, al, competenzeDichiarate } = stagione({
        ruolo: 'Pizzaiolo stellato',
        competenzeDichiarate: ['Sommelier AIS'],
      });
      return {
        strutturaId,
        strutturaNome,
        strutturaComune,
        ruolo,
        dal,
        al,
        competenzeDichiarate,
        ...cambi,
        stato: 'bozza',
        richiestaId: null,
        updatedAt: new Date(),
      };
    };

    it('si nasconde', async () => {
      await assertSucceeds(
        updateDoc(doc(comeMario(), ...percorso, 'liberaNascondi'), { nascosta: true, updatedAt: new Date() }),
      );
    });

    it('si corregge nel periodo, lasciando ruolo e competenze come sono', async () => {
      await assertSucceeds(
        updateDoc(doc(comeMario(), ...percorso, 'liberaPeriodo'), comeLApp({ dal: '2025-06' })),
      );
    });

    it('passa a un ruolo della §7 senza toccare le competenze', async () => {
      await assertSucceeds(updateDoc(doc(comeMario(), ...percorso, 'liberaRuolo'), comeLApp({ ruolo: 'bar' })));
    });

    it('non prende altre competenze di testo libero', async () => {
      await assertFails(
        updateDoc(
          doc(comeMario(), ...percorso, 'liberaCompetenza'),
          comeLApp({ competenzeDichiarate: ['Sommelier AIS', 'Barista campione'] }),
        ),
      );
    });

    it('non passa a un altro ruolo di testo libero', async () => {
      await assertFails(
        updateDoc(doc(comeMario(), ...percorso, 'liberaAltroRuolo'), comeLApp({ ruolo: 'Chef stellato' })),
      );
    });
  });

  // Le tre copie degli id devono restare uguali: se una si dimentica un ruolo, o ne ha uno
  // di troppo, o le regole rifiutano ciò che l'app offre, o le funzioni scartano ciò che le
  // regole lasciano passare.
  describe('le tre copie degli id coincidono', () => {
    it('firestore.rules ha gli stessi id di src/data/ruoli.ts', () => {
      const { ruoli, competenze } = dellApp();
      const regole = readFileSync('firestore.rules', 'utf8');
      const ruoliRegole = elencoDopo(
        regole,
        /function\s+ruoliPrevisti\s*\(\s*\)\s*\{\s*return\s*\[/,
        '«function ruoliPrevisti() { return [ ... ]; }» in firestore.rules',
      );
      const competenzeRegole = elencoDopo(
        regole,
        /function\s+competenzePreviste\s*\(\s*\)\s*\{\s*return\s*\[/,
        '«function competenzePreviste() { return [ ... ]; }» in firestore.rules',
      );
      stessoInsieme('firestore.rules, ruoliPrevisti()', ruoli.map((r) => r.id), ruoliRegole);
      stessoInsieme('firestore.rules, competenzePreviste()', competenze, competenzeRegole);
    });

    it('functions/src/ruoli.ts ha gli stessi id di src/data/ruoli.ts', () => {
      const { ruoli, competenze } = dellApp();
      assert.ok(
        existsSync('functions/src/ruoli.ts'),
        'functions/src/ruoli.ts non esiste: ci vogliono RUOLI_PREVISTI e COMPETENZE_PREVISTE con gli stessi id di src/data/ruoli.ts',
      );
      const funzioni = readFileSync('functions/src/ruoli.ts', 'utf8');
      const ruoliFunzioni = elencoDopo(
        funzioni,
        /export\s+const\s+RUOLI_PREVISTI\s*:\s*readonly\s+string\[\]\s*=\s*\[/,
        '«export const RUOLI_PREVISTI: readonly string[] = [ ... ];» in functions/src/ruoli.ts',
      );
      const competenzeFunzioni = elencoDopo(
        funzioni,
        /export\s+const\s+COMPETENZE_PREVISTE\s*:\s*readonly\s+string\[\]\s*=\s*\[/,
        '«export const COMPETENZE_PREVISTE: readonly string[] = [ ... ];» in functions/src/ruoli.ts',
      );
      stessoInsieme('functions/src/ruoli.ts, RUOLI_PREVISTI', ruoli.map((r) => r.id), ruoliFunzioni);
      stessoInsieme('functions/src/ruoli.ts, COMPETENZE_PREVISTE', competenze, competenzeFunzioni);
    });
  });
});

describe('quello che solo le Cloud Functions possono toccare', () => {
  before(async () => {
    await preparaDati();
    await env.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      await setDoc(doc(db, 'richieste', 'token123'), { workerUid: LAVORATORE, telefonoResponsabile: '+393480000000' });
      await setDoc(doc(db, 'conferme', 'conferma1'), { workerUid: LAVORATORE });
      await setDoc(doc(db, 'responsabili', ALTRO), { telefono: '+393480000000', verificatoAdmin: true });
      await setDoc(doc(db, 'segnalazioni', 'segn1'), { tipo: 'mai_lavorato', workerUid: LAVORATORE });
      await setDoc(doc(db, 'profiliPubblici', SLUG), { nome: 'Mario', riepilogo: { nConfermate: 0 } });
    });
  });

  it('il telefono del responsabile non si legge dal client', async () => {
    await assertFails(getDoc(doc(comeMario(), 'richieste', 'token123')));
    await assertFails(getDoc(doc(senzaCollegarsi(), 'richieste', 'token123')));
  });

  it('le conferme non si scrivono dal client', async () => {
    await assertFails(setDoc(doc(comeMario(), 'conferme', 'inventata'), { workerUid: LAVORATORE }));
    await assertFails(getDoc(doc(comeMario(), 'conferme', 'conferma1')));
  });

  it('nessuno si segna «responsabile noto» da sé', async () => {
    await assertFails(setDoc(doc(comeMario(), 'responsabili', LAVORATORE), { verificatoAdmin: true }));
  });

  it('la lista dei numeri noti non si legge né si scrive dal client', async () => {
    // È un elenco di telefoni di persone che non usano Libretto: non deve uscire di qui.
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'responsabiliNoti', '+393480000000'), { nota: 'Bar Somma' });
    });
    await assertFails(getDoc(doc(comeMario(), 'responsabiliNoti', '+393480000000')));
    await assertFails(getDocs(collection(comeMario(), 'responsabiliNoti')));
    await assertFails(setDoc(doc(comeMario(), 'responsabiliNoti', '+393499999999'), { nota: 'io' }));
  });

  it('un libretto sospeso non si legge né si cancella dal client', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'sospensioni', LAVORATORE), { motivo: 'due segnalazioni' });
    });
    await assertFails(getDoc(doc(comeMario(), 'sospensioni', LAVORATORE)));
    await assertFails(deleteDoc(doc(comeMario(), 'sospensioni', LAVORATORE)));
  });

  it('le statistiche delle conferme non si leggono né si scrivono dal client', async () => {
    await assertFails(getDoc(doc(comeMario(), 'statistiche', 'conferme')));
    await assertFails(setDoc(doc(comeMario(), 'statistiche', 'conferme'), { percentualeEntro7Giorni: 100 }));
  });

  it('le segnalazioni non si leggono né si cancellano dal client', async () => {
    await assertFails(getDoc(doc(comeMario(), 'segnalazioni', 'segn1')));
    await assertFails(deleteDoc(doc(comeMario(), 'segnalazioni', 'segn1')));
  });

  it('il profilo pubblico lo legge chiunque e non lo scrive nessuno', async () => {
    await assertSucceeds(getDoc(doc(senzaCollegarsi(), 'profiliPubblici', SLUG)));
    await assertFails(setDoc(doc(comeMario(), 'profiliPubblici', SLUG), { nome: 'Mario il Grande' }));
  });

  // «Raggiungibile solo da chi ha il tuo link» (L6, informativa): chi non conosce
  // l'indirizzo non deve poter scaricare l'elenco di tutti i profili. Con `read` al
  // posto di `get` si poteva, con una riga, anche senza essere collegati.
  it('i profili pubblici non si possono elencare, nemmeno da collegati', async () => {
    await assertFails(getDocs(collection(senzaCollegarsi(), 'profiliPubblici')));
    await assertFails(getDocs(collection(comeAltro(), 'profiliPubblici')));
  });
});

describe('strutture', () => {
  before(preparaDati);

  function struttura(modifiche = {}) {
    return {
      nome: 'Agriturismo X',
      nomeNormalizzato: 'agriturismo x',
      parole: ['agriturismo'],
      comune: 'Terracina',
      provincia: 'LT',
      geohash: 'sr0abcd',
      nConferme: 0,
      creataDa: LAVORATORE,
      unitaA: null,
      createdAt: new Date(),
      ...modifiche,
    };
  }

  it("si creano da chi è collegato, per l'autocompletamento", async () => {
    await assertSucceeds(addDoc(collection(comeMario(), 'strutture'), struttura()));
  });

  it('non si creano con conferme già in tasca', async () => {
    await assertFails(addDoc(collection(comeMario(), 'strutture'), struttura({ nConferme: 99 })));
  });

  it('non si creano a nome di un altro', async () => {
    await assertFails(addDoc(collection(comeMario(), 'strutture'), struttura({ creataDa: ALTRO })));
  });

  it('non si creano già unite a un’altra struttura', async () => {
    await assertFails(addDoc(collection(comeMario(), 'strutture'), struttura({ unitaA: 'struttura-1' })));
  });

  // Si leggono senza essere collegati: un campo senza limiti era spazio gratis per
  // chiunque, servito a tutti (revisione del 19/10). I limiti sono quelli che l'app
  // produce già da un nome di 120 caratteri.
  it('non si creano con un nome normalizzato senza limiti', async () => {
    await assertFails(
      addDoc(collection(comeMario(), 'strutture'), struttura({ nomeNormalizzato: 'x'.repeat(500) })),
    );
  });

  it('non si creano con parole troppo lunghe o che non sono testo', async () => {
    await assertFails(addDoc(collection(comeMario(), 'strutture'), struttura({ parole: ['x'.repeat(500)] })));
    await assertFails(addDoc(collection(comeMario(), 'strutture'), struttura({ parole: [{ a: 1 }] })));
  });

  it('non si creano con provincia o geohash fuori misura', async () => {
    await assertFails(addDoc(collection(comeMario(), 'strutture'), struttura({ provincia: 'x'.repeat(500) })));
    await assertFails(addDoc(collection(comeMario(), 'strutture'), struttura({ geohash: 'x'.repeat(500) })));
    await assertFails(addDoc(collection(comeMario(), 'strutture'), struttura({ geohash: 42 })));
  });

  it('un nome lungo come il massimo, scritto dall’app, passa ancora', async () => {
    const nome = `Agriturismo ${'Ulivo '.repeat(18)}`.trim().slice(0, 120);
    const normalizzato = nome.toLowerCase();
    const parole = [...new Set(normalizzato.split(' ').filter((p) => p.length >= 3))].slice(0, 12);
    await assertSucceeds(
      addDoc(
        collection(comeMario(), 'strutture'),
        struttura({ nome, nomeNormalizzato: normalizzato, parole }),
      ),
    );
  });

  it('si leggono senza essere collegati (serve in L4) ma non si modificano', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'strutture', 'struttura-1'), { nome: 'Bar Somma', nConferme: 3 });
    });
    await assertSucceeds(getDoc(doc(senzaCollegarsi(), 'strutture', 'struttura-1')));
    await assertFails(updateDoc(doc(comeMario(), 'strutture', 'struttura-1'), { nConferme: 100 }));
  });
});

describe('eventi (§12)', () => {
  before(preparaDati);

  it('si scrivono senza nome e cognome', async () => {
    await assertSucceeds(
      addDoc(collection(comeMario(), 'eventi'), {
        tipo: 'registrazione',
        uidAnonimo: 'a1b2c3',
        ts: serverTimestamp(),
      }),
    );
  });

  it('la data deve essere quella del server', async () => {
    // Senza questo si possono antidatare gli eventi e sporcare i numeri della §12.
    await assertFails(
      addDoc(collection(comeMario(), 'eventi'), {
        tipo: 'registrazione',
        uidAnonimo: 'a1b2c3',
        ts: new Date('2020-01-01'),
      }),
    );
  });

  it('non si rileggono: servono a contare, non a sapere chi', async () => {
    await assertFails(getDocs(collection(comeMario(), 'eventi')));
  });

  it('non si possono infilare altri dati', async () => {
    await assertFails(
      addDoc(collection(comeMario(), 'eventi'), {
        tipo: 'registrazione',
        uid: LAVORATORE,
        ts: serverTimestamp(),
      }),
    );
  });
});
