// C1–C4 · Le schermate del responsabile.
//
// Chi arriva qui non ha un account, non conosce Libretto e sta facendo un favore a
// qualcuno. Quindi: quattro righe e nient'altro, un codice, un tap. Ogni campo in più è
// una conferma in meno, e una conferma in meno è il motivo per cui un profilo resta
// vuoto.

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useVerificaTelefono } from '../auth/useVerificaTelefono';
import { NOME_APP } from '../config';
import { nomeCompetenza, nomeRuolo } from '../data/ruoli';
import { messaggioErrore } from '../lib/errori';
import { registraEvento } from '../lib/eventi';
import { auth } from '../lib/firebase';
import {
  confermaStagione,
  leggiRichiesta,
  revocaConferma,
  segnalaStagione,
  type DatiRichiesta,
} from '../lib/funzioni';
import { formattaPeriodo } from '../lib/periodo';
import { combaciaConMaschera, normalizzaTelefono } from '../lib/telefono';

const RUOLI_RESPONSABILE = ['titolare', 'direttore', 'responsabile di sala', 'chef', 'altro'];

const MESSAGGI_LINK: Record<string, string> = {
  inesistente: 'Questo link non è valido.',
  usata: 'Questa conferma è già stata data. Grazie.',
  scaduta: 'Questo link è scaduto. Chiedi a chi te l’ha mandato di rimandartelo.',
  revocata: 'Questo link non è più valido.',
};

type Passo = 'caricamento' | 'quattro-righe' | 'codice' | 'modulo' | 'numero-sbagliato' | 'fatto';

