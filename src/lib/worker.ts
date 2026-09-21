// Lettura e creazione del profilo del lavoratore (L2, L3).

import { doc, getDoc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { PROVINCIA, STAGIONE_DISPONIBILITA, VERSIONE_INFORMATIVA } from '../config';
import { comunePerId } from '../data/comuni';
import { db, storage } from './firebase';
import { geohash } from './geohash';
import { PRIVACY_PREDEFINITA, type Worker } from './tipi';

export async function leggiWorker(uid: string): Promise<Worker | null> {
  const snap = await getDoc(doc(db, 'workers', uid));
  return snap.exists() ? (snap.data() as Worker) : null;
}

/** "Mario Rossi" → "mario-rossi". Senza accenti, solo lettere e trattini. */
function radiceSlug(nome: string, cognome: string): string {
  const base = `${nome} ${cognome}`
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return base === '' ? 'libretto' : base;
}

function codaCasuale(): string {
  const byte = new Uint8Array(2);
  crypto.getRandomValues(byte);
  return Array.from(byte)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export type DatiNuovoProfilo = {
  nome: string;
  cognome: string;
  ruoloPrincipale: string;
  comuneId: string;
  telefono: string;
  /** Codice di invito già collegato a questo uid, o null se la registrazione è aperta. */
  invito: string | null;
  foto: File | null;
};

/**
 * Prenota l'indirizzo pubblico del libretto in `slugs/{slug}`.
 * Chi arriva secondo su uno slug già preso si ferma alle regole (`slugs` si può creare,
 * non modificare), quindi due omonimi non finiscono mai sullo stesso indirizzo.
 * La prenotazione si fa prima del profilo, così le regole di `workers` possono
 * controllare che lo slug sia davvero intestato a chi sta creando il profilo.
 */
async function prenotaSlug(uid: string, nome: string, cognome: string): Promise<string> {
  const radice = radiceSlug(nome, cognome);

  for (let tentativo = 0; tentativo < 5; tentativo += 1) {
    const slug = `${radice}-${codaCasuale()}`;
    const esistente = await getDoc(doc(db, 'slugs', slug));

    // Già nostro: è un secondo tentativo dopo un errore a metà strada.
    if (esistente.exists()) {
      if (esistente.data().uid === uid) return slug;
      continue;
    }

    try {
      await setDoc(doc(db, 'slugs', slug), { uid });
      return slug;
    } catch {
      // Prenotato da un altro nello stesso istante: si prova un'altra coda.
    }
  }

  throw new Error('Non riesco a creare un indirizzo per il tuo libretto. Riprova.');
}

export async function creaProfilo(uid: string, dati: DatiNuovoProfilo): Promise<void> {
  const comune = comunePerId(dati.comuneId);
  if (!comune) throw new Error('Comune non riconosciuto.');

  const fotoPath = dati.foto ? await caricaFoto(uid, dati.foto) : null;
  const slug = await prenotaSlug(uid, dati.nome, dati.cognome);
  const adesso = serverTimestamp();

  await setDoc(doc(db, 'workers', uid), {
    nome: dati.nome.trim(),
    cognome: dati.cognome.trim(),
    fotoPath,
    telefono: dati.telefono,
    ruoloPrincipale: dati.ruoloPrincipale,
    comune: comune.nome,
    provincia: PROVINCIA,
    geohash: geohash(comune.lat, comune.lon),
    disponibile: false,
    stagioneDisponibile: STAGIONE_DISPONIBILITA,
    slug,
    privacy: PRIVACY_PREDEFINITA,
    cvPath: null,
    consensi: {
      maggiorenne: adesso,
      informativa: { versione: VERSIONE_INFORMATIVA, ts: adesso },
    },
    invito: dati.invito,
    createdAt: adesso,
    updatedAt: adesso,
  });
}

/** La foto del profilo è pubblica: la mostra la pagina pubblica (P1). */
export async function caricaFoto(uid: string, file: File): Promise<string> {
  const percorso = `foto/${uid}`;
  await uploadBytes(ref(storage, percorso), file, { contentType: file.type });
  return percorso;
}

export async function urlFoto(fotoPath: string): Promise<string> {
  return getDownloadURL(ref(storage, fotoPath));
}

/** L3: interruttore "Disponibile per la prossima stagione". */
export async function impostaDisponibile(uid: string, disponibile: boolean): Promise<void> {
  await updateDoc(doc(db, 'workers', uid), {
    disponibile,
    stagioneDisponibile: STAGIONE_DISPONIBILITA,
    updatedAt: serverTimestamp(),
  });
}
