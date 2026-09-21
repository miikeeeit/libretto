// L3 · Il mio libretto (home)
// Settimana 1: l'intestazione del profilo e l'interruttore della disponibilità.
// Le stagioni e i loro stati arrivano nella settimana 2 (§11).

import { useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { NOME_APP, STAGIONE_DISPONIBILITA } from '../config';
import { nomeRuolo } from '../data/ruoli';
import { messaggioErrore } from '../lib/errori';
import { formattaTelefono } from '../lib/telefono';
import { impostaDisponibile, urlFoto } from '../lib/worker';

export default function Libretto() {
  const { utente, worker, ricaricaWorker, esci } = useAuth();
  const [foto, setFoto] = useState<string | null>(null);
  const [errore, setErrore] = useState<string | null>(null);
  const [inCorso, setInCorso] = useState(false);

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
          {/* Settimana 2: qui vanno i numeri, es. "6 stagioni · 4 confermate · 3 lo riprenderebbero". */}
          <p className="numeri">Ancora nessuna stagione</p>
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
            <span className="aiuto">
              Chi apre il tuo link vede questo avviso. Puoi spegnerlo quando vuoi.
            </span>
          </span>
        </label>
        {errore && (
          <p className="errore" role="alert">
            {errore}
          </p>
        )}
      </section>

      <section className="scheda scheda--in-arrivo">
        <h2>Le tue stagioni</h2>
        <p>
          Il prossimo passo è questo: aggiungi una stagione e chiedi la conferma a chi ti ha visto
          lavorare. Arriva la settimana prossima.
        </p>
      </section>

      <footer className="piede">
        <p className="aiuto">
          Entri con il {formattaTelefono(worker.telefono || utente.phoneNumber || '')}. Il tuo indirizzo
          pubblico sarà <code>/p/{worker.slug}</code>.
        </p>
        <button type="button" className="bottone-testo" onClick={() => void esci()}>
          Esci da {NOME_APP}
        </button>
      </footer>
    </main>
  );
}
