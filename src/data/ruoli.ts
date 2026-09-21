// Ruoli e competenze — §7, rivista con Mike il 2026-09-21 (PC3).
//
// Il criterio di ogni riga qui sotto: **un responsabile deve poter dire sì o no senza
// pensarci**. Sono state tolte le competenze che ha chiunque faccia quel ruolo (dicono
// zero su una pagina pubblica) e quelle su cui il responsabile si sarebbe fermato a
// pensare cosa volessero dire.
//
// Le competenze che valgono in più ruoli — cassa, HACCP, lingue, apertura e chiusura,
// formazione dei nuovi — hanno un id solo (`generale.*`), così la pagina pubblica le
// conta insieme: chi ha fatto cassa al bar e in negozio legge «Cassa · confermata da 2»,
// non due righe da una.
//
// Gli id non si cambiano più a cuor leggero: una volta che ci sono conferme vere in
// giro, cambiare un id significa perderle.

export type Competenza = {
  id: string;
  nome: string;
};

/**
 * Tutte le competenze, definite una volta sola.
 * I testi si possono correggere quando si vuole; gli id no.
 */
export const COMPETENZE = {
  // --- trasversali: stesso id in tutti i ruoli che le usano ---
  'generale.cassa': 'Cassa e chiusura di cassa',
  'generale.haccp': 'Procedure HACCP rispettate',
  'generale.aperturaChiusura': 'Apertura e chiusura in autonomia',
  'generale.formazioneNuovi': 'Formazione dei nuovi',
  'generale.inglese': 'Inglese con i clienti',
  'generale.tedesco': 'Tedesco con i clienti',
  'generale.francese': 'Francese con i clienti',
  'generale.spagnolo': 'Spagnolo con i clienti',

  // --- sala ---
  'sala.palmare': 'Palmare e comande digitali',
  'sala.rango': 'Gestione di un rango in autonomia',
  'sala.picco': 'Tiene il ritmo nel pieno del servizio',
  'sala.banchetti': 'Banchetti ed eventi',
  'sala.vino': 'Consiglia il vino al tavolo',

  // --- bar ---
  'bar.caffetteria': 'Caffetteria',
  'bar.cocktail': 'Cocktail base',
  'bar.banco': 'Tiene il banco nell’affollamento',
  'bar.inventario': 'Inventario e ordini',

  // --- cucina ---
  'cucina.lineaCalda': 'Linea calda',
  'cucina.lineaFredda': 'Linea fredda e antipasti',
  'cucina.taglio': 'Taglio e mise en place',
  'cucina.pasticceria': 'Pasticceria',
  'cucina.ritmo': 'Tiene la linea nel pieno del servizio',
  'cucina.ordini': 'Ordini ai fornitori',

  // --- pizzeria ---
  'pizzaiolo.impasto': 'Impasto e gestione dei lieviti',
  'pizzaiolo.forno': 'Forno, a legna o elettrico',
  'pizzaiolo.banco': 'Banco e farcitura nel picco',
  'pizzaiolo.taglio': 'Pizza al taglio e in teglia',

  // --- lavaggio ---
  'lavaggio.ritmo': 'Sta al passo nel pieno del servizio',
  'lavaggio.fineServizio': 'Pulizia della cucina a fine servizio',
  'lavaggio.attrezzature': 'Cura di macchina e attrezzature',

  // --- reception ---
  'reception.checkin': 'Check-in e check-out',
  'reception.gestionale': 'Gestionale alberghiero',
  'reception.telefono': 'Telefono e prenotazioni',

  // --- housekeeping ---
  'housekeeping.partenze': 'Camere in partenza e riassetti',
  'housekeeping.ritmo': 'Tiene il numero di camere del turno',
  'housekeeping.areeComuni': 'Aree comuni',
  'housekeeping.lavanderia': 'Lavanderia',
  'housekeeping.biancheria': 'Gestione della biancheria',

  // --- spiaggia e stabilimenti ---
  'spiaggia.ombrelloni': 'Ombrelloni, lettini e assegnazione posti',
  'spiaggia.salvataggio': 'Servizio di salvataggio in torretta',
  'spiaggia.chiosco': 'Chiosco e servizio in spiaggia',
  'spiaggia.prenotazioni': 'Prenotazioni e abbonamenti',

  // --- animazione ---
  'animazione.miniclub': 'Mini club e bambini',
  'animazione.sport': 'Tornei e attività sportive',
  'animazione.serate': 'Serate e spettacoli',
  'animazione.audioLuci': 'Audio e luci di base',

  // --- cassa ---
  'cassa.fondo': 'Fondo cassa e gestione dei resti',

  // --- negozio ---
  'commesso.vendita': 'Vendita assistita',
  'commesso.vetrine': 'Allestimento delle vetrine',
  'commesso.magazzino': 'Magazzino e inventario',

  // --- responsabile ---
  'responsabile.turni': 'Gestione dei turni',
  'responsabile.reclami': 'Gestione dei reclami',
  'responsabile.chiusure': 'Chiusure di cassa',
  'responsabile.ordini': 'Ordini ai fornitori',
} as const satisfies Record<string, string>;

