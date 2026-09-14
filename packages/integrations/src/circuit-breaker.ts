/**
 * Circuit breaker: smette di bussare a un servizio esterno che non risponde.
 *
 * PERCHÉ SERVE QUI
 *   Durante un picco imprevisto, o un guasto del protocollo, ogni invio
 *   attenderebbe il timeout di Urbi (fino a 30 s) prima di ripiegare sulla
 *   numerazione interna. Con N invii simultanei significa N worker Node appesi,
 *   e una pressione che tiene Urbi a terra proprio mentre prova a rialzarsi.
 *   Dopo qualche fallimento consecutivo il breaker apre: gli invii smettono di
 *   tentare e passano direttamente alla via asincrona, che è comunque completa
 *   (numero interno subito, rettifica dal cron).
 *
 *   È la controparte automatica del flag `servizi.protocollazione_asincrona`:
 *   quello copre i picchi PIANIFICATI, questo quelli imprevisti e i guasti.
 *
 * LIMITE DA CONOSCERE
 *   Lo stato vive in memoria di PROCESSO. Con più replica ciascuna impara per
 *   conto suo, quindi la protezione si attiva in modo scaglionato invece che
 *   istantaneo. Renderlo condiviso richiederebbe stato in database e un altro
 *   giro di schema: non è stato fatto perché la rete di sicurezza esiste già —
 *   il drenatore recupera comunque ogni istanza — e il flag copre i casi
 *   previsti. Se un domani servisse, il punto da cambiare è solo questa classe.
 *
 * L'orologio è iniettabile perché il comportamento che conta è temporale, e un
 * test che dipende dal tempo reale o non prova nulla o è lento e ballerino.
 */

export type StatoBreaker =
  /** Passa tutto: il servizio risponde. */
  | 'chiuso'
  /** Blocca: troppi fallimenti di fila, si aspetta il raffreddamento. */
  | 'aperto'
  /** Raffreddamento scaduto: si concede un tentativo di prova. */
  | 'semiaperto';

export type OpzioniBreaker = {
  /** Fallimenti consecutivi che fanno aprire il circuito. */
  soglia?: number;
  /** Quanto resta aperto prima di concedere un tentativo di prova. */
  raffreddamentoMs?: number;
  /** Sorgente del tempo, sostituibile nei test. */
  adesso?: () => number;
};

export class CircuitBreaker {
  private fallimentiConsecutivi = 0;
  private apertoFino = 0;

  private readonly soglia: number;
  private readonly raffreddamentoMs: number;
  private readonly adesso: () => number;

  constructor(opzioni: OpzioniBreaker = {}) {
    this.soglia = opzioni.soglia ?? 5;
    this.raffreddamentoMs = opzioni.raffreddamentoMs ?? 60_000;
    this.adesso = opzioni.adesso ?? Date.now;
  }

  stato(): StatoBreaker {
    if (this.apertoFino === 0) return 'chiuso';
    return this.adesso() < this.apertoFino ? 'aperto' : 'semiaperto';
  }

  /** `false` solo mentre il circuito è aperto: in semiaperto si concede la prova. */
  consentito(): boolean {
    return this.stato() !== 'aperto';
  }

  registraSuccesso(): void {
    this.fallimentiConsecutivi = 0;
    this.apertoFino = 0;
  }

  /**
   * Il contatore NON viene azzerato all'apertura di proposito: così, in stato
   * semiaperto, è già oltre soglia e un solo fallimento della prova richiude
   * subito il circuito, invece di concederne altri `soglia` a un servizio che
   * ha appena dimostrato di non essersi ripreso.
   */
  registraFallimento(): void {
    this.fallimentiConsecutivi++;
    if (this.fallimentiConsecutivi >= this.soglia) {
      this.apertoFino = this.adesso() + this.raffreddamentoMs;
    }
  }
}
