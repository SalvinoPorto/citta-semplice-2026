'use client';

import { useEnte } from '@/contexts/EnteContext';
import { getCampoValue } from '@/lib/utils';
import { isFieldVisible, FieldCondition } from '@/lib/form-condition';

interface Servizio {
  titolo: string;
  attributi?: string | null;
}

interface Props {
  servizio: Servizio;
  datiModulo: Record<string, unknown>;
  allegati: File[];
}

const SKIP_FIELD_TYPES = new Set(['heading', 'paragraph', 'divider', 'hidden', 'file']);

type RawField = { name: string; label: string; type?: string; condition?: FieldCondition };

function parseCampi(attributi: string | null | undefined): RawField[] {
  if (!attributi) return [];
  try {
    const parsed = JSON.parse(attributi);
    return Array.isArray(parsed) ? parsed : (parsed?.fields ?? []);
  } catch {
    return [];
  }
}

export function RiepilogoStep({ servizio, datiModulo, allegati }: Props) {
  const nomeEnte = useEnte();
  const campi = parseCampi(servizio.attributi).filter(
    (f) => !SKIP_FIELD_TYPES.has(f.type ?? '') && isFieldVisible(f, datiModulo),
  );

  return (
    <div className="container">
      <h3 className="mb-4">Riepilogo</h3>
      <p className="text-paragraph mb-4">
        Verifica i dati inseriti prima di inviare la richiesta.
      </p>

      {/* Dati della richiesta */}
      {campi.length > 0 && (
        <section className="mb-5">
          <h2 className="h4 border-bottom pb-2 mb-4">
            <svg className="icon icon-sm me-2" aria-hidden="true">
              <use href="/bootstrap-italia/dist/svg/sprites.svg#it-note" />
            </svg>
            Dati della richiesta
          </h2>

          <div className="card">
            <div className="card-body p-0">
              <table className="table table-sm mb-0">
                <tbody>
                  {campi.map((campo) => (
                    <tr key={campo.name}>
                      <th style={{ width: '30%' }} className="ps-3">{campo.label}</th>
                      <td>{getCampoValue(String(datiModulo[campo.name] ?? ''))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Allegati caricati dal cittadino */}
          {allegati.length > 0 && (
            <div className="mt-3">
              <h3 className="h6 mb-2">Allegati caricati</h3>
              <ul className="list-group">
                {allegati.map((file, i) => (
                  <li key={i} className="list-group-item d-flex align-items-center gap-2">
                    <svg className="icon icon-sm text-primary" aria-hidden="true">
                      <use href="/bootstrap-italia/dist/svg/sprites.svg#it-file" />
                    </svg>
                    <span className="fw-semibold">{file.name}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

      <div className="alert alert-info">
        Cliccando su <strong>&quot;Invia la richiesta&quot;</strong> la tua istanza verrà inviata
        al {nomeEnte}. Riceverai una conferma via email.
      </div>
    </div>
  );
}
