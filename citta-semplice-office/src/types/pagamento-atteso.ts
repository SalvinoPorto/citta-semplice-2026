export interface PagamentoAtteso {
  iuv: string | null;
  numeroDocumento: string | null;
  importoTotale: number;
  stato: string | null;
  dataEmissione: Date | null;
  dataScadenza: Date | null;
  dataOperazione: Date | null;
  dataRicevuta: Date | null;
  paganteCodiceFiscale: string | null;
  pagante: string | null;
  paganteEmail: string | null;
  causale: string | null;   
}
