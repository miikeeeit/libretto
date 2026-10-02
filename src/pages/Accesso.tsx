// L1 · Accesso
// Numero di telefono, codice SMS, casella dei 18 anni e casella dell'informativa.
// Niente password: chi arriva qui ha il telefono in mano, non un gestore di password.
//
// PC1 (2026-09-21): durante la beta serve un codice di invito. Il codice si controlla
// PRIMA di mandare l'SMS, perché ogni SMS costa.

import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useVerificaTelefono } from '../auth/useVerificaTelefono';
import { BETA_SU_INVITO, CLAIM, NOME_APP } from '../config';
import { messaggioErrore } from '../lib/errori';
import { auth } from '../lib/firebase';
import { collegaInvito, controllaInvito, invitoGiaCollegato, normalizzaCodice } from '../lib/inviti';
import { formattaTelefono, normalizzaTelefono } from '../lib/telefono';

const ATTESA_RINVIO = 30;
/**
 * Il codice di invito resta qui tra la verifica e la creazione del profilo. In
 * `localStorage`, non in `sessionStorage`: se il telefono chiude l'app in mezzo (succede
 * scegliendo la foto), al ritorno si è ancora collegati e il codice deve esserci ancora.
 * Con `sessionStorage` spariva, e senza codice le regole rifiutavano il profilo: si
 * restava fermi su L2 senza via d'uscita. Si salva insieme all'uid, così un codice
 * rimasto da un'altra persona sullo stesso telefono non vale.
 */
const CHIAVE_INVITO = 'libretto.invito';
/**
 * Il motivo per cui si è stati fatti uscire subito dopo la verifica. Appena il telefono è
 * verificato l'app passa alla creazione del profilo, e questa schermata sparisce prima di
 * poterlo mostrare: così il messaggio la aspetta quando si torna qui.
 */
const CHIAVE_ERRORE = 'libretto.erroreAccesso';

// Si legge senza cancellarlo: in sviluppo React chiama due volte l'inizializzazione, e
// la seconda lo troverebbe già sparito. Si cancella dopo, una volta mostrato.
function erroreInSospeso(): string | null {
  return sessionStorage.getItem(CHIAVE_ERRORE);
}

