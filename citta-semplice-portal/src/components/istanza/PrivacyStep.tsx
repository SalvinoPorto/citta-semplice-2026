'use client';
import { useEnte } from '@/contexts/EnteContext';

interface Props {
  accepted: boolean;
  onAccept: (v: boolean) => void;
}

export function PrivacyStep({ accepted, onAccept }: Props) {
  const nomeEnte = useEnte();
  return (
    <div className="container">
      <h2 className="mb-4">Informativa sulla privacy</h2>
      <div className="card p-4 mb-4">
        <p className="mb-3">
          Ai sensi del Regolamento UE 2016/679 (GDPR), il {nomeEnte}, in qualità di Titolare
          del trattamento, informa che i dati personali forniti saranno trattati per le finalità
          connesse alla gestione della presente istanza online.
        </p>
        <p className="mb-3">
          I dati forniti saranno trattati esclusivamente per l&apos;erogazione del servizio
          richiesto e non saranno comunicati a terzi, salvo obblighi di legge.
        </p>
        <p className="mb-3">
          Il conferimento dei dati è obbligatorio per procedere con la richiesta del servizio.
        </p>
        <p className="mb-0">
          Per informazioni complete sull&apos;informativa sulla privacy, consulta la{' '}
          <a href="/privacy" target="_blank" rel="noopener noreferrer">
            Privacy Policy del portale
          </a>
          .
        </p>
      </div>

      <div className="form-check">
        <input
          className="form-check-input"
          type="checkbox"
          id="privacy-check"
          checked={accepted}
          onChange={(e) => onAccept(e.target.checked)}
        />
        <label className="form-check-label fw-bold" htmlFor="privacy-check">
          Ho letto e accetto l&apos;informativa sulla privacy
        </label>
      </div>

      {!accepted && (
        <p className="text-muted small mt-2">
          È necessario accettare l&apos;informativa per procedere.
        </p>
      )}
    </div>
  );
}
