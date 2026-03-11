'use client';

interface Props {
  files: File[];
  onChangeFiles: (files: File[]) => void;
}

export function AllegatiStep({ files, onChangeFiles }: Props) {
  const handleAdd = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      onChangeFiles([...files, ...Array.from(e.target.files)]);
    }
  };

  const handleRemove = (index: number) => {
    onChangeFiles(files.filter((_, i) => i !== index));
  };

  return (
    <div className="container">
      <h2 className="mb-4">Allegati</h2>
      <p className="text-paragraph mb-4">
        Allega i documenti richiesti per la pratica (es. documento d&apos;identità, codice fiscale, ecc.).
        Formati accettati: PDF, JPG, PNG. Dimensione massima per file: 10MB.
      </p>

      <div className="upload-dragdrop mb-4">
        <input
          type="file"
          id="allegati-input"
          className="upload-dragdrop-input"
          multiple
          accept=".pdf,.jpg,.jpeg,.png"
          onChange={handleAdd}
          style={{ display: 'none' }}
        />
        <label htmlFor="allegati-input" className="btn btn-outline-primary">
          <svg className="icon icon-sm me-2" aria-hidden="true">
            <use href="/bootstrap-italia/dist/svg/sprites.svg#it-upload" />
          </svg>
          Aggiungi allegati
        </label>
      </div>

      {files.length > 0 && (
        <ul className="list-group">
          {files.map((file, i) => (
            <li key={i} className="list-group-item d-flex justify-content-between align-items-center">
              <div>
                <svg className="icon icon-sm me-2 text-primary" aria-hidden="true">
                  <use href="/bootstrap-italia/dist/svg/sprites.svg#it-file" />
                </svg>
                <span>{file.name}</span>
                <small className="text-muted ms-2">({(file.size / 1024).toFixed(1)} KB)</small>
              </div>
              <button
                type="button"
                className="btn btn-sm btn-outline-danger"
                onClick={() => handleRemove(i)}
                aria-label={`Rimuovi ${file.name}`}
              >
                <svg className="icon icon-sm" aria-hidden="true">
                  <use href="/bootstrap-italia/dist/svg/sprites.svg#it-close" />
                </svg>
              </button>
            </li>
          ))}
        </ul>
      )}

      {files.length === 0 && (
        <p className="text-muted small">Nessun allegato aggiunto.</p>
      )}
    </div>
  );
}
