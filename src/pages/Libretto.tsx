// L3 · Il mio libretto (home)
// I numeri in cima, l'interruttore della disponibilità, e le stagioni dalla più recente
// con lo stato di ognuna.

import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { NOME_APP, STAGIONE_DISPONIBILITA } from '../config';
import { nomeCompetenza, nomeRuolo } from '../data/ruoli';
import { messaggioErrore } from '../lib/errori';
import { registraEvento } from '../lib/eventi';
import { formattaPeriodo } from '../lib/periodo';
import { elencaStagioni, modificabile, riepiloga } from '../lib/stagioni';
import { formattaTelefono } from '../lib/telefono';
import type { StagioneConId, StatoStagione } from '../lib/tipi';
import { impostaDisponibile, urlFoto } from '../lib/worker';

const ETICHETTE: Record<StatoStagione, string> = {
  bozza: 'Bozza',
  in_attesa: 'In attesa',
  confermata: 'Confermata',
  non_confermata: 'Non confermata',
  scaduta: 'Scaduta',
};

function numeri(stagioni: StagioneConId[]): string {
  const r = riepiloga(stagioni);
  if (r.nStagioni === 0) return 'Ancora nessuna stagione';

  const pezzi = [r.nStagioni === 1 ? '1 stagione' : `${r.nStagioni} stagioni`];
  if (r.nConfermate > 0) {
    pezzi.push(r.nConfermate === 1 ? '1 confermata' : `${r.nConfermate} confermate`);
  }
  if (r.nRiprenderebbe > 0) {
    pezzi.push(r.nRiprenderebbe === 1 ? '1 lo riprenderebbe' : `${r.nRiprenderebbe} lo riprenderebbero`);
  }
  return pezzi.join(' · ');
}

