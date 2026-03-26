'use client';

import { useState, useTransition } from 'react';
import { cloneServizio } from './actions';
import { toast } from 'sonner';

interface CloneServizioButtonProps {
  id: number;
  titolo: string;
}

export function CloneServizioButton({ id, titolo }: CloneServizioButtonProps) {
  const [showConfirm, setShowConfirm] = useState(false);
  const [isPending, startTransition] = useTransition();

  const handleClone = () => {
    startTransition(async () => {
      try {
        const result = await cloneServizio(id);
        if (result?.error) {
          toast.error(result.error);
        }
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : '';
        if (!msg.includes('NEXT_REDIRECT')) {
          toast.error('Errore durante la clonazione');
        }
      }
    });
  };

  if (showConfirm) {
    return (
      <div className="d-flex gap-1">
        <button
          type="button"
          className="btn btn-sm btn-danger"
          onClick={handleClone}
          disabled={isPending}
        >
          {isPending ? '...' : 'Clona e disattiva originale'}
        </button>
        <button
          type="button"
          className="btn btn-sm btn-secondary"
          onClick={() => setShowConfirm(false)}
          disabled={isPending}
        >
          Annulla
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      className="btn btn-sm btn-outline-warning"
      onClick={() => setShowConfirm(true)}
      title={`Clona "${titolo}" (disattiva originale)`}
    >
      Clona
    </button>
  );
}
