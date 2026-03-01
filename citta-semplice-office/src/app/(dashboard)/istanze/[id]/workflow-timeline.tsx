'use client';

interface Workflow {
  id: number;
  note: string | null;
  dataVariazione: Date;
  status: {
    stato: string;
    icon: string | null;
  };
  step: {
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

  return (
    <div className="timeline">
      {workflows.map((workflow) => (
        <div
          key={workflow.id}
          className={`timeline-item ${getStatusClass(workflow.status.stato)}`}
        >
          <div className="d-flex justify-content-between align-items-start mb-1">
            <strong>
              {workflow.step?.descrizione || workflow.notifica?.descrizione || '-'}
            </strong>
            <small className="text-muted">
              {new Date(workflow.dataVariazione).toLocaleDateString('it-IT')}
            </small>
          </div>
          <div className="mb-1">
            <span
              className={`badge ${
                getStatusClass(workflow.status.stato) === 'completed'
                  ? 'bg-success'
                  : getStatusClass(workflow.status.stato) === 'rejected'
                  ? 'bg-danger'
                  : 'bg-warning text-dark'
              }`}
            >
              {workflow.status.stato}
            </span>
          </div>
          {workflow.operatore && (
            <small className="text-muted d-block">
              {workflow.operatore.cognome} {workflow.operatore.nome}
            </small>
          )}
          {workflow.note && (
            <p className="mt-2 mb-0 small text-muted">{workflow.note}</p>
          )}
        </div>
      ))}
    </div>
  );
}
