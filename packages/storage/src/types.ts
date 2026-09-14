/**
 * Contratto di storage per gli allegati (PDF di istanze, risposte, moduli e
 * ricevute generate).
 *
 * Il percorso relativo è la stessa stringa persistita in `allegati.nome_hash` e
 * `allegati_risposta.nome_hash` — formato `YYYY/MM/DD/<uuid>` — quindi il
 * passaggio da filesystem a object storage NON richiede di riscrivere i valori
 * in database: cambia solo dove i byte vivono.
 */
export interface StorageProvider {
  /**
   * `contentType` è opzionale perché il filesystem non lo usa: serve solo a
   * S3, che altrimenti marcherebbe ogni oggetto come binario generico. In
   * download il Content-Type della risposta HTTP viene comunque preso dal
   * `mimeType` in database, non dai metadati dell'oggetto.
   */
  save(percorsoRelativo: string, dati: Buffer, contentType?: string): Promise<void>;
  /**
   * Solleva un errore se l'oggetto non esiste: i chiamanti usano il catch per i
   * fallback.
   *
   * Il tipo è `Buffer<ArrayBuffer>`, non il più ampio `Buffer`
   * (= `Buffer<ArrayBufferLike>`): quest'ultimo comprende `SharedArrayBuffer` e
   * quindi non è assegnabile a `BodyInit`, rompendo i `new NextResponse(buffer)`
   * delle route di download. Entrambi i provider restituiscono comunque buffer
   * non condivisi, quindi il tipo ristretto è anche quello corretto.
   */
  read(percorsoRelativo: string): Promise<Buffer<ArrayBuffer>>;
}