export default function Libretto() {
  const { utente, worker, ricaricaWorker, esci } = useAuth();
  const [foto, setFoto] = useState<string | null>(null);
  const [stagioni, setStagioni] = useState<StagioneConId[] | null>(null);
  const [errore, setErrore] = useState<string | null>(null);
  const [inCorso, setInCorso] = useState(false);
  const [condiviso, setCondiviso] = useState(false);

  const uid = utente?.uid;

  const caricaStagioni = useCallback(async () => {
    if (!uid) return;
    try {
      setStagioni(await elencaStagioni(uid));
    } catch (e) {
      setErrore(messaggioErrore(e));
      setStagioni([]);
    }
  }, [uid]);

  useEffect(() => {
    void caricaStagioni();
  }, [caricaStagioni]);

  useEffect(() => {
    if (!worker?.fotoPath) {
      setFoto(null);
      return;
    }
    let annullato = false;
    urlFoto(worker.fotoPath)
      .then((url) => {
        if (!annullato) setFoto(url);
      })
      .catch(() => {
        if (!annullato) setFoto(null);
      });
    return () => {
      annullato = true;
    };
  }, [worker?.fotoPath]);

  if (!worker || !utente) return null;

  async function cambiaDisponibilita(disponibile: boolean) {
    setErrore(null);
    setInCorso(true);
    try {
      await impostaDisponibile(utente!.uid, disponibile);
      await ricaricaWorker();
    } catch (e) {
      setErrore(messaggioErrore(e));
    } finally {
      setInCorso(false);
    }
  }

  /** Sul telefono si apre la condivisione di sistema, sul resto si copia il link. */
  async function condividi() {
    const url = `${window.location.origin}/p/${worker!.slug}`;
    const testo = `Il mio libretto di lavoro: ${url}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: NOME_APP, text: testo, url });
      } else {
        await navigator.clipboard.writeText(url);
        setCondiviso(true);
        setTimeout(() => setCondiviso(false), 2500);
      }
      await registraEvento('profilo_condiviso', utente!.uid);
    } catch {
      // Condivisione annullata: non è un errore da mostrare.
    }
  }

  return (
    <main className="schermata">
      <section className="testa-profilo">
        {foto ? (
          <img src={foto} alt={`${worker.nome} ${worker.cognome}`} className="foto-profilo" />
        ) : (
          <div className="foto-profilo foto-profilo--vuota" aria-hidden="true">
            {worker.nome.charAt(0)}
            {worker.cognome.charAt(0)}
          </div>
        )}
        <div>
          <h1>
            {worker.nome} {worker.cognome}
          </h1>
          <p className="sottotitolo">
            {nomeRuolo(worker.ruoloPrincipale)} · {worker.comune}
          </p>
          <p className="numeri">{numeri(stagioni ?? [])}</p>
        </div>
      </section>

      <section className="scheda">
        <label className="interruttore">
          <input
            type="checkbox"
            checked={worker.disponibile}
            disabled={inCorso}
            onChange={(e) => void cambiaDisponibilita(e.target.checked)}
          />
          <span>
            <strong>Disponibile per la stagione {STAGIONE_DISPONIBILITA}</strong>
            <span className="aiuto">Chi apre il tuo link vede questo avviso. Puoi spegnerlo quando vuoi.</span>
          </span>
        </label>
        {errore && (
          <p className="errore" role="alert">
            {errore}
          </p>
        )}
      </section>

      <div className="testa-elenco">
        <h2>Le tue stagioni</h2>
        <Link to="/stagione/nuova" className="bottone bottone--principale bottone--piccolo">
          Aggiungi stagione
        </Link>
      </div>

      {stagioni === null ? (
        <p className="aiuto">Un momento…</p>
      ) : stagioni.length === 0 ? (
        <section className="scheda scheda--in-arrivo">
          <p>
            Comincia dall’ultima: la struttura, il ruolo, i mesi e cosa facevi. Poi chiederai la
            conferma a chi ti ha visto lavorare.
          </p>
        </section>
      ) : (
        <ul className="elenco-stagioni">
          {stagioni.map((s) => (
            <li key={s.id} className={`stagione stagione--${s.stato}`}>
              <div className="stagione__testa">
                <h3>{s.strutturaNome}</h3>
                <span className={`stato stato--${s.stato}`}>{ETICHETTE[s.stato]}</span>
              </div>

              <p className="sottotitolo">
                {nomeRuolo(s.ruolo)} · {s.strutturaComune}
              </p>
              <p className="aiuto">{formattaPeriodo(s.dal, s.al)}</p>

              {s.stato === 'confermata' && (
                <p className="riga-conferma">
                  Confermata{s.ruoloResponsabile ? ` dal ${s.ruoloResponsabile}` : ''}
                  {s.riprenderebbe && <span className="badge">Lo riprenderebbe</span>}
                </p>
              )}

              {s.competenzeConfermate.length > 0 ? (
                <p className="competenze">
                  <strong>Confermate:</strong>{' '}
                  {s.competenzeConfermate.map((c) => nomeCompetenza(c)).join(' · ')}
                </p>
              ) : (
                s.competenzeDichiarate.length > 0 && (
                  <p className="competenze competenze--dichiarate">
                    {s.competenzeDichiarate.map((c) => nomeCompetenza(c)).join(' · ')}
                  </p>
                )
              )}

              {s.stato === 'non_confermata' && (
                <p className="aiuto">
                  Il responsabile dice che i dati non corrispondono. Questa riga la vedi solo tu:
                  correggila e richiedi la conferma, oppure cancellala.
                </p>
              )}

              <div className="stagione__azioni">
                {s.stato !== 'confermata' && (
                  <Link
                    to={`/stagione/${s.id}/conferma`}
                    className="bottone bottone--secondario bottone--piccolo"
                  >
                    {s.stato === 'bozza' ? 'Chiedi la conferma' : 'Rimanda la richiesta'}
                  </Link>
                )}
                {modificabile(s.stato) && (
                  <Link to={`/stagione/${s.id}`} className="bottone-testo">
                    Correggi
                  </Link>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      <section className="scheda">
        <h2>Il tuo link</h2>
        <p className="aiuto">
          È questo che mandi a un datore. Vede le stagioni confermate, separate da quelle che hai
          solo dichiarato, e non vede il tuo numero se non lo accendi tu.
        </p>
        <div className="riga-bottoni">
          <Link to={`/p/${worker.slug}`} className="bottone bottone--secondario bottone--piccolo">
            Vedi la mia pagina
          </Link>
          <button
            type="button"
            className="bottone bottone--principale bottone--piccolo"
            onClick={() => void condividi()}
          >
            {condiviso ? 'Link copiato' : 'Condividi il link'}
          </button>
        </div>
        {!worker.privacy.pubblico && (
          <p className="errore">
            Il tuo link è spento: chi lo apre non vede niente. Lo riaccendi dalle impostazioni.
          </p>
        )}
      </section>

      <footer className="piede">
        <Link to="/impostazioni" className="bottone-testo">
          Impostazioni e privacy
        </Link>
        <p className="aiuto">
          Entri con il {formattaTelefono(worker.telefono || utente.phoneNumber || '')}.
        </p>
        <button type="button" className="bottone-testo" onClick={() => void esci()}>
          Esci da {NOME_APP}
        </button>
      </footer>
    </main>
  );
}
