// BOZZA — §7 della specifica, non ancora rivista.
//
// PC3: prima di costruire le competenze nella settimana 2, Mike deve rivedere questa
// lista riga per riga. Criterio: ogni competenza deve essere osservabile in un turno,
// cioè un responsabile deve poter dire sì o no senza pensarci.
//
// Nella settimana 1 si usa solo `RUOLI[].nome`, per il ruolo principale del profilo (L2).
// Gli id sono stabili: i testi si possono cambiare senza rompere i dati già salvati.

export type Competenza = {
  id: string;
  nome: string;
};

export type Ruolo = {
  id: string;
  nome: string;
  competenze: Competenza[];
};

export const RUOLI: Ruolo[] = [
  {
    id: 'sala',
    nome: 'Sala',
    competenze: [
      { id: 'sala.palmare', nome: 'Palmare e comande digitali' },
      { id: 'sala.servizio', nome: 'Servizio al tavolo' },
      { id: 'sala.rango', nome: 'Gestione rango' },
      { id: 'sala.banchetti', nome: 'Banchetti ed eventi' },
      { id: 'sala.vini', nome: 'Carta dei vini' },
      { id: 'sala.inglese', nome: 'Inglese al tavolo' },
      { id: 'sala.aperturaChiusura', nome: 'Apertura e chiusura sala' },
      { id: 'sala.formazione', nome: 'Formazione dei nuovi' },
    ],
  },
  {
    id: 'bar',
    nome: 'Bar',
    competenze: [
      { id: 'bar.caffetteria', nome: 'Caffetteria' },
      { id: 'bar.cocktail', nome: 'Cocktail base' },
      { id: 'bar.cassa', nome: 'Cassa' },
      { id: 'bar.affollamento', nome: 'Banco in affollamento' },
      { id: 'bar.inventario', nome: 'Inventario e ordini' },
      { id: 'bar.aperturaChiusura', nome: 'Apertura e chiusura' },
    ],
  },
  {
    id: 'cucina',
    nome: 'Cucina',
    competenze: [
      { id: 'cucina.lineaCalda', nome: 'Linea calda' },
      { id: 'cucina.lineaFredda', nome: 'Linea fredda e antipasti' },
      { id: 'cucina.pizzeria', nome: 'Pizzeria' },
      { id: 'cucina.pasticceria', nome: 'Pasticceria' },
      { id: 'cucina.preparazioni', nome: 'Preparazioni base' },
      { id: 'cucina.haccp', nome: 'HACCP' },
      { id: 'cucina.ordini', nome: 'Ordini ai fornitori' },
    ],
  },
  {
    id: 'lavaggio',
    nome: 'Lavaggio',
    competenze: [
      { id: 'lavaggio.stoviglie', nome: 'Lavaggio stoviglie' },
      { id: 'lavaggio.puliziaCucina', nome: 'Pulizia cucina a fine servizio' },
      { id: 'lavaggio.haccp', nome: 'HACCP' },
    ],
  },
  {
    id: 'reception',
    nome: 'Reception',
    competenze: [
      { id: 'reception.checkin', nome: 'Check-in e check-out' },
      { id: 'reception.gestionale', nome: 'Gestionale alberghiero' },
      { id: 'reception.telefono', nome: 'Telefono e prenotazioni' },
      { id: 'reception.inglese', nome: 'Inglese' },
      { id: 'reception.secondaLingua', nome: 'Seconda lingua' },
      { id: 'reception.cassa', nome: 'Cassa' },
    ],
  },
  {
    id: 'housekeeping',
    nome: 'Housekeeping',
    competenze: [
      { id: 'housekeeping.camere', nome: 'Camere' },
      { id: 'housekeeping.areeComuni', nome: 'Aree comuni' },
      { id: 'housekeeping.lavanderia', nome: 'Lavanderia' },
      { id: 'housekeeping.biancheria', nome: 'Gestione biancheria' },
    ],
  },
  {
    id: 'cassa',
    nome: 'Cassa',
    competenze: [
      { id: 'cassa.chiusura', nome: 'Cassa e chiusura' },
      { id: 'cassa.pos', nome: 'POS e pagamenti' },
      { id: 'cassa.fondo', nome: 'Resti e fondo cassa' },
    ],
  },
  {
    id: 'commesso',
    nome: 'Commesso/a',
    competenze: [
      { id: 'commesso.vendita', nome: 'Vendita assistita' },
      { id: 'commesso.cassa', nome: 'Cassa' },
      { id: 'commesso.vetrine', nome: 'Allestimento vetrine' },
      { id: 'commesso.magazzino', nome: 'Magazzino' },
      { id: 'commesso.inventario', nome: 'Inventario' },
    ],
  },
  {
    id: 'responsabile',
    nome: 'Responsabile',
    competenze: [
      { id: 'responsabile.turni', nome: 'Gestione turni' },
      { id: 'responsabile.formazione', nome: 'Formazione staff' },
      { id: 'responsabile.reclami', nome: 'Gestione reclami' },
      { id: 'responsabile.chiusureCassa', nome: 'Chiusure di cassa' },
      { id: 'responsabile.ordini', nome: 'Ordini ai fornitori' },
    ],
  },
];

export function ruoloPerId(id: string): Ruolo | undefined {
  return RUOLI.find((r) => r.id === id);
}

export function nomeRuolo(id: string): string {
  return ruoloPerId(id)?.nome ?? id;
}
