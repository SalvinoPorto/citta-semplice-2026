'use client';

import { useEnte } from '@/contexts/EnteContext';

interface Servizio {
  titolo: string;
  attributi?: string | null;
}

interface Props {
  servizio: Servizio;
  datiModulo: Record<string, unknown>;
  allegati: File[];
}

function parseCampi(attributi: string | null | undefined) {
  if (!attributi) return [];
  try {
    return JSON.parse(attributi) as Array<{ name: string; label: string }>;
  } catch {
    return [];
  }
}

export function RiepilogoStep({ servizio, datiModulo, allegati }: Props) {
  const nomeEnte = useEnte();
  const campi = parseCampi(servizio.attributi);

  return (
    <div className="container">
      <h2 className="mb-4">Riepilogo</h2>
      <p className="text-paragraph mb-4">
        Verifica i dati inseriti prima di inviare la richiesta.
      </p>

      <div className="card p-4 mb-4">
        <h3 className="h5 mb-3">Servizio richiesto</h3>
        <p className="mb-0"><strong>{servizio.titolo}</strong></p>
      </div>

      {campi.length > 0 && (
        <div className="card p-4 mb-4">
          <h3 className="h5 mb-3">Dati inseriti</h3>
          <dl className="row">
            {campi.map((campo) => (
              <div key={campo.name} className="col-12 col-md-6 mb-2">
                <dt className="small text-muted">{campo.label}</dt>
                <dd className="mb-0">
                  {datiModulo[campo.name] !== undefined && datiModulo[campo.name] !== ''
                    ? String(datiModulo[campo.name])
                    : <span className="text-muted fst-italic">Non compilato</span>}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      )}

      {allegati.length > 0 && (
        <div className="card p-4 mb-4">
          <h3 className="h5 mb-3">Allegati ({allegati.length})</h3>
          <ul className="list-unstyled mb-0">
            {allegati.map((file, i) => (
              <li key={i} className="mb-1">
                <svg className="icon icon-sm me-1 text-primary" aria-hidden="true">
                  <use href="/bootstrap-italia/dist/svg/sprites.svg#it-file" />
                </svg>
                {file.name}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="alert alert-info">
        {/* <svg className="icon icon-sm me-2" aria-hidden="true">
          <use href="/bootstrap-italia/dist/svg/sprites.svg#it-info-circle" />
        </svg> */}
        Cliccando su <strong>&quot;Invia la richiesta&quot;</strong> la tua istanza verrà inviata
        al {nomeEnte}. Riceverai una conferma via email.
      </div>
    </div>
  );
}
