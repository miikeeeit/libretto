// Test delle regole di Storage (§10): le foto e i CV.
//
// Come quelli di Firestore, non provano che l'app funziona: provano che non si può fare
// quello che non si deve. La foto è pubblica per chi ha il link della pagina, non per
// chi vuole scaricarle tutte; il CV non lo legge nessuno dal client.
//
//   npm test
//
// Si lanciano dentro l'emulatore Storage, senza toccare il progetto vero.

import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { readFileSync } from 'node:fs';
import { after, before, beforeEach, describe, it } from 'node:test';
import { getMetadata, listAll, ref, uploadBytes } from 'firebase/storage';

const LAVORATORE = 'uid-mario';
const ALTRO = 'uid-altro';

// Quattro byte bastano: le regole guardano tipo e dimensione, non il contenuto.
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);
const PDF = new TextEncoder().encode('%PDF-1.4\n%%EOF\n');

let env;

function comeMario() {
  return env.authenticatedContext(LAVORATORE, { phone_number: '+393471234567' }).storage();
}

function comeAltro() {
  return env.authenticatedContext(ALTRO, { phone_number: '+393480000000' }).storage();
}

function senzaCollegarsi() {
  return env.unauthenticatedContext().storage();
}

before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'libretto-prova-storage',
    storage: { rules: readFileSync('storage.rules', 'utf8') },
  });
});

after(async () => {
  await env?.cleanup();
});

/** La foto e il CV di Mario, caricati come farebbe lui. */
beforeEach(async () => {
  await env.clearStorage();
  await env.withSecurityRulesDisabled(async (ctx) => {
    await uploadBytes(ref(ctx.storage(), `foto/${LAVORATORE}`), JPEG, { contentType: 'image/jpeg' });
    await uploadBytes(ref(ctx.storage(), `foto/${ALTRO}`), JPEG, { contentType: 'image/jpeg' });
    await uploadBytes(ref(ctx.storage(), `cv/${LAVORATORE}`), PDF, { contentType: 'application/pdf' });
  });
});

describe('foto', () => {
  it('si legge conoscendo il percorso, anche senza essere collegati (la pagina pubblica)', async () => {
    await assertSucceeds(getMetadata(ref(senzaCollegarsi(), `foto/${LAVORATORE}`)));
  });

  // Con `read` al posto di `get` chiunque poteva elencare la cartella: tutti gli uid e
  // tutte le foto, anche di chi ha spento il link pubblico. È lo stesso buco chiuso il
  // 2026-10-01 su `profiliPubblici` (trovato il 2026-10-19).
  it('non si elencano, senza essere collegati', async () => {
    await assertFails(listAll(ref(senzaCollegarsi(), 'foto')));
  });

  it('non si elencano, nemmeno da collegati', async () => {
    await assertFails(listAll(ref(comeMario(), 'foto')));
  });

  it('ognuno carica la sua', async () => {
    await assertSucceeds(uploadBytes(ref(comeMario(), `foto/${LAVORATORE}`), JPEG, { contentType: 'image/jpeg' }));
  });

  it('non si carica la foto di un altro', async () => {
    await assertFails(uploadBytes(ref(comeAltro(), `foto/${LAVORATORE}`), JPEG, { contentType: 'image/jpeg' }));
  });

  it('un SVG non passa come foto', async () => {
    const svg = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"/>');
    await assertFails(uploadBytes(ref(comeMario(), `foto/${LAVORATORE}`), svg, { contentType: 'image/svg+xml' }));
  });
});

describe('CV', () => {
  it('non lo legge nessuno dal client, nemmeno chi l’ha caricato', async () => {
    await assertFails(getMetadata(ref(comeMario(), `cv/${LAVORATORE}`)));
    await assertFails(getMetadata(ref(senzaCollegarsi(), `cv/${LAVORATORE}`)));
  });

  it('non si elencano', async () => {
    await assertFails(listAll(ref(senzaCollegarsi(), 'cv')));
  });

  it('ognuno carica il suo, solo PDF', async () => {
    await assertSucceeds(uploadBytes(ref(comeMario(), `cv/${LAVORATORE}`), PDF, { contentType: 'application/pdf' }));
    await assertFails(uploadBytes(ref(comeMario(), `cv/${LAVORATORE}`), JPEG, { contentType: 'image/jpeg' }));
    await assertFails(uploadBytes(ref(comeAltro(), `cv/${LAVORATORE}`), PDF, { contentType: 'application/pdf' }));
  });
});
