// L2 · Crea il tuo profilo
// Nome e cognome, foto (facoltativa), ruolo principale, comune. Niente altro:
// niente data di nascita, niente indirizzo, niente codice fiscale (§9, minimizzazione).

import { useMemo, useState } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { NOME_APP } from '../config';
import { cercaComuni, comunePerId } from '../data/comuni';
import { RUOLI } from '../data/ruoli';
import { messaggioErrore } from '../lib/errori';
import { creaProfilo } from '../lib/worker';
import { invitoInSospeso, scartaInvitoInSospeso } from './Accesso';

const MAX_FOTO_MB = 5;

export default function CreaProfilo() {
  const { utente, ricaricaWorker } = useAuth();
  const [nome, setNome] = useState('');
  const [cognome, setCognome] = useState('');
  const [ruolo, setRuolo] = useState('');
  const [testoComune, setTestoComune] = useState('');
  const [comuneId, setComuneId] = useState<string | null>(null);
  const [foto, setFoto] = useState<File | null>(null);
  const [anteprima, setAnteprima] = useState<string | null>(null);
  const [errore, setErrore] = useState<string | null>(null);
  const [inCorso, setInCorso] = useState(false);

  const suggerimenti = useMemo(
    () => (comuneId ? [] : cercaComuni(testoComune)),
    [testoComune, comuneId],
  );

  function scegliFoto(file: File | null) {
    setErrore(null);
    if (!file) {
      setFoto(null);
      setAnteprima(null);
      return;
    }
    if (!file.type.startsWith('image/')) {
      setErrore('La foto deve essere un’immagine.');
      return;
    }
    if (file.size > MAX_FOTO_MB * 1024 * 1024) {
      setErrore(`La foto è troppo grande: il limite è ${MAX_FOTO_MB} MB.`);
      return;
    }
    setFoto(file);
    setAnteprima(URL.createObjectURL(file));
  }

  async function salva() {
    setErrore(null);
    if (!utente) return;

    if (nome.trim().length < 2 || cognome.trim().length < 2) {
      setErrore('Scrivi nome e cognome.');
      return;
    }
    if (ruolo === '') {
      setErrore('Scegli il ruolo che fai più spesso.');
      return;
    }
    if (!comuneId) {
      setErrore('Scegli il tuo comune dall’elenco.');
      return;
    }

    setInCorso(true);
    try {
      await creaProfilo(utente.uid, {
        nome,
        cognome,
        ruoloPrincipale: ruolo,
        comuneId,
        telefono: utente.phoneNumber ?? '',
        invito: invitoInSospeso(),
        foto,
      });
      scartaInvitoInSospeso();
      await ricaricaWorker();
    } catch (e) {
      setErrore(messaggioErrore(e));
    } finally {
      setInCorso(false);
    }
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
        <h1>Crea il tuo {NOME_APP.toLowerCase()}</h1>
        <p className="aiuto">Quattro cose e hai finito. Le stagioni le aggiungi dopo.</p>

        <div className="due-campi">
          <label className="campo">
            Nome
            <input type="text" autoComplete="given-name" value={nome} onChange={(e) => setNome(e.target.value)} required />
          </label>
          <label className="campo">
            Cognome
            <input
              type="text"
              autoComplete="family-name"
              value={cognome}
              onChange={(e) => setCognome(e.target.value)}
              required
            />
          </label>
        </div>

        <div className="campo">
          <span className="etichetta">Foto</span>
          <div className="riga-foto">
            {anteprima ? (
              <img src={anteprima} alt="La tua foto" className="anteprima-foto" />
            ) : (
              <div className="anteprima-foto anteprima-foto--vuota" aria-hidden="true" />
            )}
            <div>
              <input
                id="foto"
                type="file"
                accept="image/*"
                className="file-nascosto"
                onChange={(e) => scegliFoto(e.target.files?.[0] ?? null)}
              />
              <label htmlFor="foto" className="bottone bottone--secondario">
                {foto ? 'Cambia foto' : 'Scegli una foto'}
              </label>
              <p className="aiuto">Non è obbligatoria, ma un volto conta: chi ti cerca ti riconosce.</p>
            </div>
          </div>
        </div>

        <label className="campo">
          Il ruolo che fai più spesso
          <select value={ruolo} onChange={(e) => setRuolo(e.target.value)} required>
            <option value="">Scegli…</option>
            {RUOLI.map((r) => (
              <option key={r.id} value={r.id}>
                {r.nome}
              </option>
            ))}
          </select>
        </label>

        <label className="campo">
          Il tuo comune
          <input
            type="text"
            autoComplete="off"
            placeholder="Terracina"
            value={testoComune}
            onChange={(e) => {
              setTestoComune(e.target.value);
              setComuneId(null);
            }}
            required
          />
          {comuneId && <span className="conferma-campo">{comunePerId(comuneId)?.nome}, provincia di Latina</span>}
        </label>

        {suggerimenti.length > 0 && (
          <ul className="suggerimenti">
            {suggerimenti.map((c) => (
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

        {testoComune.length >= 2 && !comuneId && suggerimenti.length === 0 && (
          <p className="aiuto">
            Per ora ci sono i comuni della provincia di Latina. Se manca il tuo, scrivi a chi gestisce {NOME_APP}.
          </p>
        )}

        {errore && (
          <p className="errore" role="alert">
            {errore}
          </p>
        )}

        <button type="submit" className="bottone bottone--principale" disabled={inCorso}>
          {inCorso ? 'Creo…' : `Crea il mio ${NOME_APP.toLowerCase()}`}
        </button>
      </form>
    </main>
  );
}
