'use client';

import { Badge } from '@/components/ui';

interface Allegato {
  id: number;
  nomeFile: string;
  nomeFileRichiesto: string | null;
  mimeType: string | null;
  invUtente: boolean;
  visto: boolean;
  dataInserimento: Date | null;
}

interface Workflow {
  id: number;
  step: {
    descrizione: string;
  } | null;
  notifica: {
    descrizione: string;
  } | null;
  allegati: Allegato[];
}

interface AllegatiListProps {
  workflows: Workflow[];
}

export function AllegatiList({ workflows }: AllegatiListProps) {
  const allAllegati = workflows.flatMap((wf) =>
    wf.allegati.map((a) => ({
      ...a,
      step: wf.step?.descrizione || wf.notifica?.descrizione || '-',
    }))
  );

  if (allAllegati.length === 0) {
    return <p className="text-muted">Nessun allegato presente</p>;
  }

  const isViewable = (mimeType: string | null, nomeFile: string) => {
    const lower = nomeFile.toLowerCase();
    if (lower.endsWith('.pdf') || lower.endsWith('.jpg') || lower.endsWith('.jpeg') || lower.endsWith('.png')) {
      return true;
    }
    if (mimeType && (mimeType.includes('pdf') || mimeType.includes('image'))) {
      return true;
    }
    return false;
  };

  const getFileIcon = (mimeType: string | null) => {
    if (!mimeType) return '📄';
    if (mimeType.includes('pdf')) return '📕';
    if (mimeType.includes('image')) return '🖼️';
    if (mimeType.includes('word') || mimeType.includes('document')) return '📘';
    if (mimeType.includes('excel') || mimeType.includes('spreadsheet')) return '📗';
    return '📄';
  };

  return (
    <div className="table-responsive">
      <table className="table table-sm table-hover">
        <thead>
          <tr>
            <th></th>
            <th>Nome File</th>
            <th>Tipo Richiesto</th>
            <th>Step</th>
            <th>Data</th>
            <th>Stato</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {allAllegati.map((allegato) => (
            <tr
              key={allegato.id}
              className={allegato.invUtente ? 'table-info' : 'table-warning'}
            >
              <td>{getFileIcon(allegato.mimeType)}</td>
              <td>{allegato.nomeFile}</td>
              <td>
                <small className="text-muted">
                  {allegato.nomeFileRichiesto || '-'}
                </small>
              </td>
              <td>
                <small>{allegato.step}</small>
              </td>
              <td>
                <small>
                  {allegato.dataInserimento
                    ? new Date(allegato.dataInserimento).toLocaleDateString('it-IT')
                    : '-'}
                </small>
              </td>
              <td>
                <Badge
                  variant={allegato.invUtente ? 'info' : 'warning'}
                  className="me-1 w-100"
                >
                  {allegato.invUtente ? 'Utente' : 'Operatore'}
                </Badge>
                {allegato.visto ? (
                  <Badge variant="success" className='w-100'>Visto</Badge>
                ) : (
                  <Badge variant="secondary" className='w-100'>Non visto</Badge>
                )}
              </td>
              <td>
                <div className="d-flex gap-1">
                  {isViewable(allegato.mimeType, allegato.nomeFile) && (
                    <a
                      href={`/api/download/${allegato.id}`}
                      className="btn btn-sm btn-outline-secondary"
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Visualizza"
                    >
                      👁
                    </a>
                  )}
                  <a
                    href={`/api/download/${allegato.id}`}
                    className="btn btn-sm btn-outline-primary"
                    download={allegato.nomeFile}
                    title="Scarica"
                  >
                    ↓&nbsp;Scarica
                  </a>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="d-flex gap-3 mt-2">
        <small className="d-flex align-items-center gap-1">
          <span className="badge bg-info">&nbsp;</span> Allegato dal cittadino
        </small>
        <small className="d-flex align-items-center gap-1">
          <span className="badge bg-warning">&nbsp;</span> Allegato dall&apos;operatore
        </small>
      </div>
    </div>
  );
}
