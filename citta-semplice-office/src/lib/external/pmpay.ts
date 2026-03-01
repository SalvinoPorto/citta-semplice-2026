/**
 * PMPay Payment Integration Service
 * Handles PagoPA payment gateway operations
 */

interface PaymentStatus {
  iuv: string;
  stato: 'PENDING' | 'PAID' | 'FAILED' | 'CANCELLED';
  importo: number;
  dataOperazione?: string;
  dataRicevuta?: string;
}

interface CreatePaymentRequest {
  importo: number;
  causale: string;
  codiceTributo: string;
  codiceFiscale: string;
  nome: string;
  cognome: string;
  email?: string;
}

interface CreatePaymentResponse {
  success: boolean;
  iuv?: string;
  urlPagamento?: string;
  error?: string;
}

interface ReceiptResponse {
  success: boolean;
  pdfBase64?: string;
  error?: string;
}

class PMPayService {
  private baseUrl: string;
  private apiKey: string;
  private enteId: string;

  constructor() {
    this.baseUrl = process.env.PMPAY_URL || '';
    this.apiKey = process.env.PMPAY_API_KEY || '';
    this.enteId = process.env.PMPAY_ENTE_ID || '';
  }

  private isConfigured(): boolean {
    return !!(this.baseUrl && this.apiKey && this.enteId);
  }

  private getHeaders(): HeadersInit {
    return {
      'Content-Type': 'application/json',
      'X-API-Key': this.apiKey,
      'X-Ente-Id': this.enteId,
    };
  }

  async createPayment(request: CreatePaymentRequest): Promise<CreatePaymentResponse> {
    if (!this.isConfigured()) {
      console.warn('PMPay not configured');
      return { success: false, error: 'PMPay non configurato' };
    }

    try {
      const payload = {
        importo: request.importo,
        causale: request.causale.substring(0, 60), // Max 60 chars
        codiceTributo: request.codiceTributo,
        debitore: {
          codiceFiscale: request.codiceFiscale,
          nome: request.nome,
          cognome: request.cognome,
          email: request.email,
        },
      };

      const response = await fetch(`${this.baseUrl}/api/pagamenti`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      return {
        success: true,
        iuv: data.iuv,
        urlPagamento: data.urlPagamento,
      };
    } catch (error) {
      console.error('Errore creazione pagamento PMPay:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Errore sconosciuto',
      };
    }
  }

  async getPaymentStatus(iuv: string): Promise<PaymentStatus | null> {
    if (!this.isConfigured()) {
      return null;
    }

    try {
      const response = await fetch(`${this.baseUrl}/api/pagamenti/${iuv}/stato`, {
        method: 'GET',
        headers: this.getHeaders(),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();

      return {
        iuv: data.iuv,
        stato: data.stato,
        importo: data.importo,
        dataOperazione: data.dataOperazione,
        dataRicevuta: data.dataRicevuta,
      };
    } catch (error) {
      console.error('Errore verifica stato pagamento:', error);
      return null;
    }
  }

  async getReceipt(iuv: string): Promise<ReceiptResponse> {
    if (!this.isConfigured()) {
      return { success: false, error: 'PMPay non configurato' };
    }

    try {
      const response = await fetch(`${this.baseUrl}/api/pagamenti/${iuv}/ricevuta`, {
        method: 'GET',
        headers: this.getHeaders(),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();

      return {
        success: true,
        pdfBase64: data.ricevuta,
      };
    } catch (error) {
      console.error('Errore download ricevuta:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Errore sconosciuto',
      };
    }
  }

  async syncPendingPayments(): Promise<{ synced: number; errors: number }> {
    // This method is called by the cron job to sync payment statuses
    const prisma = (await import('@/lib/db/prisma')).default;

    let synced = 0;
    let errors = 0;

    try {
      // Find all pending payments
      const pendingPayments = await prisma.pagamentoEffettuato.findMany({
        where: {
          stato: 'PENDING',
          iuv: { not: null },
        },
      });

      for (const payment of pendingPayments) {
        if (!payment.iuv) continue;

        try {
          const status = await this.getPaymentStatus(payment.iuv);
          if (status && status.stato !== 'PENDING') {
            await prisma.pagamentoEffettuato.update({
              where: { id: payment.id },
              data: {
                stato: status.stato,
                dataOperazione: status.dataOperazione
                  ? new Date(status.dataOperazione)
                  : null,
                dataRicevuta: status.dataRicevuta
                  ? new Date(status.dataRicevuta)
                  : null,
              },
            });
            synced++;
          }
        } catch {
          errors++;
        }
      }
    } catch (error) {
      console.error('Errore sync pagamenti:', error);
    }

    return { synced, errors };
  }
}

export const pmPayService = new PMPayService();
export type { PaymentStatus, CreatePaymentRequest, CreatePaymentResponse, ReceiptResponse };
