'use client';

import { forwardRef, useImperativeHandle, useRef, useState } from 'react';

export interface AllegatoRichiesto {
  id: number;
  nomeAllegatoRichiesto: string;
  obbligatorio: boolean;
}

export interface AllegatoCaricato {
  allegatoId: number;
  file: File;
}

export interface AllegatiStepHandle {
  validate: () => boolean;
}

interface Props {
  allegatiRichiesti: AllegatoRichiesto[];
  allegatiCaricati: AllegatoCaricato[];
  onChangeAllegati: (allegati: AllegatoCaricato[]) => void;
}

export const AllegatiStep = forwardRef<AllegatiStepHandle, Props>(function AllegatiStep(
  { allegatiRichiesti, allegatiCaricati, onChangeAllegati },
  ref
) {
  const [errors, setErrors] = useState<Record<number, string>>({});
  const inputRefs = useRef<Record<number, HTMLInputElement | null>>({});

  useImperativeHandle(ref, () => ({
    validate: () => {
      const newErrors: Record<number, string> = {};
      for (const a of allegatiRichiesti) {
        if (a.obbligatorio && !allegatiCaricati.find((c) => c.allegatoId === a.id)) {
          newErrors[a.id] = 'Allegato obbligatorio';
        }
      }
      setErrors(newErrors);
      return Object.keys(newErrors).length === 0;
    },
  }));

  const getFile = (id: number) => allegatiCaricati.find((c) => c.allegatoId === id)?.file ?? null;

  const handleChange = (allegatoId: number, files: FileList | null) => {
    if (!files || files.length === 0) return;
    const file = files[0];
    const aggiornati = allegatiCaricati.filter((c) => c.allegatoId !== allegatoId);
    onChangeAllegati([...aggiornati, { allegatoId, file }]);
    setErrors((prev) => {
      const next = { ...prev };
      delete next[allegatoId];
      return next;
    });
  };

  const handleRemove = (allegatoId: number) => {
    onChangeAllegati(allegatiCaricati.filter((c) => c.allegatoId !== allegatoId));
    if (inputRefs.current[allegatoId]) {
      inputRefs.current[allegatoId]!.value = '';
    }
  };

  if (allegatiRichiesti.length === 0) {
    return (
      <div className="container">
        <h2 className="mb-4">Allegati</h2>
        <div className="alert alert-info">
          Nessun allegato richiesto per questo servizio.
        </div>
      </div>
    );
  }

  const obbligatoriCount = allegatiRichiesti.filter((a) => a.obbligatorio).length;

  return (
    <div className="container">
      <h3 className="mb-4">Allegati richiesti</h3>

      <div className="card mb-4">
        <div className="card-body p-0">
          <ul className="list-group list-group-flush">
            {allegatiRichiesti.map((allegato) => {
              const file = getFile(allegato.id);
              const hasError = !!errors[allegato.id];

              return (
                <li
                  key={allegato.id}
                  className={`list-group-item py-3${hasError ? ' border-danger' : ''}`}
                >
                  <div className="d-flex align-items-start justify-content-between gap-3">
                    {/* Nome allegato */}
                    <div className="flex-grow-1">
                      <span className="fw-semibold">
                        {allegato.nomeAllegatoRichiesto}
                        {allegato.obbligatorio && (
                          <span className="text-danger ms-1" aria-label="obbligatorio">*</span>
                        )}
                      </span>
                      {file ? (
                        <div className="mt-1 d-flex align-items-center gap-2">
                          <svg className="icon icon-sm text-success" aria-hidden="true">
                            <use href="/bootstrap-italia/dist/svg/sprites.svg#it-check-circle" />
                          </svg>
                          <span className="small text-success">{file.name}</span>
                          <span className="small text-muted">({(file.size / 1024).toFixed(1)} KB)</span>
                        </div>
                      ) : (
                        <div className="mt-1 small text-muted">Nessun file caricato</div>
                      )}
                      {hasError && (
                        <div className="small text-danger mt-1">{errors[allegato.id]}</div>
                      )}
                    </div>

                    {/* Azioni */}
                    <div className="d-flex gap-2 align-items-center flex-shrink-0">
                      <label
                        htmlFor={`allegato-${allegato.id}`}
                        className="btn btn-sm btn-outline-primary mb-0"
                        style={{ cursor: 'pointer' }}
                      >
                        <svg className="icon icon-sm me-1" aria-hidden="true">
                          <use href="/bootstrap-italia/dist/svg/sprites.svg#it-upload" />
                        </svg>
                        {file ? 'Sostituisci' : 'Carica'}
                      </label>
                      <input
                        type="file"
                        id={`allegato-${allegato.id}`}
                        className="d-none"
                        accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                        ref={(el) => { inputRefs.current[allegato.id] = el; }}
                        onChange={(e) => handleChange(allegato.id, e.target.files)}
                      />
                      {file && (
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-danger"
                          onClick={() => handleRemove(allegato.id)}
                          aria-label={`Rimuovi ${allegato.nomeAllegatoRichiesto}`}
                        >
                          <svg className="icon icon-sm" aria-hidden="true">
                            <use href="/bootstrap-italia/dist/svg/sprites.svg#it-delete" />
                          </svg>
                        </button>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </div>

      {obbligatoriCount > 0 && (
        <p className="small text-muted">
          <span className="text-danger">*</span> {obbligatoriCount === 1 ? 'obbligatorio' : `${obbligatoriCount} obbligatori`}
        </p>
      )}
    </div>
  );
});
