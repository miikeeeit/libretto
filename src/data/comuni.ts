// Comuni della provincia di Latina (L2: elenco fisso, poi estendibile).
// Le coordinate sono quelle del centro abitato, approssimate al chilometro:
// servono solo a calcolare il geohash per la ricerca per zona di gennaio (§6),
// non a mostrare una mappa.

export type Comune = {
  /** id stabile: si salva questo, non il nome, così un nome si può correggere. */
  id: string;
  nome: string;
  lat: number;
  lon: number;
};

export const COMUNI: Comune[] = [
  { id: 'aprilia', nome: 'Aprilia', lat: 41.594, lon: 12.653 },
  { id: 'bassiano', nome: 'Bassiano', lat: 41.531, lon: 13.081 },
  { id: 'campodimele', nome: 'Campodimele', lat: 41.399, lon: 13.531 },
  { id: 'castelforte', nome: 'Castelforte', lat: 41.297, lon: 13.826 },
  { id: 'cisterna-di-latina', nome: 'Cisterna di Latina', lat: 41.59, lon: 12.828 },
  { id: 'cori', nome: 'Cori', lat: 41.642, lon: 12.914 },
  { id: 'fondi', nome: 'Fondi', lat: 41.355, lon: 13.427 },
  { id: 'formia', nome: 'Formia', lat: 41.256, lon: 13.606 },
  { id: 'gaeta', nome: 'Gaeta', lat: 41.213, lon: 13.571 },
  { id: 'itri', nome: 'Itri', lat: 41.29, lon: 13.531 },
  { id: 'latina', nome: 'Latina', lat: 41.467, lon: 12.903 },
  { id: 'lenola', nome: 'Lenola', lat: 41.395, lon: 13.463 },
  { id: 'maenza', nome: 'Maenza', lat: 41.529, lon: 13.178 },
  { id: 'minturno', nome: 'Minturno', lat: 41.262, lon: 13.746 },
  { id: 'monte-san-biagio', nome: 'Monte San Biagio', lat: 41.351, lon: 13.355 },
  { id: 'norma', nome: 'Norma', lat: 41.586, lon: 12.976 },
  { id: 'pontinia', nome: 'Pontinia', lat: 41.407, lon: 13.043 },
  { id: 'ponza', nome: 'Ponza', lat: 40.897, lon: 12.962 },
  { id: 'priverno', nome: 'Priverno', lat: 41.472, lon: 13.183 },
  { id: 'prossedi', nome: 'Prossedi', lat: 41.573, lon: 13.263 },
  { id: 'rocca-massima', nome: 'Rocca Massima', lat: 41.678, lon: 12.921 },
  { id: 'roccagorga', nome: 'Roccagorga', lat: 41.494, lon: 13.157 },
  { id: 'roccasecca-dei-volsci', nome: 'Roccasecca dei Volsci', lat: 41.482, lon: 13.222 },
  { id: 'sabaudia', nome: 'Sabaudia', lat: 41.3, lon: 13.024 },
  { id: 'san-felice-circeo', nome: 'San Felice Circeo', lat: 41.238, lon: 13.094 },
  { id: 'santi-cosma-e-damiano', nome: 'Santi Cosma e Damiano', lat: 41.293, lon: 13.812 },
  { id: 'sermoneta', nome: 'Sermoneta', lat: 41.552, lon: 12.987 },
  { id: 'sezze', nome: 'Sezze', lat: 41.505, lon: 13.061 },
  { id: 'sonnino', nome: 'Sonnino', lat: 41.412, lon: 13.243 },
  { id: 'sperlonga', nome: 'Sperlonga', lat: 41.259, lon: 13.428 },
  { id: 'spigno-saturnia', nome: 'Spigno Saturnia', lat: 41.312, lon: 13.734 },
  { id: 'terracina', nome: 'Terracina', lat: 41.29, lon: 13.242 },
  { id: 'ventotene', nome: 'Ventotene', lat: 40.797, lon: 13.428 },
];

export function comunePerId(id: string): Comune | undefined {
  return COMUNI.find((c) => c.id === id);
}

/** Toglie accenti e spazi per confrontare quello che si scrive con i nomi dell'elenco. */
function semplifica(testo: string): string {
  return testo
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z]/g, '');
}

/** Suggerimenti per l'autocompletamento del comune (L2). */
export function cercaComuni(testo: string, massimo = 6): Comune[] {
  const q = semplifica(testo);
  if (q.length < 2) return [];
  const inizia: Comune[] = [];
  const contiene: Comune[] = [];
  for (const comune of COMUNI) {
    const nome = semplifica(comune.nome);
    if (nome.startsWith(q)) inizia.push(comune);
    else if (nome.includes(q)) contiene.push(comune);
  }
  return [...inizia, ...contiene].slice(0, massimo);
}
