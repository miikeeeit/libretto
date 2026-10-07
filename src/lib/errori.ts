// Gli errori di Firebase arrivano in inglese e con un codice. Qui diventano frasi
// che si capiscono, nel tono del resto dell'app: da collega a collega (§5).

const MESSAGGI: Record<string, string> = {
  'auth/invalid-phone-number': 'Questo numero non mi sembra giusto. Controllalo.',
  'auth/missing-phone-number': 'Scrivi il tuo numero di telefono.',
  'auth/quota-exceeded': 'Oggi non riesco a mandare altri messaggi. Riprova domani.',
  'auth/too-many-requests': 'Troppi tentativi da questo numero. Aspetta qualche minuto.',
  'auth/invalid-verification-code': 'Il codice non è giusto. Riscrivilo.',
  'auth/code-expired': 'Il codice è scaduto. Fattene mandare un altro.',
  'auth/session-expired': 'Il codice è scaduto. Fattene mandare un altro.',
  'auth/captcha-check-failed': 'Il controllo antispam non è andato a buon fine. Ricarica la pagina.',
  'auth/network-request-failed': 'Non c’è connessione. Controlla la rete e riprova.',
  'auth/operation-not-allowed': "L'accesso con telefono non è ancora attivo sul progetto Firebase.",
  'auth/user-disabled': 'Questo numero è sospeso. Scrivi a chi gestisce Libretto.',
  'permission-denied': 'Non hai il permesso per questa operazione.',
  unavailable: 'Non riesco a raggiungere il database. Controlla la connessione.',
};

export function messaggioErrore(errore: unknown, fallback = 'Qualcosa non è andato. Riprova.'): string {
  if (typeof errore === 'object' && errore !== null && 'code' in errore) {
    const codice = String((errore as { code: unknown }).code);
    if (MESSAGGI[codice]) return MESSAGGI[codice];
    console.error('Errore senza messaggio dedicato:', codice, errore);
  } else {
    console.error('Errore:', errore);
  }
  // Il reCAPTCHA di Google sbaglia senza codice e in inglese: non si mostra così com'è.
  if (errore instanceof Error && /recaptcha/i.test(errore.message)) {
    return 'Il controllo antispam si è inceppato. Ricarica la pagina e riprova.';
  }
  // I messaggi delle nostre funzioni sono già scritti per chi li legge; la libreria di
  // Firebase però ci attacca in fondo lo stato HTTP («… con te. [400]»): si toglie.
  if (errore instanceof Error && errore.message !== '') return errore.message.replace(/\s*\[\d{3}\]$/, '');
  return fallback;
}
