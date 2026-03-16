'use client';

import { useState, useRef } from 'react';
import { toast } from 'sonner';
import { rispondiComunicazione } from '@/lib/actions/comunicazioni';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';

interface AllegatoRichiestoComm {
  nome: string;
  obbligatorio: boolean;
}

interface AllegatoRispostaInfo {
  id: number;
  nomeFile: string;
}

interface Risposta {
  id: number;
  testo: string | null;
  dataRisposta: Date;
  allegati: AllegatoRispostaInfo[];
}

interface Props {
  comunicazioneId: number;
  allegatiRichiesti: AllegatoRichiestoComm[];
  risposta: Risposta | null;
}

export function RispostaComunicazioneForm({
  comunicazioneId,
  allegatiRichiesti,
  risposta,
}: Props) {
  const [testo, setTesto] = useState('');
  const [files, setFiles] = useState<{ nome: string; file: File }[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [inviata, setInviata] = useState(risposta !== null);
  const [rispostaInviata, setRispostaInviata] = useState<Risposta | null>(risposta);
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const freeInputRef = useRef<HTMLInputElement | null>(null);

  // Se la risposta esiste già, mostrala in sola lettura
  if (inviata && rispostaInviata) {
    return (
      <div className="mt-3 border-top pt-3">
        <h4 className="h6 mb-2 text-success">
          <svg className="icon icon-sm me-1 text-success" aria-hidden="true">
            <use href="/bootstrap-italia/dist/svg/sprites.svg#it-check-circle" />
          </svg>
          Risposta inviata il {format(new Date(rispostaInviata.dataRisposta), 'dd MMMM yyyy, HH:mm', { locale: it })}
        </h4>
        {rispostaInviata.testo && (
          <p className="mb-2">{rispostaInviata.testo}</p>
        )}
        {rispostaInviata.allegati.length > 0 && (
          <ul className="list-unstyled mb-0">
            {rispostaInviata.allegati.map((a) => (
              <li key={a.id} className="d-flex align-items-center gap-2 small">
                <svg className="icon icon-sm text-primary" aria-hidden="true">
                  <use href="/bootstrap-italia/dist/svg/sprites.svg#it-file" />
                </svg>
                <a
                  href={`/api/risposta-allegati/${a.id}`}
                  className="text-decoration-none"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {a.nomeFile}
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  const handleFileChange = (nome: string, fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    const file = fileList[0];
    setFiles((prev) => {
      const altri = prev.filter((f) => f.nome !== nome);
      return [...altri, { nome, file }];
    });
    setErrors((prev) => { const next = { ...prev }; delete next[nome]; return next; });
  };

  const handleRemoveFile = (nome: string) => {
    setFiles((prev) => prev.filter((f) => f.nome !== nome));
    if (inputRefs.current[nome]) inputRefs.current[nome]!.value = '';
  };

  const handleFreeFileChange = (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    const file = fileList[0];
    const chiave = `__libero_${Date.now()}`;
    setFiles((prev) => [...prev, { nome: chiave, file }]);
    if (freeInputRef.current) freeInputRef.current.value = '';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: Record<string, string> = {};

    // Valida allegati obbligatori
    for (const ar of allegatiRichiesti) {
      if (ar.obbligatorio && !files.find((f) => f.nome === ar.nome)) {
        newErrors[ar.nome] = `Allegato obbligatorio`;
      }
    }
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    // Valida formato e dimensione
    for (const { file } of files) {
      const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
      if (!isPdf) {
        toast.error(`"${file.name}" non è un file PDF.`);
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        toast.error(`"${file.name}" supera i 10 MB consentiti.`);
        return;
      }
    }

    if (!testo.trim() && files.length === 0) {
      toast.error('Inserisci un testo di risposta o carica almeno un allegato.');
      return;
    }

    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('comunicazioneId', String(comunicazioneId));
      formData.append('testo', testo);
      files.forEach(({ file }) => formData.append('allegati', file));

      const result = await rispondiComunicazione(formData);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success('Risposta inviata con successo!');
        setRispostaInviata({
          id: 0,
          testo: testo || null,
          dataRisposta: new Date(),
          allegati: files.map((f, i) => ({ id: i, nomeFile: f.file.name })),
        });
        setInviata(true);
      }
    } catch {
      toast.error('Errore durante l\'invio della risposta. Riprova.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="mt-3 border-top pt-3">
      <h4 className="h6 mb-3">La tua risposta</h4>

      {/* Textarea risposta testuale */}
      <div className="mb-3">
        <label htmlFor={`testo-${comunicazioneId}`} className="form-label small">
          Testo della risposta
        </label>
        <textarea
          id={`testo-${comunicazioneId}`}
          className="form-control"
          rows={4}
          value={testo}
          onChange={(e) => setTesto(e.target.value)}
          placeholder="Scrivi qui la tua risposta..."
        />
      </div>

      {/* Allegati specificati dalla comunicazione */}
      {allegatiRichiesti.length > 0 && (
        <div className="mb-3">
          <p className="small fw-semibold mb-2">Allegati richiesti:</p>
          <ul className="list-group mb-1">
            {allegatiRichiesti.map((ar) => {
              const fileCaricato = files.find((f) => f.nome === ar.nome);
              const hasError = !!errors[ar.nome];
              return (
                <li
                  key={ar.nome}
                  className={`list-group-item py-2${hasError ? ' border-danger' : ''}`}
                >
                  <div className="d-flex align-items-center justify-content-between gap-3">
                    <div className="flex-grow-1">
                      <span className="small fw-semibold">
                        {ar.nome}
                        {ar.obbligatorio && <span className="text-danger ms-1">*</span>}
                      </span>
                      {fileCaricato ? (
                        <div className="small text-success mt-1">
                          <svg className="icon icon-sm me-1" aria-hidden="true">
                            <use href="/bootstrap-italia/dist/svg/sprites.svg#it-check-circle" />
                          </svg>
                          {fileCaricato.file.name}
                        </div>
                      ) : (
                        <div className="small text-muted mt-1">Nessun file caricato</div>
                      )}
                      {hasError && <div className="small text-danger">{errors[ar.nome]}</div>}
                    </div>
                    <div className="d-flex gap-2 flex-shrink-0">
                      <label
                        htmlFor={`file-${comunicazioneId}-${ar.nome}`}
                        className="btn btn-sm btn-outline-primary mb-0"
                        style={{ cursor: 'pointer' }}
                      >
                        <svg className="icon icon-sm me-1" aria-hidden="true">
                          <use href="/bootstrap-italia/dist/svg/sprites.svg#it-upload" />
                        </svg>
                        {fileCaricato ? 'Sostituisci' : 'Carica'}
                      </label>
                      <input
                        type="file"
                        id={`file-${comunicazioneId}-${ar.nome}`}
                        className="d-none"
                        accept=".pdf"
                        ref={(el) => { inputRefs.current[ar.nome] = el; }}
                        onChange={(e) => handleFileChange(ar.nome, e.target.files)}
                      />
                      {fileCaricato && (
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-danger"
                          onClick={() => handleRemoveFile(ar.nome)}
                          aria-label={`Rimuovi ${ar.nome}`}
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
          <p className="small text-muted mb-0">
            <span className="text-danger">*</span> obbligatorio &mdash; solo file PDF, max 10 MB
          </p>
        </div>
      )}

      {/* Allegato libero (se non ci sono allegati specificati) */}
      {allegatiRichiesti.length === 0 && (
        <div className="mb-3">
          <label className="form-label small">Allegato (opzionale, PDF max 10 MB)</label>
          <div className="d-flex align-items-center gap-2 flex-wrap">
            <label
              htmlFor={`file-libero-${comunicazioneId}`}
              className="btn btn-sm btn-outline-secondary mb-0"
              style={{ cursor: 'pointer' }}
            >
              <svg className="icon icon-sm me-1" aria-hidden="true">
                <use href="/bootstrap-italia/dist/svg/sprites.svg#it-upload" />
              </svg>
              Carica PDF
            </label>
            <input
              type="file"
              id={`file-libero-${comunicazioneId}`}
              className="d-none"
              accept=".pdf"
              ref={freeInputRef}
              onChange={(e) => handleFreeFileChange(e.target.files)}
            />
            {files.filter((f) => f.nome.startsWith('__libero_')).map((f) => (
              <span key={f.nome} className="badge bg-light text-dark border d-flex align-items-center gap-1">
                <svg className="icon icon-sm text-primary" aria-hidden="true">
                  <use href="/bootstrap-italia/dist/svg/sprites.svg#it-file" />
                </svg>
                {f.file.name}
                <button
                  type="button"
                  className="btn-close btn-close-sm ms-1"
                  style={{ fontSize: '0.6rem' }}
                  onClick={() => handleRemoveFile(f.nome)}
                  aria-label="Rimuovi"
                />
              </span>
            ))}
          </div>
        </div>
      )}

      <button
        type="submit"
        className="btn btn-primary btn-sm"
        disabled={loading}
      >
        {loading ? (
          <>
            <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true" />
            Invio in corso...
          </>
        ) : (
          <>
            <svg className="icon icon-sm me-1" aria-hidden="true">
              <use href="/bootstrap-italia/dist/svg/sprites.svg#it-send" />
            </svg>
            Invia risposta
          </>
        )}
      </button>
    </form>
  );
}
