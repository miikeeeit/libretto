// Le rotte della §10. Chi è collegato e ha un profilo va al suo libretto,
// chi è collegato ma non ha ancora un profilo va a crearlo, gli altri all'accesso.

import type { ReactNode } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth/AuthProvider';
import Accesso from './pages/Accesso';
import ChiediConferma from './pages/ChiediConferma';
import ComeFunziona from './pages/ComeFunziona';
import Conferma from './pages/Conferma';
import CreaProfilo from './pages/CreaProfilo';
import InArrivo from './pages/InArrivo';
import Libretto from './pages/Libretto';
import NuovaStagione from './pages/NuovaStagione';
import Privacy from './pages/Privacy';

function Attesa() {
  return (
    <main className="schermata schermata--centrata">
      <p className="aiuto">Un momento…</p>
    </main>
  );
}

/** Le schermate del libretto vogliono un profilo: senza, si passa da L1 o da L2. */
function ConProfilo({ children }: { children: ReactNode }) {
  const { utente, worker } = useAuth();
  if (utente === undefined || (utente !== null && worker === undefined)) return <Attesa />;
  if (!utente) return <Navigate to="/" replace />;
  if (!worker) return <Navigate to="/profilo/nuovo" replace />;
  return <>{children}</>;
}

export default function App() {
  const { utente, worker } = useAuth();
  const inCaricamento = utente === undefined || (utente !== null && worker === undefined);

  return (
    <Routes>
      <Route path="/privacy" element={<Privacy />} />
      <Route path="/come-funziona" element={<ComeFunziona />} />

      {/* C1–C4: la conferma del responsabile. Nessun account, solo il suo telefono. */}
      <Route path="/c/:token" element={<Conferma />} />

      {/* Settimana 4: la pagina pubblica. */}
      <Route
        path="/p/:slug"
        element={
          <InArrivo
            titolo="Questa pagina non è ancora attiva"
            testo="I profili pubblici si aprono tra poco."
          />
        }
      />

      <Route
        path="/"
        element={inCaricamento ? <Attesa /> : utente ? <Navigate to="/libretto" replace /> : <Accesso />}
      />

      <Route
        path="/libretto"
        element={
          <ConProfilo>
            <Libretto />
          </ConProfilo>
        }
      />
      <Route
        path="/stagione/nuova"
        element={
          <ConProfilo>
            <NuovaStagione />
          </ConProfilo>
        }
      />
      <Route
        path="/stagione/:id"
        element={
          <ConProfilo>
            <NuovaStagione />
          </ConProfilo>
        }
      />
      <Route
        path="/stagione/:id/conferma"
        element={
          <ConProfilo>
            <ChiediConferma />
          </ConProfilo>
        }
      />

      <Route
        path="/profilo/nuovo"
        element={
          inCaricamento ? (
            <Attesa />
          ) : !utente ? (
            <Navigate to="/" replace />
          ) : worker ? (
            <Navigate to="/libretto" replace />
          ) : (
            <CreaProfilo />
          )
        }
      />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
