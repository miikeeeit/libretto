// P1 · La pagina pubblica (`/p/<slug>`)
//
// È l'unica schermata che vedrà un datore, probabilmente da un telefono, di fretta, dopo
// aver ricevuto un link su WhatsApp. Quindi deve rispondere subito a una domanda sola:
// **quali di queste cose sono state confermate da qualcuno che l'ha visto lavorare?**
// Per questo confermato e dichiarato non si mescolano mai.

import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { NOME_APP } from '../config';
import { nomeCompetenza, nomeRuolo } from '../data/ruoli';
import { registraEvento } from '../lib/eventi';
import { urlCv } from '../lib/funzioni';
import { formattaPeriodo } from '../lib/periodo';
import {
  leggiProfiloPubblico,
  urlFotoPubblica,
  type ProfiloPubblico,
} from '../lib/profiloPubblico';

function riepilogo(p: ProfiloPubblico): string {
  const r = p.riepilogo;
  if (r.nConfermate === 0) return 'Nessuna stagione confermata, per ora';

  const pezzi = [
    r.nConfermate === 1 ? '1 stagione confermata' : `${r.nConfermate} stagioni confermate`,
    r.nStrutture === 1 ? 'da 1 struttura' : `da ${r.nStrutture} strutture`,
  ];
  const riga = pezzi.join(' ');
  if (r.nRiprenderebbe === 0) return riga;
  return `${riga} · ${r.nRiprenderebbe === 1 ? '1 lo riprenderebbe' : `${r.nRiprenderebbe} lo riprenderebbero`}`;
}