/**
 * Gli id che esistono davvero. Serve a questo: se in un ruolo qui sotto si scrive una
 * competenza che non esiste (o un id con un errore di battitura), `npm run lint` lo dice
 * subito, invece di far comparire una casella vuota a un responsabile.
 */
export type IdCompetenza = keyof typeof COMPETENZE;

export type Ruolo = {
  id: string;
  nome: string;
  /** Id delle competenze, nell'ordine in cui si mostrano. */
  competenze: IdCompetenza[];
};

export const RUOLI: Ruolo[] = [
  {
    id: 'sala',
    nome: 'Sala',
    competenze: [
      'sala.palmare',
      'sala.rango',
      'sala.picco',
      'sala.banchetti',
      'sala.vino',
      'generale.inglese',
      'generale.aperturaChiusura',
      'generale.formazioneNuovi',
    ],
  },
  {
    id: 'bar',
    nome: 'Bar',
    competenze: [
      'bar.caffetteria',
      'bar.cocktail',
      'bar.banco',
      'bar.inventario',
      'generale.cassa',
      'generale.inglese',
      'generale.aperturaChiusura',
    ],
  },
  {
    id: 'cucina',
    nome: 'Cucina',
    competenze: [
      'cucina.lineaCalda',
      'cucina.lineaFredda',
      'cucina.taglio',
      'cucina.pasticceria',
      'cucina.ritmo',
      'cucina.ordini',
      'generale.haccp',
    ],
  },
  {
    id: 'pizzaiolo',
    nome: 'Pizzeria',
    competenze: [
      'pizzaiolo.impasto',
      'pizzaiolo.forno',
      'pizzaiolo.banco',
      'pizzaiolo.taglio',
      'generale.haccp',
    ],
  },
  {
    id: 'lavaggio',
    nome: 'Lavaggio',
    competenze: [
      'lavaggio.ritmo',
      'lavaggio.fineServizio',
      'lavaggio.attrezzature',
      'generale.haccp',
    ],
  },
  {
    id: 'reception',
    nome: 'Reception',
    competenze: [
      'reception.checkin',
      'reception.gestionale',
      'reception.telefono',
      'generale.cassa',
      'generale.inglese',
      'generale.tedesco',
      'generale.francese',
      'generale.spagnolo',
    ],
  },
  {
    id: 'housekeeping',
    nome: 'Housekeeping',
    competenze: [
      'housekeeping.partenze',
      'housekeeping.ritmo',
      'housekeeping.areeComuni',
      'housekeeping.lavanderia',
      'housekeeping.biancheria',
    ],
  },
  {
    id: 'spiaggia',
    nome: 'Spiaggia e stabilimenti',
    competenze: [
      'spiaggia.ombrelloni',
      'spiaggia.salvataggio',
      'spiaggia.chiosco',
      'spiaggia.prenotazioni',
      'generale.cassa',
      'generale.inglese',
      'generale.aperturaChiusura',
    ],
  },
  {
    id: 'animazione',
    nome: 'Animazione',
    competenze: [
      'animazione.miniclub',
      'animazione.sport',
      'animazione.serate',
      'animazione.audioLuci',
      'generale.inglese',
      'generale.tedesco',
    ],
  },
  {
    id: 'cassa',
    nome: 'Cassa',
    competenze: ['generale.cassa', 'cassa.fondo', 'generale.inglese'],
  },
  {
    id: 'commesso',
    nome: 'Commesso/a',
    competenze: [
      'commesso.vendita',
      'commesso.vetrine',
      'commesso.magazzino',
      'generale.cassa',
      'generale.inglese',
    ],
  },
  {
    id: 'responsabile',
    nome: 'Responsabile',
    competenze: [
      'responsabile.turni',
      'responsabile.reclami',
      'responsabile.chiusure',
      'responsabile.ordini',
      'generale.formazioneNuovi',
    ],
  },
];

export function ruoloPerId(id: string): Ruolo | undefined {
  return RUOLI.find((r) => r.id === id);
}

export function nomeRuolo(id: string): string {
  return ruoloPerId(id)?.nome ?? id;
}

/**
 * Il nome da mostrare per una competenza salvata.
 * Accetta qualunque stringa, perché nei dati può esserci un id vecchio: in quel caso si
 * mostra l'id invece di far sparire la riga dal profilo di qualcuno.
 */
export function nomeCompetenza(id: string): string {
  return (COMPETENZE as Record<string, string>)[id] ?? id;
}

/** Le competenze da spuntare per un ruolo (L4), già nell'ordine giusto. */
export function competenzeDelRuolo(ruoloId: string): Competenza[] {
  const ruolo = ruoloPerId(ruoloId);
  if (!ruolo) return [];
  return ruolo.competenze.map((id) => ({ id, nome: nomeCompetenza(id) }));
}
