// L6 · Impostazioni e privacy
//
// Ogni interruttore qui dice una cosa sola e la dice in italiano: cosa vede chi apre il
// tuo link. Niente «gestisci le preferenze di visibilità».

import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { EMAIL_PRIVACY, NOME_APP } from '../config';
import { nomeRuolo } from '../data/ruoli';
import { messaggioErrore } from '../lib/errori';
import { eliminaAccount } from '../lib/funzioni';
import { formattaPeriodo } from '../lib/periodo';
import {
  aggiornaPrivacy,
  caricaCv,
  esportaDati,
  MAX_CV_MB,
  nascondiStagione,
  rimuoviCv,
} from '../lib/privacy';
import { elencaStagioni } from '../lib/stagioni';
import type { Privacy, StagioneConId } from '../lib/tipi';

export default function Impostazioni() {
  const { utente, worker, ricaricaWorker, esci } = useAuth();
  const [stagioni, setStagioni] = useState<StagioneConId[]>([]);
  const [errore, setErrore] = useState<string | null>(null);
  const [avviso, setAvviso] = useState<string | null>(null);
  const [inCorso, setInCorso] = useState(false);
  const [confermaEliminazione, setConfermaEliminazione] = useState('');
  const [mostraEliminazione, setMostraEliminazione] = useState(false);

  const uid = utente?.uid;

  const caricaStagioni = useCallback(async () => {
    if (!uid) return;
    setStagioni(await elencaStagioni(uid));
  }, [uid]);

  useEffect(() => {
    void caricaStagioni();
  }, [caricaStagioni]);

  if (!worker || !utente) return null;

  /** Ogni modifica fa ricostruire la pagina pubblica: la Cloud Function ci pensa. */
  async function cambia(azione: () => Promise<void>, messaggio?: string) {
    setErrore(null);
    setAvviso(null);
    setInCorso(true);
    try {
      await azione();
      await ricaricaWorker();
      await caricaStagioni();
      if (messaggio) setAvviso(messaggio);
    } catch (e) {
      setErrore(messaggioErrore(e));
    } finally {
      setInCorso(false);
    }
  }

  function conPrivacy(modifiche: Partial<Privacy>): () => Promise<void> {
    return () => aggiornaPrivacy(utente!.uid, { ...worker!.privacy, ...modifiche });
  }

  /**
   * L'eliminazione non passa da `cambia`: dopo, non c'è più niente da ricaricare, e
   * provarci finirebbe con un messaggio d'errore in faccia a chi ha appena cancellato
   * l'account con successo.
   */
  async function elimina() {
    setErrore(null);
    setInCorso(true);
    try {
      await eliminaAccount({ conferma: 'ELIMINA' });
      await esci();
    } catch (e) {
      setErrore(messaggioErrore(e));
      setInCorso(false);
    }
  }

  return (
    <main className="schermata">
      <h1>Impostazioni e privacy</h1>

      <section className="scheda">
        <h2>Chi vede il tuo libretto</h2>

        <label className="interruttore">
          <input
            type="checkbox"
            checked={worker.privacy.pubblico}
            disabled={inCorso}
            onChange={(e) => void cambia(conPrivacy({ pubblico: e.target.checked }))}
          />
          <span>
            <strong>Il mio link funziona</strong>
            <span className="aiuto">
              Chi ha il link vede il tuo profilo. Non finisce nei motori di ricerca. Se lo spegni,
              il link smette di funzionare per tutti, subito.
            </span>
          </span>
        </label>

        <label className="interruttore">
          <input
            type="checkbox"
            checked={worker.privacy.mostraTelefono}
            disabled={inCorso}
            onChange={(e) => void cambia(conPrivacy({ mostraTelefono: e.target.checked }))}
          />
          <span>
            <strong>Mostra il mio numero</strong>
            <span className="aiuto">
              Chi apre il tuo link può scriverti su WhatsApp. Se è spento, il tuo numero non si vede
              da nessuna parte.
            </span>
          </span>
        </label>

        <label className="interruttore">
          <input
            type="checkbox"
            checked={worker.privacy.mostraInAttesa}
            disabled={inCorso}
            onChange={(e) => void cambia(conPrivacy({ mostraInAttesa: e.target.checked }))}
          />
          <span>
            <strong>Mostra anche le stagioni in attesa</strong>
            <span className="aiuto">
              Compaiono in un elenco a parte, dichiarate e non confermate. Conviene se stai
              aspettando risposte e ti serve far vedere l’esperienza adesso.
            </span>
          </span>
        </label>

        <p className="aiuto">
          Il tuo indirizzo pubblico è <code>/p/{worker.slug}</code>.{' '}
          <Link to={`/p/${worker.slug}`}>Guardalo come lo vede un datore</Link>.
        </p>
      </section>

      <section className="scheda">
        <h2>Il tuo CV</h2>
        <p className="aiuto">
          Facoltativo, un PDF fino a {MAX_CV_MB} MB. Il file non è pubblico: chi apre il tuo profilo
          ne riceve un indirizzo che scade dopo pochi minuti.
        </p>

        <div>
          <input
            id="cv"
            type="file"
            accept="application/pdf"
            className="file-nascosto"
            disabled={inCorso}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void cambia(() => caricaCv(utente.uid, file), 'CV caricato.');
            }}
          />
          <label htmlFor="cv" className="bottone bottone--secondario">
            {worker.cvPath ? 'Sostituisci il PDF' : 'Carica un PDF'}
          </label>
        </div>

        {worker.cvPath && (
          <>
            <label className="interruttore">
              <input
                type="checkbox"
                checked={worker.privacy.mostraCv}
                disabled={inCorso}
                onChange={(e) => void cambia(conPrivacy({ mostraCv: e.target.checked }))}
              />
              <span>
                <strong>Mostra il CV sul mio profilo</strong>
              </span>
            </label>
            <button
              type="button"
              className="bottone-testo bottone-testo--pericolo"
              disabled={inCorso}
              onClick={() => void cambia(() => rimuoviCv(utente.uid, worker.privacy), 'CV rimosso.')}
            >
              Togli il CV
            </button>
          </>
        )}
      </section>

      {stagioni.length > 0 && (
        <section className="scheda">
          <h2>Nascondi una stagione</h2>
          <p className="aiuto">
            Una stagione nascosta resta nel tuo libretto ma non compare sulla pagina pubblica.
          </p>
          {stagioni.map((s) => (
            <label key={s.id} className="interruttore">
              <input
                type="checkbox"
                checked={!s.nascosta}
                disabled={inCorso}
                onChange={(e) => void cambia(() => nascondiStagione(utente.uid, s.id, !e.target.checked))}
              />
              <span>
                <strong>
                  {s.strutturaNome} · {nomeRuolo(s.ruolo)}
                </strong>
                <span className="aiuto">
                  {formattaPeriodo(s.dal, s.al)} · {s.nascosta ? 'nascosta' : 'visibile'}
                </span>
              </span>
            </label>
          ))}
        </section>
      )}

      <section className="scheda">
        <h2>I tuoi dati</h2>
        <button
          type="button"
          className="bottone bottone--secondario"
          disabled={inCorso}
          onClick={() => void cambia(() => esportaDati(utente.uid))}
        >
          Scarica i miei dati
        </button>
        <p className="aiuto">
          Un file con il tuo profilo e le tue stagioni, comprese le conferme ricevute. Per qualunque
          richiesta sui tuoi dati puoi scrivere a <a href={`mailto:${EMAIL_PRIVACY}`}>{EMAIL_PRIVACY}</a>.
        </p>
      </section>

      <section className="scheda">
        <h2>Elimina il mio account</h2>
        {!mostraEliminazione ? (
          <>
            <p className="aiuto">
              Spariscono profilo, stagioni, richieste, conferme ricevute, foto e CV. Non si torna
              indietro.
            </p>
            <button
              type="button"
              className="bottone-testo bottone-testo--pericolo"
              onClick={() => setMostraEliminazione(true)}
            >
              Voglio eliminare il mio account
            </button>
          </>
        ) : (
          <>
            <p>
              Per essere sicuri: scrivi <strong>ELIMINA</strong> qui sotto. Spariscono profilo,
              stagioni, richieste, conferme ricevute, foto e CV, e il tuo link smette di funzionare.
            </p>
            <label className="campo">
              Scrivi ELIMINA
              <input
                type="text"
                autoComplete="off"
                value={confermaEliminazione}
                onChange={(e) => setConfermaEliminazione(e.target.value.toUpperCase())}
              />
            </label>
            <button
              type="button"
              className="bottone bottone--pericolo"
              disabled={inCorso || confermaEliminazione !== 'ELIMINA'}
              onClick={() => void elimina()}
            >
              {inCorso ? 'Elimino…' : 'Elimina tutto'}
            </button>
            <button type="button" className="bottone-testo" onClick={() => setMostraEliminazione(false)}>
              Lascia stare
            </button>
          </>
        )}
      </section>

      {errore && (
        <p className="errore" role="alert">
          {errore}
        </p>
      )}
      {avviso && <p className="conferma-campo">{avviso}</p>}

      <footer className="piede">
        <Link to="/libretto" className="bottone-testo">
          Torna al libretto
        </Link>
        <p className="aiuto">
          <Link to="/privacy">Informativa di {NOME_APP}</Link>
        </p>
      </footer>
    </main>
  );
}
