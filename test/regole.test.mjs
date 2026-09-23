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
import { readFileSync } from 'node:fs';
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
    consensi: { maggiorenne: new Date(), informativa: { versione: '1', ts: new Date() } },
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
    competenzeDichiarate: ['sala.palmare', 'sala.servizio'],
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
    // Accettare una versione nuova dell'informativa invece si deve poter fare.
    await assertSucceeds(
      updateDoc(doc(comeMario(), 'workers', LAVORATORE), {
        consensi: { maggiorenne: new Date(), informativa: { versione: '2', ts: new Date() } },
        updatedAt: new Date(),
      }),
    );
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

  it('le segnalazioni non si leggono né si cancellano dal client', async () => {
    await assertFails(getDoc(doc(comeMario(), 'segnalazioni', 'segn1')));
    await assertFails(deleteDoc(doc(comeMario(), 'segnalazioni', 'segn1')));
  });

  it('il profilo pubblico lo legge chiunque e non lo scrive nessuno', async () => {
    await assertSucceeds(getDoc(doc(senzaCollegarsi(), 'profiliPubblici', SLUG)));
    await assertFails(setDoc(doc(comeMario(), 'profiliPubblici', SLUG), { nome: 'Mario il Grande' }));
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
