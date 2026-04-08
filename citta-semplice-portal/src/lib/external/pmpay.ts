/**
 * PMPay - client minimale per il portale cittadino.
 * Gestisce solo le operazioni di lettura (bollettino, ricevuta, URL pagamento).
 */

interface AuthToken {
  token: string;
  expiresAt: Date;
}

class PMPayPortalService {
  private baseUrl: string;
  private username: string;
  private password: string;
  readonly enteId: string;
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

  isConfigured(): boolean {
    return !!(this.baseUrl && this.username && this.password && this.enteId);
  }

  private isTokenValid(): boolean {
    if (!this.cachedToken) return false;
    return new Date(this.cachedToken.expiresAt.getTime() - 60_000) > new Date();
  }

  private async authenticate(): Promise<string> {
    if (this.isTokenValid()) return this.cachedToken!.token;

    const res = await this.request('/autenticazione', {
      method: 'POST',
      body: JSON.stringify({ username: this.username, password: this.password }),
      skipAuth: true,
    });
    const data = await res.json() as { token: string; expiration: string };
    this.cachedToken = { token: data.token, expiresAt: new Date(data.expiration) };
    return data.token;
  }

  private async request(
    path: string,
    opts: RequestInit & { skipAuth?: boolean } = {}
  ): Promise<Response> {
    const { skipAuth, ...fetchOpts } = opts;
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (!skipAuth) {
      headers['Authorization'] = `Bearer ${await this.authenticate()}`;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      return await fetch(`${this.baseUrl}${path}`, {
        ...fetchOpts,
        headers: { ...headers, ...(fetchOpts.headers ?? {}) },
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }
  }

  /** Scarica il PDF del bollettino per il dato IUV. */
  async getBollettino(iuv: string): Promise<{ success: boolean; pdfBuffer?: Buffer; error?: string }> {
    if (!this.isConfigured()) return { success: false, error: 'PMPay non configurato' };
    try {
      const res = await this.request(`/ente/${this.enteId}/pagamento/${iuv}/bollettino`);
      if (!res.ok) return { success: false, error: `HTTP ${res.status}` };
      const ab = await res.arrayBuffer();
      return { success: true, pdfBuffer: Buffer.from(ab) };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Errore' };
    }
  }

  /** Scarica la ricevuta telematica per il dato IUV. */
  async getRicevuta(iuv: string): Promise<{ success: boolean; pdfBuffer?: Buffer; error?: string }> {
    if (!this.isConfigured()) return { success: false, error: 'PMPay non configurato' };
    try {
      const res = await this.request(`/ente/${this.enteId}/pagamento/${iuv}/ricevutatelematica`);
      if (!res.ok) return { success: false, error: `HTTP ${res.status}` };
      const ab = await res.arrayBuffer();
      return { success: true, pdfBuffer: Buffer.from(ab) };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Errore' };
    }
  }

  /** Restituisce l'URL per il pagamento online del dato IUV. */
  async getUrlPagamento(
    iuv: string,
    idRichiesta: string
  ): Promise<{ success: boolean; location?: string; error?: string }> {
    if (!this.isConfigured()) return { success: false, error: 'PMPay non configurato' };
    try {
      const base = process.env.NEXTAUTH_URL || '';
      const payload = {
        urlOk: this.urlOk || `${base}/pagamento/ok`,
        urlKo: this.urlKo || `${base}/pagamento/ko`,
        urlCancel: this.urlCancel || `${base}/pagamento/annullato`,
        idRichiesta,
      };
      const res = await this.request(`/ente/${this.enteId}/pagamento/${iuv}/urlpagamento`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      if (!res.ok) return { success: false, error: `HTTP ${res.status}` };
      const data = await res.json() as { location?: string };
      return { success: true, location: data.location };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Errore' };
    }
  }
}

export const pmPayService = new PMPayPortalService();
