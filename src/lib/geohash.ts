// Geohash del comune, salvato sul profilo perché la ricerca per zona di gennaio
// (§2, §6) possa girare senza rifare niente. Nella v1 non si legge da nessuna parte.
// Implementazione standard base32, così non serve una dipendenza in più.

const BASE32 = '0123456789bcdefghjkmnpqrstuvwxyz';

/** Geohash di una coordinata. 7 caratteri ≈ 150 m, più che abbastanza per un comune. */
export function geohash(lat: number, lon: number, precisione = 7): string {
  let latMin = -90;
  let latMax = 90;
  let lonMin = -180;
  let lonMax = 180;

  let hash = '';
  let bit = 0;
  let indice = 0;
  let perLongitudine = true;

  while (hash.length < precisione) {
    if (perLongitudine) {
      const mezzo = (lonMin + lonMax) / 2;
      if (lon >= mezzo) {
        indice = indice * 2 + 1;
        lonMin = mezzo;
      } else {
        indice = indice * 2;
        lonMax = mezzo;
      }
    } else {
      const mezzo = (latMin + latMax) / 2;
      if (lat >= mezzo) {
        indice = indice * 2 + 1;
        latMin = mezzo;
      } else {
        indice = indice * 2;
        latMax = mezzo;
      }
    }
    perLongitudine = !perLongitudine;

    if (bit < 4) {
      bit += 1;
    } else {
      hash += BASE32[indice];
      bit = 0;
      indice = 0;
    }
  }

  return hash;
}