export default function Conferma() {
  const { token = '' } = useParams();
  const { mandaCodice, verificaCodice } = useVerificaTelefono();

  const [dati, setDati] = useState<DatiRichiesta | null>(null);
  const [passo, setPasso] = useState<Passo>('caricamento');
  const [telefono, setTelefono] = useState('');
  const [codice, setCodice] = useState('');
  const [competenze, setCompetenze] = useState<string[]>([]);
  const [riprenderebbe, setRiprenderebbe] = useState(false);
  const [ruolo, setRuolo] = useState('titolare');
  const [consenso, setConsenso] = useState(false);
  const [mostraSegnalazione, setMostraSegnalazione] = useState(false);
  const [esito, setEsito] = useState<{ nome: string; nCompetenze: number } | null>(null);
  const [segnalata, setSegnalata] = useState(false);
  const [revocata, setRevocata] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);
  const [inCorso, setInCorso] = useState(false);

  const carica = useCallback(async () => {
    try {
      const risposta = await leggiRichiesta({ token });
      setDati(risposta.data);
      if (risposta.data.stato === 'aperta') {
        // Chi è già collegato col numero giusto salta la verifica.
        setPasso(risposta.data.numeroCoincide ? 'modulo' : 'quattro-righe');
        setCompetenze(risposta.data.competenzeDichiarate);
        await registraEvento('conferma_aperta');
      } else {
        setPasso('quattro-righe');
      }
    } catch (e) {
      setErrore(messaggioErrore(e));
      setPasso('quattro-righe');
    }
  }, [token]);

  useEffect(() => {
    void carica();
  }, [carica]);

  if (passo === 'caricamento') {
    return (
      <main className="schermata schermata--centrata">
        <p className="aiuto">Un momento…</p>
      </main>
    );
  }

  // Link non valido: un messaggio chiaro e nient'altro (§4.2 C1). Di chi fosse la
  // richiesta non si dice niente.
  if (!dati || dati.stato !== 'aperta') {
    const usataDaChiChiama = dati?.stato === 'usata' && dati.numeroCoincide;
    return (
      <main className="schermata schermata--centrata">
        <div className="scheda">
          <h1>{dati ? MESSAGGI_LINK[dati.stato] : (errore ?? 'Questo link non è valido.')}</h1>
          {usataDaChiChiama && !revocata && (
            <>
              <p className="aiuto">Hai confermato per errore?</p>
              <button
                type="button"
                className="bottone bottone--secondario"
                disabled={inCorso}
                onClick={async () => {
                  setInCorso(true);
                  setErrore(null);
                  try {
                    await revocaConferma({ token });
                    setRevocata(true);
                  } catch (e) {
                    setErrore(messaggioErrore(e));
                  } finally {
                    setInCorso(false);
                  }
                }}
              >
                Revoca la mia conferma
              </button>
            </>
          )}
          {revocata && <p>Fatto: la tua conferma è stata tolta dal libretto.</p>}
          {errore && (
            <p className="errore" role="alert">
              {errore}
            </p>
          )}
          <p className="aiuto">
            <a href="/come-funziona">Cos’è {NOME_APP}</a>
          </p>
        </div>
      </main>
    );
  }

  // Da qui in giù la richiesta è aperta: si lega a una costante, altrimenti il
  // controllo di tipo perde il filo dentro le funzioni qui sotto.
  const aperta = dati;

  const quattroRighe = (
    <div className="quattro-righe">
      <p className="riga-principale">
        <strong>{aperta.nomeLavoratore}</strong> dice di aver lavorato da te.
      </p>
      <p>
        <span className="etichetta-riga">Struttura</span> {aperta.struttura}, {aperta.comune}
      </p>
      <p>
        <span className="etichetta-riga">Ruolo</span> {nomeRuolo(aperta.ruolo)}
      </p>
      <p>
        <span className="etichetta-riga">Periodo</span> {formattaPeriodo(aperta.dal, aperta.al)}
      </p>
    </div>
  );

  async function chiediCodice() {
    setErrore(null);
    const numero = normalizzaTelefono(telefono);
    if (!numero) {
      setErrore('Scrivi il tuo numero di cellulare.');
      return;
    }
    // Si controlla contro la maschera prima di mandare l'SMS: un messaggio costa, e
    // così l'avviso arriva subito invece che dopo la verifica.
    if (!combaciaConMaschera(numero, aperta.telefonoMascherato)) {
      setPasso('numero-sbagliato');
      return;
    }
    setInCorso(true);
    try {
      await mandaCodice(numero);
      setPasso('codice');
    } catch (e) {
      setErrore(messaggioErrore(e));
    } finally {
      setInCorso(false);
    }
  }

  async function controllaCodice() {
    setErrore(null);
    setInCorso(true);
    try {
      await verificaCodice(codice);
      // Il controllo che conta lo fa il server: qui si chiede solo se il numero
      // verificato è quello a cui la richiesta è stata mandata.
      const risposta = await leggiRichiesta({ token });
      setDati(risposta.data);
      setPasso(risposta.data.stato === 'aperta' && risposta.data.numeroCoincide ? 'modulo' : 'numero-sbagliato');
    } catch (e) {
      setErrore(messaggioErrore(e));
    } finally {
      setInCorso(false);
    }
  }

  async function conferma() {
    setErrore(null);
    if (!consenso) {
      setErrore('Serve la tua spunta sul consenso per pubblicare la conferma.');
      return;
    }
    setInCorso(true);
    try {
      const risposta = await confermaStagione({
        token,
        competenzeConfermate: competenze,
        riprenderebbe,
        ruoloResponsabile: ruolo,
        consenso: true,
      });
      setEsito({
        nome: risposta.data.nomeLavoratore,
        nCompetenze: risposta.data.competenzeConfermate.length,
      });
      setPasso('fatto');
      await registraEvento('conferma_completata');
    } catch (e) {
      setErrore(messaggioErrore(e));
    } finally {
      setInCorso(false);
    }
  }

  async function segnala(motivo: 'mai_lavorato' | 'dati_sbagliati') {
    setErrore(null);
    setInCorso(true);
    try {
      await segnalaStagione({ token, motivo });
      setSegnalata(true);
      setPasso('fatto');
    } catch (e) {
      setErrore(messaggioErrore(e));
    } finally {
      setInCorso(false);
    }
  }

  // ---- C2 · numero che non coincide (PC2: si dice come rimediare) ----
  if (passo === 'numero-sbagliato') {
    return (
      <main className="schermata schermata--centrata">
        <div className="scheda">
          <h1>Questo link è stato inviato a un altro numero</h1>
          <p>
            Il link funziona solo dal numero che {aperta.nomeDiBattesimo} ha indicato: {' '}
            <strong>{aperta.telefonoMascherato}</strong>. È una regola che serve a te: vuol dire che
            nessuno può farsi confermare una stagione girando questo link a un amico.
          </p>
          <p>
            Se hai lavorato con {aperta.nomeDiBattesimo}, chiedigli di rimandartelo su questo numero:
            gli basta un tap dal suo libretto.
          </p>
          <button
            type="button"
            className="bottone bottone--secondario"
            onClick={async () => {
              await auth.signOut();
              setTelefono('');
              setCodice('');
              setPasso('quattro-righe');
            }}
          >
            Prova con un altro numero
          </button>
        </div>
      </main>
    );
  }

  // ---- C4 · grazie ----
  if (passo === 'fatto') {
    return (
      <main className="schermata schermata--centrata">
        <div className="scheda">
          {segnalata ? (
            <>
              <h1>Grazie, l’abbiamo segnato</h1>
              <p>
                Questa stagione non risulta più confermata e {aperta.nomeDiBattesimo} è stato
                avvisato. Non comparirà niente sul suo profilo.
              </p>
            </>
          ) : (
            <>
              <h1>Fatto, grazie</h1>
              <p>
                {esito?.nome} ora ha questa stagione confermata
                {esito && esito.nCompetenze > 0 ? `, con ${esito.nCompetenze} competenze` : ''}. Il
                tuo nome non compare da nessuna parte: sul suo profilo si legge «confermata dal{' '}
                {ruolo}».
              </p>

              <hr className="separatore" />

              <p>
                <strong>Anche i tuoi collaboratori possono avere il loro libretto.</strong> Se ti è
                sembrato utile, passa il link a chi lavora con te.
              </p>
              <a
                className="bottone bottone--secondario"
                href={`https://wa.me/?text=${encodeURIComponent(
                  `Ciao! Uso ${NOME_APP} per confermare le stagioni di chi ha lavorato con me. Se vuoi, crea il tuo libretto qui: ${window.location.origin}`,
                )}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                Manda il link
              </a>

              {revocata ? (
                <p className="aiuto">La tua conferma è stata revocata.</p>
              ) : (
                <button
                  type="button"
                  className="bottone-testo"
                  disabled={inCorso}
                  onClick={async () => {
                    setInCorso(true);
                    setErrore(null);
                    try {
                      await revocaConferma({ token });
                      setRevocata(true);
                    } catch (e) {
                      setErrore(messaggioErrore(e));
                    } finally {
                      setInCorso(false);
                    }
                  }}
                >
                  Hai confermato per errore? Revoca
                </button>
              )}
            </>
          )}
          {errore && (
            <p className="errore" role="alert">
              {errore}
            </p>
          )}
        </div>
      </main>
    );
  }

  // ---- C3 · il modulo, dopo la verifica ----
  if (passo === 'modulo') {
    return (
      <main className="schermata">
        <section className="scheda">
          {quattroRighe}

          {!mostraSegnalazione ? (
            <>
              {aperta.competenzeDichiarate.length > 0 && (
                <fieldset className="gruppo">
                  <legend>Dice di aver fatto queste cose. Togli quelle che non riconosci.</legend>
                  {aperta.competenzeDichiarate.map((id) => (
                    <label key={id} className="casella">
                      <input
                        type="checkbox"
                        checked={competenze.includes(id)}
                        onChange={(e) =>
                          setCompetenze((scelte) =>
                            e.target.checked ? [...scelte, id] : scelte.filter((c) => c !== id),
                          )
                        }
                      />
                      <span>{nomeCompetenza(id)}</span>
                    </label>
                  ))}
                </fieldset>
              )}

              <label className="interruttore">
                <input
                  type="checkbox"
                  checked={riprenderebbe}
                  onChange={(e) => setRiprenderebbe(e.target.checked)}
                />
                <span>
                  <strong>Lo riprenderei</strong>
                  <span className="aiuto">Facoltativo. Se non lo spunti non compare niente.</span>
                </span>
              </label>

              <label className="campo">
                Il tuo ruolo
                <select value={ruolo} onChange={(e) => setRuolo(e.target.value)}>
                  {RUOLI_RESPONSABILE.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
                <span className="aiuto">Sul profilo si legge solo questo, mai il tuo nome.</span>
              </label>

              <label className="casella">
                <input
                  type="checkbox"
                  checked={consenso}
                  onChange={(e) => setConsenso(e.target.checked)}
                />
                <span>
                  La mia conferma, senza il mio nome, sarà visibile sul profilo di{' '}
                  {aperta.nomeDiBattesimo}.
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
                onClick={() => void conferma()}
              >
                {inCorso ? 'Un momento…' : 'Confermo, ha lavorato qui'}
              </button>

              <button type="button" className="bottone-testo" onClick={() => setMostraSegnalazione(true)}>
                Non corrisponde al vero
              </button>
            </>
          ) : (
            <>
              <h2>Cosa non torna?</h2>
              <button
                type="button"
                className="bottone bottone--secondario"
                disabled={inCorso}
                onClick={() => void segnala('mai_lavorato')}
              >
                Non ha mai lavorato qui
              </button>
              <button
                type="button"
                className="bottone bottone--secondario"
                disabled={inCorso}
                onClick={() => void segnala('dati_sbagliati')}
              >
                I dati sono sbagliati
              </button>
              {errore && (
                <p className="errore" role="alert">
                  {errore}
                </p>
              )}
              <button type="button" className="bottone-testo" onClick={() => setMostraSegnalazione(false)}>
                Torna indietro
              </button>
            </>
          )}
        </section>
      </main>
    );
  }

  // ---- C1 e C2 · le quattro righe e la verifica ----
  return (
    <main className="schermata">
      <section className="scheda">
        {quattroRighe}

        {passo === 'quattro-righe' ? (
          <>
            <h2>Per confermare, verifica il tuo numero</h2>
            <p className="aiuto">
              {aperta.nomeDiBattesimo} ha indicato il numero <strong>{aperta.telefonoMascherato}</strong>.
              Scrivilo per intero: ti arriva un codice via SMS. Non serve nessun account.
            </p>
            <label className="campo">
              Il tuo numero di cellulare
              <input
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                placeholder="Il tuo numero, per intero"
                value={telefono}
                onChange={(e) => setTelefono(e.target.value)}
              />
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
              onClick={() => void chiediCodice()}
            >
              {inCorso ? 'Un momento…' : 'Mandami il codice'}
            </button>
          </>
        ) : (
          <>
            <h2>Scrivi il codice</h2>
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
                autoFocus
              />
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
              onClick={() => void controllaCodice()}
            >
              {inCorso ? 'Controllo…' : 'Continua'}
            </button>
          </>
        )}
      </section>

      <p className="aiuto piede-conferma">
        {NOME_APP} raccoglie solo conferme positive: non esiste un modo per dare un giudizio
        negativo. Del tuo numero non si vede niente in pubblico.{' '}
        <a href="/come-funziona">Come funziona</a>
      </p>
    </main>
  );
}