export default function Accesso() {
  const [passo, setPasso] = useState<'numero' | 'codice'>('numero');
  const [invito, setInvito] = useState('');
  const [telefono, setTelefono] = useState('');
  const [maggiorenne, setMaggiorenne] = useState(false);
  const [informativa, setInformativa] = useState(false);
  const [codice, setCodice] = useState('');
  const [errore, setErrore] = useState<string | null>(erroreInSospeso);
  const [inCorso, setInCorso] = useState(false);
  const [secondiRinvio, setSecondiRinvio] = useState(0);

  const { mandaCodice: chiediSms, verificaCodice: controllaSms, codiceChiesto } = useVerificaTelefono();
  const numeroE164 = useRef<string>('');

  useEffect(() => {
    sessionStorage.removeItem(CHIAVE_ERRORE);
  }, []);

  useEffect(() => {
    if (secondiRinvio <= 0) return;
    const t = setTimeout(() => setSecondiRinvio((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [secondiRinvio]);

  async function mandaCodice(nuovoInvio = false) {
    setErrore(null);

    const numero = normalizzaTelefono(telefono);
    if (!numero) {
      setErrore('Scrivi il tuo numero di cellulare, per esempio 347 123 4567.');
      return;
    }
    if (!maggiorenne) {
      setErrore('Per usare Libretto devi avere almeno 18 anni.');
      return;
    }
    if (!informativa) {
      setErrore('Devi leggere e accettare l’informativa per continuare.');
      return;
    }

    setInCorso(true);
    try {
      if (BETA_SU_INVITO) {
        const esito = await controllaInvito(invito);
        if (!esito.ok) {
          setErrore(esito.motivo);
          return;
        }
      }

      await chiediSms(numero);
      numeroE164.current = numero;
      setPasso('codice');
      setSecondiRinvio(ATTESA_RINVIO);
      if (nuovoInvio) setCodice('');
    } catch (e) {
      setErrore(messaggioErrore(e));
    } finally {
      setInCorso(false);
    }
  }

  async function verificaCodice() {
    setErrore(null);
    if (codice.trim().length < 6) {
      setErrore('Il codice è di sei cifre.');
      return;
    }
    if (!codiceChiesto()) {
      setErrore('Ricomincia: il codice non è più valido.');
      setPasso('numero');
      return;
    }

    setInCorso(true);
    try {
      const uid = (await controllaSms(codice)).uid;

      if (BETA_SU_INVITO) {
        const pulito = normalizzaCodice(invito);
        if (!(await invitoGiaCollegato(pulito, uid))) {
          const esito = await collegaInvito(pulito, uid);
          if (!esito.ok) {
            // Il codice è di un altro numero: si esce subito, altrimenti si resterebbe
            // collegati senza un invito e l'app porterebbe a creare un profilo che le
            // regole poi rifiutano.
            sessionStorage.setItem(CHIAVE_ERRORE, esito.motivo);
            await auth.signOut();
            setPasso('numero');
            setErrore(esito.motivo);
            return;
          }
        }
        conservaInvito(uid, pulito);
      }

      // Da qui in poi decide App: profilo da creare (L2) o libretto (L3).
      // L'evento «registrazione» lo segna L2 quando il profilo nasce: qui si passa anche
      // a ogni rientro, e i conti della §12 venivano gonfiati.
    } catch (e) {
      setErrore(messaggioErrore(e));
    } finally {
      setInCorso(false);
    }
  }

  return (
    <main className="schermata schermata--centrata">
      <header className="benvenuto">
        <img src="/icona.svg" alt="" className="logo" width="64" height="64" />
        <h1>{NOME_APP}</h1>
        <p className="claim">{CLAIM}</p>
      </header>

      {passo === 'numero' ? (
        <form
          className="scheda"
          onSubmit={(e) => {
            e.preventDefault();
            void mandaCodice();
          }}
        >
          <h2>Entra col tuo numero</h2>
          <p className="aiuto">Ti arriva un codice via SMS. Nessuna password da ricordare.</p>

          {BETA_SU_INVITO && (
            <label className="campo">
              Codice di invito
              <input
                type="text"
                inputMode="text"
                autoComplete="one-time-code"
                placeholder="es. somma-2026"
                value={invito}
                onChange={(e) => setInvito(e.target.value)}
                required
              />
              <span className="aiuto">Libretto è in prova chiusa: per ora si entra su invito.</span>
            </label>
          )}

          <label className="campo">
            Il tuo numero di cellulare
            <input
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="347 123 4567"
              value={telefono}
              onChange={(e) => setTelefono(e.target.value)}
              required
            />
          </label>

          <label className="casella">
            <input type="checkbox" checked={maggiorenne} onChange={(e) => setMaggiorenne(e.target.checked)} />
            <span>Ho almeno 18 anni.</span>
          </label>

          <label className="casella">
            <input type="checkbox" checked={informativa} onChange={(e) => setInformativa(e.target.checked)} />
            <span>
              Ho letto l’<Link to="/privacy">informativa</Link> e accetto che {NOME_APP} tratti i miei dati.
            </span>
          </label>

          {errore && <p className="errore" role="alert">{errore}</p>}

          <button type="submit" className="bottone bottone--principale" disabled={inCorso}>
            {inCorso ? 'Un momento…' : 'Mandami il codice'}
          </button>

          <p className="aiuto">
            Prima volta qui? <Link to="/come-funziona">Come funziona {NOME_APP}</Link>
          </p>
        </form>
      ) : (
        <form
          className="scheda"
          onSubmit={(e) => {
            e.preventDefault();
            void verificaCodice();
          }}
        >
          <h2>Scrivi il codice</h2>
          <p className="aiuto">
            L’ho mandato al {formattaTelefono(numeroE164.current)}.{' '}
            <button
              type="button"
              className="bottone-testo"
              onClick={() => {
                setPasso('numero');
                setErrore(null);
              }}
            >
              Cambia numero
            </button>
          </p>

          <label className="campo">
            Codice di sei cifre
            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              className="campo--codice"
              value={codice}
              onChange={(e) => setCodice(e.target.value.replace(/\D/g, ''))}
              required
              autoFocus
            />
          </label>

          {errore && <p className="errore" role="alert">{errore}</p>}

          <button type="submit" className="bottone bottone--principale" disabled={inCorso}>
            {inCorso ? 'Controllo…' : 'Entra'}
          </button>

          <button
            type="button"
            className="bottone-testo"
            disabled={secondiRinvio > 0 || inCorso}
            onClick={() => void mandaCodice(true)}
          >
            {secondiRinvio > 0 ? `Rimanda il codice (${secondiRinvio})` : 'Rimanda il codice'}
          </button>
        </form>
      )}
    </main>
  );
}

function conservaInvito(uid: string, codice: string): void {
  try {
    localStorage.setItem(CHIAVE_INVITO, JSON.stringify({ uid, codice }));
  } catch {
    // Memoria del browser chiusa (navigazione privata): L2 chiederà il codice.
  }
}

/** Il codice di invito messo da parte all'accesso da questo uid, per la creazione del profilo (L2). */
export function invitoInSospeso(uid: string): string | null {
  try {
    const salvato = JSON.parse(localStorage.getItem(CHIAVE_INVITO) ?? 'null') as {
      uid?: string;
      codice?: string;
    } | null;
    return salvato?.uid === uid && typeof salvato.codice === 'string' ? salvato.codice : null;
  } catch {
    return null;
  }
}

export function scartaInvitoInSospeso(): void {
  try {
    localStorage.removeItem(CHIAVE_INVITO);
  } catch {
    // Niente da togliere.
  }
}
