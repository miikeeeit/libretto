// Le strutture dove si è lavorato (L4, punto 1).
//
// Perché l'autocompletamento è fatto con cura: se la stessa struttura finisce nel
// database tre volte scritta in tre modi, «confermata da 3 strutture» diventa una bugia,
// e quel numero è metà del valore di Libretto. Trovare quella che c'è già conta più che
// crearne una nuova in fretta.

import {
  addDoc,
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  where,
} from 'firebase/firestore';
import { PROVINCIA } from '../config';
import { comunePerId } from '../data/comuni';
import { db } from './firebase';
import { geohash } from './geohash';
import type { StrutturaConId } from './tipi';

/** "Agriturismo L'Ulivo " → "agriturismo l ulivo": senza accenti, senza punteggiatura. */
export function normalizzaNome(nome: string): string {
  return nome
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Le parole del nome, senza quelle troppo corte per distinguere qualcosa. */
function paroleDelNome(nome: string): string[] {
  return [...new Set(normalizzaNome(nome).split(' ').filter((p) => p.length >= 3))].slice(0, 12);
}

/**
 * Cerca le strutture già esistenti.
 * Due ricerche insieme, perché la gente scrive in due modi diversi: chi parte dall'inizio
 * del nome ("agritur…") e chi scrive la parola che ricorda ("somma", di "Bar Somma").
 */
export async function cercaStrutture(testo: string, massimo = 6): Promise<StrutturaConId[]> {
  const q = normalizzaNome(testo);
  if (q.length < 3) return [];

  const strutture = collection(db, 'strutture');
  const ultimaParola = q.split(' ').at(-1) ?? q;

  const [perInizio, perParola] = await Promise.all([
    getDocs(
      query(
        strutture,
        orderBy('nomeNormalizzato'),
        where('nomeNormalizzato', '>=', q),
        where('nomeNormalizzato', '<', `${q}`),
        limit(massimo),
      ),
    ),
    // Le parole intere si cercano solo quando ne è stata scritta una per intero.
    ultimaParola.length >= 3
      ? getDocs(query(strutture, where('parole', 'array-contains', ultimaParola), limit(massimo)))
      : Promise.resolve(null),
  ]);

  const trovate = new Map<string, StrutturaConId>();
  for (const snap of [perInizio, perParola]) {
    for (const doc of snap?.docs ?? []) {
      const dati = doc.data() as StrutturaConId;
      // Una struttura unita a un'altra non si propone più: si propone quella buona.
      if (dati.unitaA) continue;
      if (!trovate.has(doc.id)) trovate.set(doc.id, { ...dati, id: doc.id });
    }
  }

  return [...trovate.values()].slice(0, massimo);
}

/**
 * Crea una struttura nuova. Prima di chiamarla si è già mostrato all'utente quello che
 * esiste: qui non si può più controllare, perché due persone possono aggiungere lo
 * stesso posto nello stesso momento. I doppioni si uniscono a mano con `unitaA` (§6).
 */
export async function creaStruttura(
  uid: string,
  nome: string,
  comuneId: string,
): Promise<StrutturaConId> {
  const comune = comunePerId(comuneId);
  if (!comune) throw new Error('Comune non riconosciuto.');

  const pulito = nome.trim().replace(/\s+/g, ' ');
  if (pulito.length < 2) throw new Error('Scrivi il nome della struttura.');

  const struttura = {
    nome: pulito,
    nomeNormalizzato: normalizzaNome(pulito),
    parole: paroleDelNome(pulito),
    comune: comune.nome,
    provincia: PROVINCIA,
    geohash: geohash(comune.lat, comune.lon),
    nConferme: 0,
    creataDa: uid,
    unitaA: null,
    createdAt: serverTimestamp(),
  };

  const riferimento = await addDoc(collection(db, 'strutture'), struttura);
  return { ...(struttura as unknown as StrutturaConId), id: riferimento.id };
}
