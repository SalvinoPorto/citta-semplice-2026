/**
 * Risoluzione del passo successivo/precedente dell'iter di una pratica, per
 * ordinamento e non per aritmetica su `ordine`.
 *
 * Un'istanza avanza da uno step al successivo dentro la stessa fase, e a
 * fine fase passa alla fase seguente (un altro ufficio). L'`ordine` di Step
 * e Fase non è garantito contiguo: uno step può essere disattivato, o
 * l'iter può essere riordinato dal backoffice, lasciando un buco nella
 * sequenza. Cercare `ordine === corrente + 1` fallisce in silenzio in quel
 * caso — il passo giusto è "il primo/ultimo con ordine maggiore/minore del
 * corrente", non "quello esattamente adiacente".
 *
 * Queste funzioni sono pure — non toccano il database — così da poter
 * essere testate senza gli effetti collaterali (auth, protocollazione,
 * pagamenti, transazioni) di `avanzaAttivita`/`retrocediAttivita` in
 * citta-semplice-office, che le usano per risolvere davvero la navigazione.
 * Vivono qui, non in citta-semplice-office, per lo stesso motivo di
 * `stato-istanza.ts`: sono logica di dominio su forme Prisma (Step, Fase),
 * non codice legato a Next.js/'use server'.
 */

export interface StepPerNavigazione {
  ordine: number;
  faseId: number | null;
  /** Assente = attivo. Gli step disattivati non sono mai un passo valido. */
  attivo?: boolean;
}

export interface FasePerNavigazione {
  ordine: number;
}

/**
 * Il primo step attivo della stessa fase con ordine maggiore del corrente.
 * `undefined` se non ce n'è uno: l'iter esce dalla fase.
 */
export function prossimoStepStessaFase<T extends StepPerNavigazione>(
  steps: T[],
  faseId: number | null | undefined,
  ordineCorrente: number,
): T | undefined {
  return steps
    .filter((s) => s.faseId === faseId && s.ordine > ordineCorrente && (s.attivo ?? true))
    .sort((a, b) => a.ordine - b.ordine)[0];
}

/**
 * La prima fase del servizio con ordine maggiore del corrente. `undefined`
 * se non ce n'è una: l'istanza ha esaurito l'iter.
 */
export function prossimaFase<T extends FasePerNavigazione>(
  fasi: T[],
  ordineCorrente: number,
): T | undefined {
  return fasi
    .filter((f) => f.ordine > ordineCorrente)
    .sort((a, b) => a.ordine - b.ordine)[0];
}

/**
 * L'ultimo step attivo della stessa fase con ordine minore del corrente.
 * `undefined` se siamo già al primo step attivo della fase.
 */
export function stepPrecedenteStessaFase<T extends StepPerNavigazione>(
  steps: T[],
  faseId: number | null | undefined,
  ordineCorrente: number,
): T | undefined {
  return steps
    .filter((s) => s.faseId === faseId && s.ordine < ordineCorrente && (s.attivo ?? true))
    .sort((a, b) => b.ordine - a.ordine)[0];
}

/**
 * L'ultima fase del servizio con ordine minore del corrente. `undefined`
 * se non ce n'è una: siamo già alla prima fase dell'iter.
 *
 * Simmetrica a `prossimaFase`, usata da `rollbackFase` ("Rimanda a fase
 * precedente"). La guardia a monte non deve presumere che gli ordini delle
 * fasi partano da 1 e siano contigui (`ordine <= 1`): la condizione vera è
 * "non esiste alcuna fase con ordine minore", cioè `fasePrecedente(...) ===
 * undefined`.
 */
export function fasePrecedente<T extends FasePerNavigazione>(
  fasi: T[],
  ordineCorrente: number,
): T | undefined {
  return fasi
    .filter((f) => f.ordine < ordineCorrente)
    .sort((a, b) => b.ordine - a.ordine)[0];
}
