/**
 * Urbismart Protocol Integration Service
 * Handles document registration and protocol number generation
 */

interface Corrispondente {
  cognome: string;
  nome: string;
  codiceFiscale: string;
}

interface ProtocolloResponse {
  success: boolean;
  numero?: string;
  dataProtocollo?: string;
  error?: string;
}

interface ProtocolloRequest {
  tipo: 'E' | 'U' | 'P'; // Entrata, Uscita, Interno
  oggetto: string;
  tipoMezzo: string;
  corrispondente: Corrispondente;
  unitaOrganizzativa: string;
  nomeFile: string;
  filePath: string;
  classificazione: string;
  mimeType?: string;
}

class UrbiSmartService {
  private baseUrl: string;
  private tipoMezzo: string;
  private classificazione: string;

  constructor() {
    this.baseUrl = process.env.URBISMART_URL || '';
    this.tipoMezzo = process.env.URBISMART_TIPO_MEZZO || 'PEC';
    this.classificazione = process.env.URBISMART_CLASSIFICAZIONE || 'V/5';
  }

  private isConfigured(): boolean {
    return !!this.baseUrl;
  }

  async registraProtocollo(request: ProtocolloRequest): Promise<ProtocolloResponse> {
    if (!this.isConfigured()) {
      console.warn('Urbismart not configured, using emergency protocol');
      return { success: false, error: 'Urbismart non configurato' };
    }

    try {
      // Read file and convert to base64
      const fs = await import('fs/promises');
      const fileBuffer = await fs.readFile(request.filePath);
      const fileBase64 = fileBuffer.toString('base64');

      const payload = {
        tipo: request.tipo,
        oggetto: request.oggetto,
        tipoMezzo: request.tipoMezzo || this.tipoMezzo,
        classificazione: request.classificazione || this.classificazione,
        corrispondente: {
          cognome: request.corrispondente.cognome,
          nome: request.corrispondente.nome,
          codiceFiscale: request.corrispondente.codiceFiscale,
        },
        unitaOrganizzativa: request.unitaOrganizzativa,
        allegato: {
          nome: request.nomeFile,
          contenuto: fileBase64,
          mimeType: request.mimeType || 'application/pdf',
        },
      };

      const response = await fetch(`${this.baseUrl}/api/protocollo`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      return {
        success: true,
        numero: data.numero,
        dataProtocollo: data.dataProtocollo,
      };
    } catch (error) {
      console.error('Errore registrazione protocollo Urbismart:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Errore sconosciuto',
      };
    }
  }

  async protocolloEntrata(
    oggetto: string,
    corrispondente: Corrispondente,
    unitaOrganizzativa: string,
    nomeFile: string,
    filePath: string
  ): Promise<ProtocolloResponse> {
    return this.registraProtocollo({
      tipo: 'E',
      oggetto,
      tipoMezzo: this.tipoMezzo,
      corrispondente,
      unitaOrganizzativa,
      nomeFile,
      filePath,
      classificazione: this.classificazione,
    });
  }

  async protocolloUscita(
    oggetto: string,
    corrispondente: Corrispondente,
    unitaOrganizzativa: string,
    nomeFile: string,
    filePath: string
  ): Promise<ProtocolloResponse> {
    return this.registraProtocollo({
      tipo: 'U',
      oggetto,
      tipoMezzo: this.tipoMezzo,
      corrispondente,
      unitaOrganizzativa,
      nomeFile,
      filePath,
      classificazione: this.classificazione,
    });
  }
}

export const urbiSmartService = new UrbiSmartService();
export type { Corrispondente, ProtocolloResponse, ProtocolloRequest };
