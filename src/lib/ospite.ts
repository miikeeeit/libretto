// Chi apre «Come funziona» o l'informativa da un link di conferma o da un profilo
// pubblico è un responsabile o un datore: non è qui per farsi un account, e la
// specifica gli account per loro li esclude (§2). Da lì le pagine informative non
// mostrano la strada per registrarsi, solo quella per tornare indietro.

import { useSearchParams } from 'react-router-dom';

/** Da aggiungere ai link verso le pagine informative, dalle pagine degli ospiti. */
export const DA_OSPITE = 'da=ospite';

export function useOspite(): boolean {
  const [parametri] = useSearchParams();
  return parametri.get('da') === 'ospite';
}
