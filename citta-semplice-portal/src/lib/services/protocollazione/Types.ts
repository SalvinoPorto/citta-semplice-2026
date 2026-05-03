// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export interface ProtocolloInput {
    /** Può essere null quando il protocollo viene ottenuto prima della creazione dell'istanza */
    istanzaId: number | null;
    servizioTitolo: string;
    tipoProtocollo: string;       // 'E' = Entrata, 'U' = Uscita
    unitaOrganizzativa: string;
    utente: {
        codiceFiscale: string;
        nome: string;
        cognome: string;
    };
    files: File[];
}

export interface ProtocolloResult {
    numero: string;
    data: Date;
    fallback: boolean;
    /** ID del record ProtocolloEmergenza creato, presente solo quando fallback=true */
    emergenzaId?: number;
}