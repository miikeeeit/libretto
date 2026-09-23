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

const NUMERI_A_PAROLE = ['zero', 'una', 'due', 'tre', 'quattro', 'cinque', 'sei', 'sette', 'otto', 'nove', 'dieci'];

function aParole(n: number): string {
  return NUMERI_A_PAROLE[n] ?? String(n);
}

function maiuscola(testo: string): string {
  return testo.charAt(0).toUpperCase() + testo.slice(1);
}

/** "Bar Somma, l'Oasi di Kufra e l'Hotel X" — come li elencherebbe una persona. */
function elenco(nomi: string[]): string {
  if (nomi.length <= 1) return nomi[0] ?? '';
  return `${nomi.slice(0, -1).join(', ')} e ${nomi.at(-1)}`;
}

/**
 * La frase in cima alla pagina.
 *
 * È l'unica cosa che un datore leggerà per certo, quindi risponde alla sua unica
 * domanda — chi garantisce per questa persona — e la risponde **coi nomi delle
 * strutture**, non con un conteggio: a Terracina «Bar Somma ha confermato» dice
 * infinitamente più di «1 struttura ha confermato».
 */
function dichiarazione(p: ProfiloPubblico, nome: string): string {
  const strutture = [...new Set(p.stagioni.filter((s) => s.stato === 'confermata').map((s) => s.struttura))];
  const primo = nome.split(' ')[0] ?? nome;

  if (strutture.length === 0) return `Nessuno ha ancora confermato le stagioni di ${primo}.`;
  if (strutture.length === 1) {
    return p.riepilogo.nConfermate === 1
      ? `${strutture[0]} ha confermato una stagione di ${primo}.`
      : `${strutture[0]} ha confermato ${aParole(p.riepilogo.nConfermate)} stagioni di ${primo}.`;
  }
  return `${maiuscola(aParole(strutture.length))} strutture hanno confermato le stagioni di ${primo}: ${elenco(strutture)}.`;
}

/** «Lo riprenderebbe» con la grammatica giusta: con una struttura sola non c'è un «loro». */
function riprenderebbero(p: ProfiloPubblico): string {
  const { nRiprenderebbe, nStrutture } = p.riepilogo;
  if (nStrutture <= 1) return 'Lo riprenderebbe.';
  if (nRiprenderebbe === 1) return 'Una di loro lo riprenderebbe.';
  return `${maiuscola(aParole(nRiprenderebbe))} di loro lo riprenderebbero.`;
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
      <section className="testa-pubblica">
        <div className="riga-identita">
          {foto ? (
            <img src={foto} alt={profilo.nome} className="foto-profilo foto-profilo--piccola" />
          ) : (
            <div className="foto-profilo foto-profilo--piccola foto-profilo--vuota" aria-hidden="true">
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
              {nomeRuolo(profilo.ruoloPrincipale)}, {profilo.comune}
            </p>
          </div>
        </div>

        <p className="dichiarazione">{dichiarazione(profilo, profilo.nome)}</p>

        {profilo.riepilogo.nRiprenderebbe > 0 && (
          <p className="dichiarazione-seconda">{riprenderebbero(profilo)}</p>
        )}

        {profilo.disponibile && profilo.stagioneDisponibile && (
          <p className="badge badge--grande">Disponibile per la stagione {profilo.stagioneDisponibile}</p>
        )}
      </section>

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
