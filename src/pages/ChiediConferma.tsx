// L5 · Chiedi la conferma
//
// Il messaggio lo manda il lavoratore dal suo WhatsApp, non Libretto: così il
// responsabile riceve un messaggio da una persona che conosce, non da un servizio
// sconosciuto. È la differenza tra un minuto di attenzione e uno scarto immediato.

import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { NOME_APP } from '../config';
import { nomeRuolo } from '../data/ruoli';
import { messaggioErrore } from '../lib/errori';
import { registraEvento } from '../lib/eventi';
import { creaRichiesta } from '../lib/funzioni';
import { formattaPeriodo } from '../lib/periodo';
import { leggiStagione } from '../lib/stagioni';
import { normalizzaTelefono } from '../lib/telefono';
import type { StagioneConId } from '../lib/tipi';

function messaggioWhatsApp(
  nomeResponsabile: string,
  nomeLavoratore: string,
  stagione: StagioneConId,
  link: string,
): string {
  return (
    `Ciao ${nomeResponsabile}, sono ${nomeLavoratore}. ` +
    `Sto raccogliendo le conferme delle mie stagioni su ${NOME_APP}. ` +
    `Mi confermi che ho lavorato da ${stagione.strutturaNome} come ${nomeRuolo(stagione.ruolo)} ` +
    `(${formattaPeriodo(stagione.dal, stagione.al)})? ` +
    `Ti basta un minuto: ${link}\nGrazie!`
  );
}

export default function ChiediConferma() {
  const { id: stagioneId } = useParams();
  const navigate = useNavigate();
  const { utente, worker } = useAuth();

  const [stagione, setStagione] = useState<StagioneConId | null>(null);
  const [nome, setNome] = useState('');
  const [telefono, setTelefono] = useState('');
  const [link, setLink] = useState<string | null>(null);
  const [scadeFraGiorni, setScadeFraGiorni] = useState(30);
  const [copiato, setCopiato] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);
  const [inCorso, setInCorso] = useState(false);

  useEffect(() => {
    if (!utente || !stagioneId) return;
    let annullato = false;
    leggiStagione(utente.uid, stagioneId)
      .then((s) => {
        if (annullato) return;
        if (!s) setErrore('Questa stagione non c’è più.');
        else setStagione(s);
      })
      .catch((e) => {
        if (!annullato) setErrore(messaggioErrore(e));
      });
    return () => {
      annullato = true;
    };
  }, [utente, stagioneId]);

  async function preparaMessaggio() {
    setErrore(null);
    if (!utente || !worker || !stagione || !stagioneId) return;

    const nomePulito = nome.trim();
    if (nomePulito.length < 2) {
      setErrore('Scrivi il nome di chi deve confermare.');
      return;
    }

    const numero = normalizzaTelefono(telefono);
    if (!numero) {
      setErrore('Il numero non mi sembra giusto. Controllalo.');
      return;
    }
    if (numero === worker.telefono) {
      setErrore('Questo è il tuo numero: la conferma deve arrivare da chi ti ha visto lavorare.');
      return;
    }

    setInCorso(true);
    try {
      const esito = await creaRichiesta({
        stagioneId,
        nomeResponsabile: nomePulito,
        telefonoResponsabile: numero,
      });
      setLink(`${window.location.origin}/c/${esito.data.token}`);
      setScadeFraGiorni(esito.data.scadeFraGiorni);
      await registraEvento('richiesta_inviata', utente.uid);
    } catch (e) {
      setErrore(messaggioErrore(e));
    } finally {
      setInCorso(false);
    }
  }

  async function copia(testo: string) {
    try {
      await navigator.clipboard.writeText(testo);
      setCopiato(true);
      setTimeout(() => setCopiato(false), 2500);
    } catch {
      setErrore('Non riesco a copiare. Tieni premuto sul link e copialo a mano.');
    }
  }

  if (!worker) return null;

  if (!stagione) {
    return (
      <main className="schermata schermata--centrata">
        <div className="scheda">
          <p className="aiuto">{errore ?? 'Un momento…'}</p>
          <Link to="/libretto" className="bottone-testo">
            Torna al libretto
          </Link>
        </div>
      </main>
    );
  }

  const nomeLavoratore = `${worker.nome} ${worker.cognome}`;
  const numeroPulito = normalizzaTelefono(telefono)?.replace('+', '') ?? '';
  const testo = link ? messaggioWhatsApp(nome.trim(), nomeLavoratore, stagione, link) : '';

  return (
    <main className="schermata">
      <section className="scheda">
        <h1>Chiedi la conferma</h1>
        <p className="aiuto">
          {stagione.strutturaNome}, {stagione.strutturaComune} · {nomeRuolo(stagione.ruolo)} ·{' '}
          {formattaPeriodo(stagione.dal, stagione.al)}
        </p>

        {!link ? (
          <>
            <label className="campo">
              Chi ti ha visto lavorare
              <input
                type="text"
                placeholder="Nome e cognome, o come lo chiami"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
              />
              <span className="aiuto">Serve solo per scrivere il messaggio. Non finisce da nessuna parte in pubblico.</span>
            </label>

            <label className="campo">
              Il suo numero di cellulare
              <input
                type="tel"
                inputMode="tel"
                placeholder="347 123 4567"
                value={telefono}
                onChange={(e) => setTelefono(e.target.value)}
              />
              <span className="aiuto">
                Controllalo bene: il link funziona <strong>solo</strong> da questo numero. È quello
                che rende la tua conferma vera, ma vuol dire che con una cifra sbagliata non
                funziona.
              </span>
            </label>

            {errore && (
              <p className="errore" role="alert">
                {errore}
              </p>
            )}

            <button
              type="button"
              className="bottone bottone--principale"
              disabled={inCorso}
              onClick={() => void preparaMessaggio()}
            >
              {inCorso ? 'Preparo…' : 'Prepara il messaggio'}
            </button>
          </>
        ) : (
          <>
            <p>
              Ecco il messaggio. Mandalo <strong>dal tuo WhatsApp</strong>: così {nome.trim()} riceve
              un messaggio da te, non da un servizio che non conosce.
            </p>

            <blockquote className="anteprima-messaggio">{testo}</blockquote>

            <a
              className="bottone bottone--principale"
              href={`https://wa.me/${numeroPulito}?text=${encodeURIComponent(testo)}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              Manda su WhatsApp
            </a>

            <button type="button" className="bottone bottone--secondario" onClick={() => void copia(link)}>
              {copiato ? 'Copiato' : 'Copia il link'}
            </button>

            <p className="aiuto">
              Il link vale {scadeFraGiorni} giorni. Se non risponde, puoi rimandarlo dal tuo
              libretto.
            </p>

            {errore && (
              <p className="errore" role="alert">
                {errore}
              </p>
            )}

            <button type="button" className="bottone-testo" onClick={() => navigate('/libretto')}>
              Ho mandato il messaggio
            </button>
          </>
        )}
      </section>

      {!link && (
        <Link to="/libretto" className="bottone-testo">
          Torna al libretto
        </Link>
      )}
    </main>
  );
}
