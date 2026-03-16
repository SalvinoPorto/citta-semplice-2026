'use client';

interface AllegatoComunicazione {
  nome: string;
  obbligatorio: boolean;
}

interface Workflow {
  id: number;
  note: string | null;
  dataVariazione: Date;
  status: {
    stato: string;
    icon: string | null;
  };
  step: {
    id: number;
    descrizione: string;
    ordine: number;
  } | null;
  notifica: {
    descrizione: string;
  } | null;
  operatore: {
    nome: string;
    cognome: string;
  } | null;
  comunicazione: {
    testo: string;
    richiedeRisposta: boolean;
    allegatiRichiesti: string | null;
  } | null;
}

interface Step {
  id: number;
  descrizione: string;
  ordine: number;
}

interface WorkflowTimelineProps {
  workflows: Workflow[];
  steps: Step[];
}

type EntryType = 'communication' | 'retrocession' | 'event';

function getEntryType(wf: Workflow): EntryType {
  if (wf.comunicazione) return 'communication';
  if (wf.note?.startsWith('[Comunicazione]')) return 'communication';
  if (wf.note?.startsWith('[Retrocessione')) return 'retrocession';
  return 'event';
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

export function WorkflowTimeline({ workflows, steps }: WorkflowTimelineProps) {
  const getStatusClass = (status: string) => {
    const lowerStatus = status.toLowerCase();
    if (lowerStatus.includes('success') || lowerStatus.includes('conclus')) {
      return 'completed';
    }
    if (lowerStatus.includes('respin') || lowerStatus.includes('rifiut')) {
      return 'rejected';
    }
    if (lowerStatus.includes('elabor') || lowerStatus.includes('attesa')) {
      return 'pending';
    }
    return '';
  };

  if (workflows.length === 0) {
    return <p className="text-muted">Nessun workflow disponibile</p>;
  }

  // Sort oldest-first for display
  const sorted = [...workflows].sort(
    (a, b) => new Date(a.dataVariazione).getTime() - new Date(b.dataVariazione).getTime()
  );

  // Group events by step ordine
  const eventsByOrdine = new Map<number, Workflow[]>();
  for (const wf of sorted) {
    const key = wf.step?.ordine ?? 0;
    if (!eventsByOrdine.has(key)) eventsByOrdine.set(key, []);
    eventsByOrdine.get(key)!.push(wf);
  }

  // Determine step visual status from its latest event
  function stepStatus(ordine: number) {
    const events = eventsByOrdine.get(ordine);
    if (!events || events.length === 0) return '';
    return getStatusClass(events[events.length - 1].status.stato);
  }

  return (
    <div className="timeline">
      {steps.map((step) => {
        const status = stepStatus(step.ordine);
        const events = eventsByOrdine.get(step.ordine) ?? [];
        const reached = events.length > 0;

        return (
          <div key={step.id} className={`timeline-item ${status} ${!reached ? 'opacity-50' : ''}`}>
            {/* Step header */}
            <div className="d-flex justify-content-between align-items-start mb-1">
              <strong>{step.ordine}. {step.descrizione}</strong>
              {reached && events[events.length - 1] && (
                <small className="text-muted">
                  {new Date(events[events.length - 1].dataVariazione).toLocaleDateString('it-IT')}
                </small>
              )}
            </div>
            {reached && (
              <div className="mb-1">
                <span className={`badge ${
                  status === 'completed' ? 'bg-success' :
                  status === 'rejected'  ? 'bg-danger' :
                  status === 'pending'   ? 'bg-warning text-dark' : 'bg-secondary'
                }`}>
                  {events[events.length - 1].status.stato}
                </span>
              </div>
            )}

            {/* Events under this step */}
            {events.map((wf) => {
              const type = getEntryType(wf);

              if (type === 'communication') {
                const com = wf.comunicazione;
                const legacyText = com ? null : (wf.note ?? '').replace(/^\[Comunicazione\]\s*/, '');
                const allegati: AllegatoComunicazione[] = com?.allegatiRichiesti
                  ? JSON.parse(com.allegatiRichiesti)
                  : [];
                return (
                  <div key={wf.id} className="mt-2 p-2 rounded border border-info small"
                       style={{ backgroundColor: 'rgba(13,202,240,0.07)' }}>
                    <div className="d-flex gap-1 flex-wrap mb-1">
                      <span className="badge bg-info text-dark">Comunicazione</span>
                      {com?.richiedeRisposta && (
                        <span className="badge bg-warning text-dark">Richiede risposta</span>
                      )}
                      {allegati.length > 0 && (
                        <span className="badge bg-secondary">
                          {allegati.length} allegato{allegati.length > 1 ? 'i richiesti' : ' richiesto'}
                        </span>
                      )}
                    </div>
                    <p className="mb-1">{com ? com.testo : legacyText}</p>
                    {allegati.length > 0 && (
                      <ul className="mb-1 ps-3">
                        {allegati.map((a, i) => (
                          <li key={i}>
                            {a.nome}
                            {a.obbligatorio && (
                              <span className="badge bg-danger ms-1" style={{ fontSize: '0.65em' }}>
                                Obbligatorio
                              </span>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                    <div className="text-muted mt-1">
                      {formatDateTime(wf.dataVariazione)}
                      {wf.operatore && <span className="ms-1">— {wf.operatore.cognome} {wf.operatore.nome}</span>}
                    </div>
                  </div>
                );
              }

              if (type === 'retrocession') {
                const text = (wf.note ?? '').replace(/^\[Retrocessione[^\]]*\]\s*/, '');
                return (
                  <div key={wf.id} className="mt-1 small text-warning">
                    ↩ {text || 'Retrocesso allo step precedente'}
                    <span className="text-muted ms-2">{formatDateTime(wf.dataVariazione)}</span>
                  </div>
                );
              }

              // Regular note — skip if empty
              if (!wf.note) return null;

              return (
                <p key={wf.id} className="mt-2 mb-0 small text-muted">{wf.note}</p>
              );
            })}

            {/* Operator label from first event */}
            {events[0]?.operatore && (
              <small className="text-muted d-block mt-1">
                {events[0].operatore.cognome} {events[0].operatore.nome}
              </small>
            )}
          </div>
        );
      })}
    </div>
  );
}
