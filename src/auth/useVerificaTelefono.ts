// La verifica del telefono via SMS, in un posto solo: la usa il lavoratore per entrare
// (L1) e il responsabile per confermare (C2).
//
// Tiene dentro le due cose che è facile sbagliare: un reCAPTCHA non si ricicla dopo un
// errore, e sugli emulatori non deve partire nessun SMS.

import {
  RecaptchaVerifier,
  signInWithPhoneNumber,
  type ConfirmationResult,
  type User,
} from 'firebase/auth';
import { useCallback, useEffect, useRef } from 'react';
import { auth } from '../lib/firebase';

export function useVerificaTelefono() {
  const conferma = useRef<ConfirmationResult | null>(null);
  const verificatore = useRef<RecaptchaVerifier | null>(null);

  const pulisci = useCallback(() => {
    verificatore.current?.clear();
    verificatore.current = null;
  }, []);

  useEffect(() => pulisci, [pulisci]);

  /** Manda l'SMS. Se qualcosa va storto butta via il reCAPTCHA, che è usa e getta. */
  const mandaCodice = useCallback(
    async (numeroE164: string) => {
      try {
        if (!verificatore.current) {
          verificatore.current = new RecaptchaVerifier(auth, 'recaptcha', { size: 'invisible' });
        }
        conferma.current = await signInWithPhoneNumber(auth, numeroE164, verificatore.current);
      } catch (errore) {
        pulisci();
        throw errore;
      }
    },
    [pulisci],
  );

  const verificaCodice = useCallback(async (codice: string): Promise<User> => {
    if (!conferma.current) throw new Error('Ricomincia: il codice non è più valido.');
    const credenziale = await conferma.current.confirm(codice.trim());
    return credenziale.user;
  }, []);

  const codiceChiesto = useCallback(() => conferma.current !== null, []);

  return { mandaCodice, verificaCodice, codiceChiesto, pulisci };
}