export default function PaginaPubblica() {
  const { slug = '' } = useParams();
  const [profilo, setProfilo] = useState<ProfiloPubblico | null | undefined>(undefined);
  const [foto, setFoto] = useState<string | null>(null);
  const [cvInCorso, setCvInCorso] = useState(false);
  const [erroreCv, setErroreCv] = useState<string | null>(null);

  useEffect(() => {
    let annullato = false;
    leggiProfiloPubblico(slug)
      .then(async (p) => {
        if (annullato) return;
        setProfilo(p);
        if (p) {
          await registraEvento('profilo_pubblico_visto');
          if (p.fotoPath) {
            const url = await urlFotoPubblica(p.fotoPath);
            if (!annullato) setFoto(url);
          }
        }
      })
      .catch(() => {
        if (!annullato) setProfilo(null);
      });
    return () => {
      annullato = true;
    };
  }, [slug]);

  if (profilo === undefined) {
    return (
      <main className="schermata schermata--centrata">
        <p className="aiuto">Un momento…</p>
      </main>
    );
  }

  // Profilo inesistente, privato o sospeso: un messaggio solo, uguale per tutti e tre i
  // casi. Che un numero esista o sia stato reso privato non è affare di chi apre il link.
  if (profilo === null) {
    return (
      <main className="schermata schermata--centrata">
        <div className="scheda">
          <h1>Questa pagina non è disponibile</h1>
          <p className="aiuto">
            Il link può essere sbagliato, o chi l’ha creato può aver reso privato il suo libretto.
          </p>
          <p className="aiuto">
            <Link to="/come-funziona">Cos’è {NOME_APP}</Link>
          </p>
        </div>
      </main>
    );
  }

  async function scaricaCv() {
    setErroreCv(null);
    setCvInCorso(true);
    try {
      const esito = await urlCv({ slug });
      window.open(esito.data.url, '_blank', 'noopener');
    } catch {
      setErroreCv('Il CV non è disponibile.');
    } finally {
      setCvInCorso(false);
    }
  }

  const confermate = profilo.stagioni.filter((s) => s.stato === 'confermata');
  const inAttesa = profilo.stagioni.filter((s) => s.stato === 'in_attesa');
  const competenzeConfermate = Object.entries(profilo.competenze.confermate).sort(
    (a, b) => b[1] - a[1],
  );

  return (
    <main className="schermata">
      <section className="testa-profilo">
        {foto ? (
          <img src={foto} alt={profilo.nome} className="foto-profilo" />
        ) : (
          <div className="foto-profilo foto-profilo--vuota" aria-hidden="true">
            {profilo.nome
              .split(' ')
              .slice(0, 2)
              .map((p) => p.charAt(0))
              .join('')}
          </div>
        )}
        <div>
          <h1>{profilo.nome}</h1>
          <p className="sottotitolo">
            {nomeRuolo(profilo.ruoloPrincipale)} · {profilo.comune}
          </p>
          <p className="numeri">{riepilogo(profilo)}</p>
        </div>
      </section>

      {profilo.disponibile && profilo.stagioneDisponibile && (
        <p className="badge badge--grande">Disponibile per la stagione {profilo.stagioneDisponibile}</p>
      )}

      {profilo.telefono && (
        <a
          className="bottone bottone--principale"
          href={`https://wa.me/${profilo.telefono.replace('+', '')}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          Contatta su WhatsApp
        </a>
      )}

      {profilo.haCv && (
        <>
          <button
            type="button"
            className="bottone bottone--secondario"
            disabled={cvInCorso}
            onClick={() => void scaricaCv()}
          >
            {cvInCorso ? 'Apro…' : 'Scarica il CV'}
          </button>
          {erroreCv && (
            <p className="errore" role="alert">
              {erroreCv}
            </p>
          )}
        </>
      )}

      <h2>Stagioni confermate</h2>
      {confermate.length === 0 ? (
        <section className="scheda">
          <p className="aiuto">
            Nessuna stagione confermata, per ora. Su {NOME_APP} una stagione compare qui solo
            quando la conferma chi ci ha lavorato insieme, dal suo telefono.
          </p>
        </section>
      ) : (
        <ul className="elenco-stagioni">
          {confermate.map((s, i) => (
            <li key={`${s.struttura}-${s.dal}-${i}`} className="stagione stagione--confermata">
              <div className="stagione__testa">
                <h3>{s.struttura}</h3>
                <span className="stato stato--confermata">Confermata</span>
              </div>
              <p className="sottotitolo">
                {nomeRuolo(s.ruolo)} · {s.comune}
              </p>
              <p className="aiuto">{formattaPeriodo(s.dal, s.al)}</p>
              <p className="riga-conferma">
                {s.ruoloResponsabile ? `Confermata dal ${s.ruoloResponsabile}` : 'Confermata'}
                {s.riprenderebbe && <span className="badge">Lo riprenderebbe</span>}
              </p>
            </li>
          ))}
        </ul>
      )}

      {inAttesa.length > 0 && (
        <>
          <h2>Stagioni dichiarate, in attesa di conferma</h2>
          <ul className="elenco-stagioni">
            {inAttesa.map((s, i) => (
              <li key={`${s.struttura}-${s.dal}-${i}`} className="stagione stagione--in_attesa">
                <div className="stagione__testa">
                  <h3>{s.struttura}</h3>
                  <span className="stato">In attesa</span>
                </div>
                <p className="sottotitolo">
                  {nomeRuolo(s.ruolo)} · {s.comune}
                </p>
                <p className="aiuto">{formattaPeriodo(s.dal, s.al)}</p>
              </li>
            ))}
          </ul>
        </>
      )}

      {(competenzeConfermate.length > 0 || profilo.competenze.dichiarate.length > 0) && (
        <section className="scheda">
          <h2>Cosa sa fare</h2>

          {competenzeConfermate.length > 0 && (
            <>
              <h3 className="titoletto">Confermate</h3>
              <ul className="etichette">
                {competenzeConfermate.map(([id, nStrutture]) => (
                  <li key={id} className="etichetta etichetta--confermata">
                    {nomeCompetenza(id)}
                    {nStrutture > 1 && <span className="conteggio"> · confermata da {nStrutture}</span>}
                  </li>
                ))}
              </ul>
            </>
          )}

          {profilo.competenze.dichiarate.length > 0 && (
            <>
              <h3 className="titoletto">Dichiarate, non ancora confermate</h3>
              <ul className="etichette">
                {profilo.competenze.dichiarate.map((id) => (
                  <li key={id} className="etichetta">
                    {nomeCompetenza(id)}
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      )}

      <section className="scheda scheda--in-arrivo">
        <h2>Come funziona {NOME_APP}</h2>
        <p>
          Una stagione è <strong>confermata</strong> quando chi ci ha lavorato insieme — il
          titolare, il capo sala, lo chef — l’ha confermata dal suo telefono, con un codice via
          SMS.
        </p>
        <p>
          Il link di conferma funziona <strong>solo</strong> dal numero indicato, quindi non si può
          girare a un amico. Di chi conferma si vede il ruolo, mai il nome.
        </p>
        <p>
          {NOME_APP} registra <strong>solo</strong> conferme positive: non esiste un modo per
          lasciare un giudizio negativo, quindi quello che manca non vuol dire niente.
        </p>
        <p className="aiuto">
          <Link to="/come-funziona">Per saperne di più</Link>
        </p>
      </section>
    </main>
  );
}
