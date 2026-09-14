/**
 * Normalizzazione delle chiavi di storage, condivisa dai due provider.
 *
 * Filesystem e S3 devono interpretare `nomeHash` nello stesso modo, altrimenti
 * un file scritto con un provider non si rileggerebbe con l'altro durante la
 * migrazione. E nessuno dei due deve poter uscire dalla propria radice:
 * `join(baseDir, '../../etc/passwd')` sul provider locale esce da `baseDir`.
 * I valori arrivano dal database (li scriviamo noi), ma il controllo qui costa
 * nulla ed è l'unico punto in cui va fatto.
 */
export function normalizzaChiave(percorsoRelativo: string): string {
  if (typeof percorsoRelativo !== 'string' || percorsoRelativo.trim() === '') {
    throw new Error('Chiave di storage vuota');
  }
  if (percorsoRelativo.includes('\0')) {
    throw new Error('Chiave di storage con byte NUL');
  }

  // I `nomeHash` storici sono stati costruiti con `path.join`: su Linux usano
  // già lo slash, ma normalizziamo i backslash per non dipendere dal sistema
  // su cui il valore è stato generato.
  const segmenti = percorsoRelativo
    .replace(/\\/g, '/')
    .split('/')
    .filter((segmento) => segmento.length > 0);

  if (segmenti.length === 0) {
    throw new Error(`Chiave di storage non valida: "${percorsoRelativo}"`);
  }
  for (const segmento of segmenti) {
    if (segmento === '.' || segmento === '..') {
      throw new Error(`Chiave di storage non valida: "${percorsoRelativo}"`);
    }
  }

  return segmenti.join('/');
}
