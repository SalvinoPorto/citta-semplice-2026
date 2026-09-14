/**
 * Rappresentazione leggibile del valore di un campo di modulo.
 *
 * Viveva in `citta-semplice-portal/src/lib/utils.ts`, ed era l'unica
 * esportazione di quel file. È stata spostata qui quando la generazione dei PDF
 * è diventata un package condiviso (`@citta/documenti`): lasciandola nel portal,
 * quel package avrebbe dovuto importare da un alias `@/` di una delle due app —
 * e incorporarne una copia avrebbe creato due definizioni della stessa regola,
 * con i tre punti d'uso liberi di divergere.
 *
 * Sta in `form-schema` perché formatta i valori dei campi del modulo, e questo è
 * il package che descrive quei campi: sia il portale sia `@citta/documenti` ne
 * dipendono già, quindi non nasce alcun nuovo arco di dipendenza.
 */
export function getCampoValue(campo: string) {
  if (campo === 'true') return 'Si';
  if (campo === 'false') return 'No';
  if (campo) return campo;
  return '-';
}
