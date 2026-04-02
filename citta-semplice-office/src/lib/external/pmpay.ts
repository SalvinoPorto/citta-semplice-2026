/**
 * PMPay Payment Integration Service
 * Handles PagoPA payment gateway operations via PmPay cloud service.
 *
 * Reference: PMPAY 1.21 Postman Collection + api-pmpay.yaml
 * Base URL: https://service.pmpay.it/pagoparest (test) | https://secure.pmpay.it/pagoparest (prod)
 * Auth: POST /autenticazione → Bearer token
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PmPayServizio {
  codiceServizio: string;
  descrizione?: string;
  tassonomia?: string;
}

export interface CreatePaymentRequest {
  documento: string;
  dataInizioValidita: string;
  dataScadenza: string;
  importo: number;
  causale: string;
  codiceTributo: string;
  codiceFiscale: string;
  nome: string;
  cognome: string;
  email?: string;
}

export interface CreatePaymentResponse {
  success: boolean;
  iuv?: string;
  numeroAvviso?: string;
  statoPagamento?: string;
  error?: string;
}

export interface GetUrlPagamentoResponse {
  success: boolean;
  location?: string;
  error?: string;
}

export interface GetBollettinoResponse {
  success: boolean;
  pdfBuffer?: Buffer;
  error?: string;
}

export interface PaymentDetail {
  iuv: string;
  statoPagamento: string; // DAD | ATT | NCO | CON | RAT
  importo?: string;
  dataOperazione?: string;
  numeroAvviso?: string;
}

export interface GetPaymentDetailResponse {
  success: boolean;
  detail?: PaymentDetail;
  error?: string;
}

export interface ReceiptResponse {
  success: boolean;
  iuv?: string;
  tipo?: string;         // RT | RECEIPT | RECEIPT_V2
  receiptBase64?: string;
  error?: string;
}

// ─── Internal types ────────────────────────────────────────────────────────────

interface AuthToken {
  token: string;
  expiresAt: Date;
}

// ─── Service ──────────────────────────────────────────────────────────────────

class PMPayService {
  private baseUrl: string;
  private username: string;
  private password: string;
  private enteId: string;
  private urlOk: string;
  private urlKo: string;
  private urlCancel: string;
  private timeoutMs: number;

  private cachedToken: AuthToken | null = null;

  constructor() {
    this.baseUrl = (process.env.PMPAY_URL || '').replace(/\/$/, '');
    this.username = process.env.PMPAY_USERNAME || '';
    this.password = process.env.PMPAY_PASSWORD || '';
    this.enteId = process.env.PMPAY_ENTE_ID || '';
    this.urlOk = process.env.PMPAY_URL_OK || '';
    this.urlKo = process.env.PMPAY_URL_KO || '';
    this.urlCancel = process.env.PMPAY_URL_CANCEL || '';
    this.timeoutMs = parseInt(process.env.PMPAY_TIMEOUT_MS || '30000', 10);
  }

  private isConfigured(): boolean {
    return !!(this.baseUrl && this.username && this.password && this.enteId);
  }

  private isTokenValid(): boolean {
    if (!this.cachedToken) return false;
    // Refresh 60 seconds before expiry
    return new Date(this.cachedToken.expiresAt.getTime() - 60_000) > new Date();
  }

  private async authenticate(): Promise<string> {
    if (this.isTokenValid()) {
      return this.cachedToken!.token;
    }

    const res = await this.request('/autenticazione', {
      method: 'POST',
      body: JSON.stringify({ username: this.username, password: this.password }),
      skipAuth: true,
    });

    const data = await res.json() as { token: string; expiration: string };
    this.cachedToken = {
      token: data.token,
      expiresAt: new Date(data.expiration),
    };
    return data.token;
  }

  private async request(
    path: string,
    opts: RequestInit & { skipAuth?: boolean; binary?: boolean } = {}
  ): Promise<Response> {
    const { skipAuth, binary: _binary, ...fetchOpts } = opts;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (!skipAuth) {
      const token = await this.authenticate();
      headers['Authorization'] = `Bearer ${token}`;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const res = await fetch(`${this.baseUrl}${path}`, {
        ...fetchOpts,
        headers: { ...headers, ...(fetchOpts.headers ?? {}) },
        signal: controller.signal,
      });
      return res;
    } finally {
      clearTimeout(timer);
    }
  }

  // ─── Public API ──────────────────────────────────────────────────────────────

  /**
   * Returns the list of PmPay services (tributi) configured for the ente.
   * Meant to be called once at page load to populate the payment step dropdown.
   */
  async getServizi(): Promise<PmPayServizio[]> {
    if (!this.isConfigured()) {
      console.warn('[PmPay] Not configured — returning empty service list');
      return [];
    }

    try {
      const res = await this.request(`/ente/${this.enteId}/servizio`);
      if (!res.ok) {
        console.error(`[PmPay] getServizi HTTP ${res.status}`);
        return [];
      }
      const data = await res.json() as PmPayServizio[];
      return Array.isArray(data) ? data : [];
    } catch (err) {
      console.error('[PmPay] getServizi error:', err);
      return [];
    }
  }

  /**
   * Creates a new payment and returns the IUV and notice number.
   */
  async createPayment(req: CreatePaymentRequest): Promise<CreatePaymentResponse> {
    if (!this.isConfigured()) {
      return { success: false, error: 'PMPay non configurato' };
    }

    try {
      const payload = {
        idDebito: req.documento,
        dataInizioValidita: req.dataInizioValidita,
        dataScadenza: req.dataScadenza,
        idFiscaleDebitore: req.codiceFiscale,
        anagrafica: {
          codiceEnte: this.enteId,
          idFiscale: { tipo: 'F', codice: req.codiceFiscale },
          anagrafica: `${req.cognome} ${req.nome}`.trim()
        },
        versamenti: [
          {
            importo: req.importo.toFixed(2),
            causale: req.causale.substring(0, 255),
            servizio: req.codiceTributo,
          },
        ],
      };

      const res = await this.request(`/ente/${this.enteId}/pagamento`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const body = await res.text();
        console.error(`[PmPay] createPayment HTTP ${res.status}:`, body);
        return { success: false, error: `Errore PmPay: ${res.status}` };
      }

      const data = await res.json() as { code?: string };
      return {
        success: true,
        iuv: data.code,
      };
    } catch (err) {
      console.error('[PmPay] createPayment error:', err);
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Errore sconosciuto',
      };
    }
  }

  /**
   * Downloads the bollettino PDF for a given IUV.
   */
  async getBollettino(iuv: string): Promise<GetBollettinoResponse> {
    if (!this.isConfigured()) {
      return { success: false, error: 'PMPay non configurato' };
    }

    try {
      const res = await this.request(`/ente/${this.enteId}/pagamento/${iuv}/bollettino`);
      if (!res.ok) {
        console.error(`[PmPay] getBollettino HTTP ${res.status}`);
        return { success: false, error: `Bollettino non disponibile: ${res.status}` };
      }
      const arrayBuffer = await res.arrayBuffer();
      return { success: true, pdfBuffer: Buffer.from(arrayBuffer) };
    } catch (err) {
      console.error('[PmPay] getBollettino error:', err);
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Errore sconosciuto',
      };
    }
  }

  /**
   * Gets the online payment URL for a given IUV.
   */
  async getUrlPagamento(iuv: string, idRichiesta: string): Promise<GetUrlPagamentoResponse> {
    if (!this.isConfigured()) {
      return { success: false, error: 'PMPay non configurato' };
    }

    try {
      const payload = {
        urlOk: this.urlOk || `${process.env.NEXTAUTH_URL}/pagamento/ok`,
        urlKo: this.urlKo || `${process.env.NEXTAUTH_URL}/pagamento/ko`,
        urlCancel: this.urlCancel || `${process.env.NEXTAUTH_URL}/pagamento/annullato`,
        idRichiesta,
      };

      const res = await this.request(`/ente/${this.enteId}/pagamento/${iuv}/urlpagamento`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        console.error(`[PmPay] getUrlPagamento HTTP ${res.status}`);
        return { success: false, error: `URL pagamento non disponibile: ${res.status}` };
      }

      const data = await res.json() as { location?: string };
      return { success: true, location: data.location };
    } catch (err) {
      console.error('[PmPay] getUrlPagamento error:', err);
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Errore sconosciuto',
      };
    }
  }

  /**
   * Gets payment details including current statoPagamento.
   * Used by the cron job to update pending payment statuses.
   */
  async getPaymentDetail(iuv: string): Promise<GetPaymentDetailResponse> {
    if (!this.isConfigured()) {
      return { success: false, error: 'PMPay non configurato' };
    }

    try {
      const res = await this.request(`/ente/${this.enteId}/pagamento/${iuv}`);
      if (!res.ok) {
        return { success: false, error: `HTTP ${res.status}` };
      }
      const data = await res.json() as PaymentDetail;
      return { success: true, detail: data };
    } catch (err) {
      console.error('[PmPay] getPaymentDetail error:', err);
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Errore sconosciuto',
      };
    }
  }

  /**
   * Gets the receipt (ricevuta) for a confirmed payment.
   */
  async getReceipt(iuv: string): Promise<ReceiptResponse> {
    if (!this.isConfigured()) {
      return { success: false, error: 'PMPay non configurato' };
    }

    try {
      const res = await this.request(`/ente/${this.enteId}/receipt/${iuv}`);
      if (!res.ok) {
        return { success: false, error: `HTTP ${res.status}` };
      }
      const data = await res.json() as { iuv?: string; tipo?: string; receiptBase64?: string };
      return {
        success: true,
        iuv: data.iuv,
        tipo: data.tipo,
        receiptBase64: data.receiptBase64,
      };
    } catch (err) {
      console.error('[PmPay] getReceipt error:', err);
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Errore sconosciuto',
      };
    }
  }

  /**
   * Called by the cron job to sync payment statuses.
   * Queries PmPay for all pending payments and updates DB.
   * Equivalent query: SELECT * FROM pagamenti_effettuati WHERE iuv IS NOT NULL AND stato NOT IN ('CONFERMATO','FALLITO')
   */
  async syncPendingPayments(): Promise<{ synced: number; errors: number }> {
    const prisma = (await import('@/lib/db/prisma')).default;

    let synced = 0;
    let errors = 0;

    try {
      const pendingPayments = await prisma.pagamentoAtteso.findMany({
        where: {
          iuv: { not: null },
          stato: { notIn: ['CON', 'NCO'] },
        },
      });

      for (const payment of pendingPayments) {
        if (!payment.iuv) continue;

        try {
          const result = await this.getPaymentDetail(payment.iuv);
          if (!result.success || !result.detail) {
            errors++;
            continue;
          }

          const nuovoStato = result.detail.statoPagamento;

          if (nuovoStato !== payment.stato) {
            await prisma.pagamentoAtteso.update({
              where: { id: payment.id },
              data: {
                stato: nuovoStato,
                ...(result.detail.dataOperazione
                  ? { dataOperazione: new Date(result.detail.dataOperazione) }
                  : {}),
              },
            });
            synced++;
          }
        } catch {
          errors++;
        }
      }
    } catch (err) {
      console.error('[PmPay] syncPendingPayments error:', err);
    }

    return { synced, errors };
  }
}

export const pmPayService = new PMPayService();
