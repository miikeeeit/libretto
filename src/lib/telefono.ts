// Numeri di telefono: si accetta come li scrive la gente, si salva in E.164.

const PREFISSO_ITALIA = '+39';

/**
 * Porta in E.164 un numero scritto a mano: "347 123 4567", "0039 347...", "+39 347...".
 * Restituisce null se non sembra un numero di cellulare valido.
 * Senza prefisso internazionale si assume l'Italia, perché la v1 è per la provincia di Latina.
 */
export function normalizzaTelefono(grezzo: string): string | null {
  const pulito = grezzo.replace(/[\s.\-()/]/g, '');
  if (pulito === '') return null;

  let numero: string;
  if (pulito.startsWith('+')) {
    numero = pulito;
  } else if (pulito.startsWith('00')) {
    numero = `+${pulito.slice(2)}`;
  } else {
    numero = `${PREFISSO_ITALIA}${pulito.replace(/^0+/, '')}`;
  }

  if (!/^\+[1-9]\d{7,14}$/.test(numero)) return null;

  // Cellulari italiani: +39 3xx, da 9 a 10 cifre dopo il prefisso.
  if (numero.startsWith(PREFISSO_ITALIA)) {
    const nazionale = numero.slice(PREFISSO_ITALIA.length);
    if (!/^3\d{8,9}$/.test(nazionale)) return null;
  }

  return numero;
}

/** Come si mostra un numero all'utente: "+39 347 123 4567". */
export function formattaTelefono(e164: string): string {
  if (!e164.startsWith(PREFISSO_ITALIA)) return e164;
  const n = e164.slice(PREFISSO_ITALIA.length);
  const pezzi = [n.slice(0, 3), n.slice(3, 6), n.slice(6)].filter(Boolean);
  return `${PREFISSO_ITALIA} ${pezzi.join(' ')}`;
}

/**
 * Numero mascherato per la pagina di conferma (C1: "347 •••• 21").
 * Si mostrano le prime tre e le ultime due cifre nazionali, il resto coperto.
 *
 * Il numero per intero non arriva mai al browser di chi apre il link: se il link
 * finisse alla persona sbagliata, si porterebbe dietro il telefono del responsabile.
 */
export function mascheraTelefono(e164: string): string {
  const nazionale = e164.startsWith(PREFISSO_ITALIA) ? e164.slice(PREFISSO_ITALIA.length) : e164.replace(/^\+/, '');
  if (nazionale.length < 6) return '•••••';
  return `${nazionale.slice(0, 3)} •••• ${nazionale.slice(-2)}`;
}

/**
 * Il numero scritto sta dentro la maschera mostrata?
 * Serve a fermare un numero sbagliato **prima** di mandare l'SMS: il controllo vero lo
 * fa il server sul telefono verificato, questo risparmia solo un messaggio a pagamento
 * e fa arrivare l'avviso subito.
 */
export function combaciaConMaschera(e164: string, maschera: string): boolean {
  const cifre = maschera.replace(/\D/g, '');
  if (cifre.length < 5) return true;
  const nazionale = e164.startsWith(PREFISSO_ITALIA) ? e164.slice(PREFISSO_ITALIA.length) : e164.replace(/^\+/, '');
  return nazionale.startsWith(cifre.slice(0, 3)) && nazionale.endsWith(cifre.slice(-2));
}
