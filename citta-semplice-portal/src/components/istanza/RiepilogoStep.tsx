'use client';

import { useEnte } from '@/contexts/EnteContext';
import { getCampoValue } from '@/lib/utils';
import { costruisciRiepilogo, isFieldVisible, parseCampi, splitPages } from '@citta/form-schema';

interface Servizio {
  titolo: string;
  attributi?: string | null;
}

interface Props {
  servizio: Servizio;
  datiModulo: Record<string, unknown>;
  allegati: File[];
}

export function RiepilogoStep({ servizio, datiModulo, allegati }: Props) {
  const nomeEnte = useEnte();
  // Il riepilogo rispecchia la suddivisione in pagine del modulo: una sezione
  // per pagina (una sola se il modulo non usa pagebreak). Dentro ogni pagina i
  // titoli dello schema fanno da intestazione ai campi che introducono.
  const pagine = splitPages(parseCampi(servizio.attributi))
    .map((p) => ({
      titolo: p.titolo,
      voci: costruisciRiepilogo(p.fields, (campo) =>
        isFieldVisible(campo, datiModulo)
          ? { label: campo.label, value: String(datiModulo[campo.name] ?? '') }
          : null,
      ),
    }))
    .filter((p) => p.voci.some((v) => v.kind === 'campo'));
  const numCampi = pagine.reduce((n, p) => n + p.voci.length, 0);

  return (
    <div className="container">
      <h3 className="mb-4">Riepilogo</h3>
      <p className="text-paragraph mb-4">
        Verifica i dati inseriti prima di inviare la richiesta.
      </p>

      {/* Dati della richiesta */}
      {numCampi > 0 && (
        <section className="mb-5">
          <h2 className="h4 border-bottom pb-2 mb-4">
            <svg className="icon icon-sm me-2" aria-hidden="true">
              <use href="/bootstrap-italia/dist/svg/sprites.svg#it-note" />
            </svg>
            Dati della richiesta
          </h2>

          {pagine.map((pagina, i) => (
            <div className="card mb-3" key={i}>
              {pagine.length > 1 && (
                <div className="card-header py-2 fw-semibold">
                  {pagina.titolo || `Pagina ${i + 1}`}
                </div>
              )}
              <div className="card-body p-0">
                <table className="table table-sm mb-0">
                  <tbody>
                    {pagina.voci.map((voce, j) =>
                      voce.kind === 'titolo' ? (
                        <tr key={`t-${j}`} className="table-light">
                          <th colSpan={2} className="ps-3 text-uppercase small fw-bold text-muted">
                            {voce.label}
                          </th>
                        </tr>
                      ) : (
                        <tr key={`c-${voce.name}-${j}`}>
                          <th style={{ width: '30%' }} className="ps-3">{voce.label}</th>
                          <td>{getCampoValue(voce.value)}</td>
                        </tr>
                      ),
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ))}

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
