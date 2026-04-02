'use client';

interface AllegatoComunicazione {
  nome: string;
  obbligatorio: boolean;
}

interface Comunicazione {
  id: number;
  testo: string;
  richiedeRisposta: boolean;
  allegatiRichiesti: string | null;
  dataCreazione: Date;
  operatore: { nome: string; cognome: string } | null;
  risposta: {
    id: number;
    testo: string | null;
    createdAt: Date;
    allegati: { id: number; nomeFile: string }[];
  } | null;
}

interface ComunicazioniTimelineProps {
  comunicazioni: Comunicazione[];
}

function formatDateTime(date: Date) {
  return new Date(date).toLocaleString('it-IT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function ComunicazioniTimeline({ comunicazioni }: ComunicazioniTimelineProps) {
  if (comunicazioni.length === 0) {
    return <p className="text-muted small">Nessuna comunicazione</p>;
  }

  return (
    <div className="d-flex flex-column gap-3">
      {comunicazioni.map((com) => {
        const allegatiRichiesti: AllegatoComunicazione[] = com.allegatiRichiesti
          ? JSON.parse(com.allegatiRichiesti)
          : [];
        const attesaRisposta = com.richiedeRisposta && !com.risposta;

        return (
          <div key={com.id}>
            {/* Comunicazione */}
            <div
              className={`p-2 rounded border small ${attesaRisposta ? 'border-warning' : 'border-info'}`}
              style={{ backgroundColor: attesaRisposta ? 'rgba(255,193,7,0.07)' : 'rgba(13,202,240,0.07)' }}
            >
              <div className="d-flex gap-1 flex-wrap mb-1">
                <span className="badge bg-info text-dark">Comunicazione</span>
                {com.richiedeRisposta && (
                  com.risposta
                    ? <span className="badge bg-success">Risposta ricevuta</span>
                    : <span className="badge bg-warning text-dark">In attesa di risposta</span>
                )}
                {allegatiRichiesti.length > 0 && (
                  <span className="badge bg-secondary">
                    {allegatiRichiesti.length} allegato{allegatiRichiesti.length > 1 ? 'i richiesti' : ' richiesto'}
                  </span>
                )}
              </div>
              <p className="mb-1">{com.testo}</p>
              {allegatiRichiesti.length > 0 && (
                <ul className="mb-1 ps-3">
                  {allegatiRichiesti.map((a, i) => (
                    <li key={i}>
                      {a.nome}
                      {a.obbligatorio && (
                        <span className="badge bg-danger ms-1" style={{ fontSize: '0.65em' }}>Obbligatorio</span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
              <div className="text-muted mt-1" style={{ fontSize: '0.8em' }}>
                {formatDateTime(com.dataCreazione)}
                {com.operatore && (
                  <span className="ms-1">— {com.operatore.cognome} {com.operatore.nome}</span>
                )}
              </div>
            </div>

            {/* Risposta del cittadino */}
            {com.risposta && (
              <div
                className="mt-1 p-2 rounded border border-success small"
                style={{ backgroundColor: 'rgba(25,135,84,0.06)' }}
              >
                <div className="d-flex gap-1 flex-wrap mb-1">
                  <span className="badge bg-success">Risposta cittadino</span>
                  <span className="text-muted" style={{ fontSize: '0.8em' }}>
                    {formatDateTime(com.risposta.createdAt)}
                  </span>
                </div>
                {com.risposta.testo && <p className="mb-1">{com.risposta.testo}</p>}
                {com.risposta.allegati.length > 0 && (
                  <ul className="list-unstyled mb-0">
                    {com.risposta.allegati.map((a) => (
                      <li key={a.id}>
                        <a
                          href={`/api/risposta-allegati/${a.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          📎 {a.nomeFile}
                        </a>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
