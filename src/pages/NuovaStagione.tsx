// L4 · Aggiungi stagione (e correggine una già scritta)
//
// Quattro cose in fila: struttura, ruolo, periodo, competenze. Poi la stagione resta in
// bozza finché non si chiede la conferma (L5).
//
// I nomi di struttura e comune si copiano sulla stagione al momento del salvataggio (§6):
// se un domani la struttura cambia nome, quello che il responsabile ha confermato resta
// quello che era scritto quando ha confermato.

import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { cercaComuni, comunePerId } from '../data/comuni';
import { competenzeDelRuolo, RUOLI } from '../data/ruoli';
import { messaggioErrore } from '../lib/errori';
import { registraEvento } from '../lib/eventi';
import { anniPossibili, componiPeriodo, MESI, periodoValido, scomponiPeriodo } from '../lib/periodo';
import {
  aggiornaStagione,
  cancellaStagione,
  creaStagione,
  leggiStagione,
  modificabile,
} from '../lib/stagioni';
import { cercaStrutture, creaStruttura } from '../lib/strutture';
import type { StrutturaConId } from '../lib/tipi';

type StrutturaScelta = { id: string; nome: string; comune: string };

export default function NuovaStagione() {
  const { id: stagioneId } = useParams();
  const navigate = useNavigate();
  const { utente, worker } = useAuth();
  const inModifica = stagioneId !== undefined;

  const [struttura, setStruttura] = useState<StrutturaScelta | null>(null);
  const [testoStruttura, setTestoStruttura] = useState('');
  const [suggerimenti, setSuggerimenti] = useState<StrutturaConId[]>([]);
  const [cercando, setCercando] = useState(false);
  const [nuovaStruttura, setNuovaStruttura] = useState(false);
  const [testoComune, setTestoComune] = useState('');
  const [comuneId, setComuneId] = useState<string | null>(null);

  const [ruolo, setRuolo] = useState('');
  const anni = useMemo(() => anniPossibili(), []);
  const [dalMese, setDalMese] = useState(5);
  const [dalAnno, setDalAnno] = useState(anni[0] ?? new Date().getFullYear());
  const [alMese, setAlMese] = useState(9);
  const [alAnno, setAlAnno] = useState(anni[0] ?? new Date().getFullYear());
  const [competenze, setCompetenze] = useState<string[]>([]);

  const [errore, setErrore] = useState<string | null>(null);
  const [inCorso, setInCorso] = useState(false);
  const [caricata, setCaricata] = useState(!inModifica);
  const listaCompetenze = useMemo(() => competenzeDelRuolo(ruolo), [ruolo]);

  // Il ruolo principale del profilo è quello che si fa più spesso: parte già scelto.
  useEffect(() => {
    if (ruolo === '' && worker && !inModifica) setRuolo(worker.ruoloPrincipale);
  }, [worker, ruolo, inModifica]);

  // In modifica: si riempie tutto con quello che c'è già.
  useEffect(() => {
    if (!inModifica || !utente || !stagioneId) return;
    let annullato = false;
    leggiStagione(utente.uid, stagioneId)
      .then((stagione) => {
        if (annullato) return;
        if (!stagione) {
          setErrore('Questa stagione non c’è più.');
          setCaricata(true);
          return;
        }
        if (!modificabile(stagione.stato)) {
          setErrore('Questa stagione è già confermata: non si può più cambiare.');
          setCaricata(true);
          return;
        }
        setStruttura({
          id: stagione.strutturaId,
          nome: stagione.strutturaNome,
          comune: stagione.strutturaComune,
        });
        setTestoStruttura(stagione.strutturaNome);
        setRuolo(stagione.ruolo);
        const dal = scomponiPeriodo(stagione.dal);
        const al = scomponiPeriodo(stagione.al);
        if (dal) {
          setDalMese(dal.mese);
          setDalAnno(dal.anno);
        }
        if (al) {
          setAlMese(al.mese);
          setAlAnno(al.anno);
        }
        setCompetenze(stagione.competenzeDichiarate);
        setCaricata(true);
      })
      .catch((e) => {
        if (!annullato) {
          setErrore(messaggioErrore(e));
          setCaricata(true);
        }
      });
    return () => {
      annullato = true;
    };
  }, [inModifica, utente, stagioneId]);

  // Cambiando ruolo si tengono solo le competenze che quel ruolo ha davvero.
  const primoGiro = useRef(true);
  useEffect(() => {
    if (primoGiro.current) {
      primoGiro.current = false;
      return;
    }
    const ammesse = new Set(competenzeDelRuolo(ruolo).map((c) => c.id));
    setCompetenze((scelte) => scelte.filter((id) => ammesse.has(id)));
  }, [ruolo]);

  // Ricerca delle strutture: si aspetta che smetta di scrivere, per non fare
  // una lettura a ogni lettera.
  useEffect(() => {
    if (struttura || nuovaStruttura || testoStruttura.trim().length < 3) {
      setSuggerimenti([]);
      return;
    }
    setCercando(true);
    const attesa = setTimeout(() => {
      cercaStrutture(testoStruttura)
        .then(setSuggerimenti)
        .catch((e) => console.warn('Ricerca strutture:', e))
        .finally(() => setCercando(false));
    }, 300);
    return () => {
      clearTimeout(attesa);
      setCercando(false);
    };
  }, [testoStruttura, struttura, nuovaStruttura]);

  const comuniSuggeriti = useMemo(
    () => (comuneId ? [] : cercaComuni(testoComune)),
    [testoComune, comuneId],
  );

  function spunta(id: string, spuntata: boolean) {
    setCompetenze((scelte) =>
      spuntata ? [...new Set([...scelte, id])] : scelte.filter((x) => x !== id),
    );
  }

  async function salva() {
    setErrore(null);
    if (!utente) return;

    const dal = componiPeriodo(dalAnno, dalMese);
    const al = componiPeriodo(alAnno, alMese);

    if (!struttura && !nuovaStruttura) {
      setErrore('Scegli la struttura dall’elenco, o aggiungila se non c’è.');
      return;
    }
    if (nuovaStruttura && (testoStruttura.trim().length < 2 || !comuneId)) {
      setErrore('Per aggiungere una struttura servono il nome e il comune.');
      return;
    }
    if (ruolo === '') {
      setErrore('Scegli che ruolo facevi in quella stagione.');
      return;
    }
    if (!periodoValido(dal, al)) {
      setErrore('La fine della stagione non può venire prima dell’inizio.');
      return;
    }

    setInCorso(true);
    try {
      let scelta = struttura;
      if (!scelta) {
        const creata = await creaStruttura(utente.uid, testoStruttura, comuneId!);
        scelta = { id: creata.id, nome: creata.nome, comune: creata.comune };
        setStruttura(scelta);
      }

      const dati = {
        strutturaId: scelta.id,
        strutturaNome: scelta.nome,
        strutturaComune: scelta.comune,
        ruolo,
        dal,
        al,
        competenzeDichiarate: competenze,
      };

      if (inModifica && stagioneId) {
        await aggiornaStagione(utente.uid, stagioneId, dati);
      } else {
        await creaStagione(utente.uid, dati);
        await registraEvento('stagione_creata', utente.uid);
      }
      navigate('/libretto');
    } catch (e) {
      setErrore(messaggioErrore(e));
    } finally {
      setInCorso(false);
    }
  }

  async function cancella() {
    if (!utente || !stagioneId) return;
    if (!confirm('Cancello questa stagione? Non si torna indietro.')) return;
    setInCorso(true);
    try {
      await cancellaStagione(utente.uid, stagioneId);
      navigate('/libretto');
    } catch (e) {
      setErrore(messaggioErrore(e));
      setInCorso(false);
    }
  }

  if (!caricata) {
    return (
      <main className="schermata schermata--centrata">
        <p className="aiuto">Un momento…</p>
      </main>
    );
  }

  return (
    <main className="schermata">
      <form
        className="scheda"
        onSubmit={(e) => {
          e.preventDefault();
          void salva();
        }}
      >
        <h1>{inModifica ? 'Correggi la stagione' : 'Aggiungi una stagione'}</h1>

        {/* 1 · Struttura */}
        <label className="campo">
          Dove hai lavorato
          <input
            type="text"
            autoComplete="off"
            placeholder="Agriturismo, bar, hotel…"
            value={testoStruttura}
            onChange={(e) => {
              setTestoStruttura(e.target.value);
              setStruttura(null);
              setNuovaStruttura(false);
            }}
          />
          {struttura && (
            <span className="conferma-campo">
              {struttura.nome}, {struttura.comune}
            </span>
          )}
        </label>

        {!struttura && suggerimenti.length > 0 && (
          <ul className="suggerimenti">
            {suggerimenti.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => {
                    setStruttura({ id: s.id, nome: s.nome, comune: s.comune });
                    setTestoStruttura(s.nome);
                    setSuggerimenti([]);
                  }}
                >
                  <strong>{s.nome}</strong>
                  <span className="aiuto"> · {s.comune}</span>
                </button>
              </li>
            ))}
          </ul>
        )}

        {!struttura && !nuovaStruttura && testoStruttura.trim().length >= 3 && !cercando && (
          <div className="riga-aggiungi">
            <p className="aiuto">
              {suggerimenti.length > 0
                ? 'Non è nessuna di queste?'
                : 'Non c’è ancora nessuna struttura con questo nome.'}
            </p>
            <button type="button" className="bottone bottone--secondario" onClick={() => setNuovaStruttura(true)}>
              Aggiungi «{testoStruttura.trim()}»
            </button>
          </div>
        )}

        {nuovaStruttura && !struttura && (
          <>
            <p className="aiuto">
              Struttura nuova: la stai aggiungendo tu. Scrivi il nome come lo scriverebbe il
              titolare, così chi ha lavorato lì la ritrova.
            </p>
            <label className="campo">
              In che comune è
              <input
                type="text"
                autoComplete="off"
                placeholder="Terracina"
                value={testoComune}
                onChange={(e) => {
                  setTestoComune(e.target.value);
                  setComuneId(null);
                }}
              />
              {comuneId && <span className="conferma-campo">{comunePerId(comuneId)?.nome}</span>}
            </label>
            {comuniSuggeriti.length > 0 && (
              <ul className="suggerimenti">
                {comuniSuggeriti.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setComuneId(c.id);
                        setTestoComune(c.nome);
                      }}
                    >
                      {c.nome}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}

        {/* 2 · Ruolo */}
        <label className="campo">
          Che ruolo facevi
          <select value={ruolo} onChange={(e) => setRuolo(e.target.value)} required>
            <option value="">Scegli…</option>
            {RUOLI.map((r) => (
              <option key={r.id} value={r.id}>
                {r.nome}
              </option>
            ))}
          </select>
        </label>

        {/* 3 · Periodo */}
        <div className="campo">
          <span className="etichetta">Da quando</span>
          <div className="due-campi">
            <select
              aria-label="Mese di inizio"
              value={dalMese}
              onChange={(e) => setDalMese(Number(e.target.value))}
            >
              {MESI.map((mese, i) => (
                <option key={mese} value={i + 1}>
                  {mese}
                </option>
              ))}
            </select>
            <select
              aria-label="Anno di inizio"
              value={dalAnno}
              onChange={(e) => setDalAnno(Number(e.target.value))}
            >
              {anni.map((anno) => (
                <option key={anno} value={anno}>
                  {anno}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="campo">
          <span className="etichetta">A quando</span>
          <div className="due-campi">
            <select
              aria-label="Mese di fine"
              value={alMese}
              onChange={(e) => setAlMese(Number(e.target.value))}
            >
              {MESI.map((mese, i) => (
                <option key={mese} value={i + 1}>
                  {mese}
                </option>
              ))}
            </select>
            <select
              aria-label="Anno di fine"
              value={alAnno}
              onChange={(e) => setAlAnno(Number(e.target.value))}
            >
              {anni.map((anno) => (
                <option key={anno} value={anno}>
                  {anno}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* 4 · Competenze */}
        {listaCompetenze.length > 0 && (
          <fieldset className="gruppo">
            <legend>Cosa facevi, di quello che sai fare</legend>
            <p className="aiuto">
              Spunta solo quello che ti hanno visto fare: è chi ti ha visto lavorare che dovrà
              confermarlo.
            </p>
            {listaCompetenze.map((c) => (
              <label key={c.id} className="casella">
                <input
                  type="checkbox"
                  checked={competenze.includes(c.id)}
                  onChange={(e) => spunta(c.id, e.target.checked)}
                />
                <span>{c.nome}</span>
              </label>
            ))}
          </fieldset>
        )}

        {errore && (
          <p className="errore" role="alert">
            {errore}
          </p>
        )}

        <button type="submit" className="bottone bottone--principale" disabled={inCorso}>
          {inCorso ? 'Salvo…' : inModifica ? 'Salva le correzioni' : 'Salva la stagione'}
        </button>

        <button type="button" className="bottone-testo" onClick={() => navigate('/libretto')}>
          Torna al libretto
        </button>

        {inModifica && (
          <button type="button" className="bottone-testo bottone-testo--pericolo" onClick={() => void cancella()}>
            Cancella questa stagione
          </button>
        )}
      </form>
    </main>
  );
}
