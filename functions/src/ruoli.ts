// Gli id dei ruoli e delle competenze della §7, per le funzioni.
//
// È una copia di `src/data/ruoli.ts`: le funzioni sono un pacchetto a parte e non possono
// importare l'app. Le copie sono tre, con `ruoliPrevisti()` e `competenzePreviste()` in
// `firestore.rules`, e la prova «le tre copie degli id coincidono» in
// `test/regole.test.mjs` le tiene allineate: se si aggiunge un ruolo o una competenza
// nell'app, va aggiunto anche qui e nelle regole, o la prova diventa rossa.

export const RUOLI_PREVISTI: readonly string[] = [
  'sala',
  'bar',
  'cucina',
  'pizzaiolo',
  'lavaggio',
  'reception',
  'housekeeping',
  'spiaggia',
  'animazione',
  'cassa',
  'commesso',
  'responsabile',
];

export const COMPETENZE_PREVISTE: readonly string[] = [
  'generale.cassa', 'generale.haccp', 'generale.aperturaChiusura', 'generale.formazioneNuovi',
  'generale.inglese', 'generale.tedesco', 'generale.francese', 'generale.spagnolo',
  'sala.palmare', 'sala.rango', 'sala.picco', 'sala.banchetti', 'sala.vino',
  'bar.caffetteria', 'bar.cocktail', 'bar.banco', 'bar.inventario',
  'cucina.lineaCalda', 'cucina.lineaFredda', 'cucina.taglio', 'cucina.pasticceria', 'cucina.ritmo',
  'cucina.ordini',
  'pizzaiolo.impasto', 'pizzaiolo.forno', 'pizzaiolo.banco', 'pizzaiolo.taglio',
  'lavaggio.ritmo', 'lavaggio.fineServizio', 'lavaggio.attrezzature',
  'reception.checkin', 'reception.gestionale', 'reception.telefono',
  'housekeeping.partenze', 'housekeeping.ritmo', 'housekeeping.areeComuni', 'housekeeping.lavanderia',
  'housekeeping.biancheria',
  'spiaggia.ombrelloni', 'spiaggia.salvataggio', 'spiaggia.chiosco', 'spiaggia.prenotazioni',
  'animazione.miniclub', 'animazione.sport', 'animazione.serate', 'animazione.audioLuci',
  'cassa.fondo',
  'commesso.vendita', 'commesso.vetrine', 'commesso.magazzino',
  'responsabile.turni', 'responsabile.reclami', 'responsabile.chiusure', 'responsabile.ordini',
];
