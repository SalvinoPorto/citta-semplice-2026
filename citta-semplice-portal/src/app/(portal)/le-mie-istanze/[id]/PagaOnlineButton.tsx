'use client';

import { useState } from 'react';

export function PagaOnlineButton({ iuv }: { iuv: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/pagamenti/url/${iuv}`);
      const data = await res.json() as { location?: string; error?: string };
      if (!res.ok || !data.location) {
        setError(data.error ?? 'URL pagamento non disponibile');
        return;
      }
      window.location.href = data.location;
    } catch {
      setError('Errore di rete, riprovare.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <span>
      <button
        type="button"
        className="btn btn-sm btn-warning"
        onClick={handleClick}
        disabled={loading}
      >
        {loading ? (
          <>
            <span className="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true" />
            Caricamento…
          </>
        ) : (
          <>
            <svg className="icon icon-sm me-1" aria-hidden="true">
              <use href="/bootstrap-italia/dist/svg/sprites.svg#it-external-link" />
            </svg>
            Paga online
          </>
        )}
      </button>
      {error && <div className="text-danger small mt-1">{error}</div>}
    </span>
  );
}
