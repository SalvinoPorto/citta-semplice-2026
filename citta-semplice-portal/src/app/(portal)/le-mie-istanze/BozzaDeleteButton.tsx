'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { eliminaBozza } from '@/lib/actions/istanza';

export function BozzaDeleteButton({ bozzaId }: { bozzaId: number }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleDelete() {
    if (!confirm('Sei sicuro di voler eliminare questa bozza? L\'operazione non è reversibile.')) return;
    setLoading(true);
    const result = await eliminaBozza(bozzaId);
    setLoading(false);
    if (result.error) {
      alert(result.error);
    } else {
      router.refresh();
    }
  }

  return (
    <button
      type="button"
      className="btn btn-sm btn-outline-danger ms-2"
      onClick={handleDelete}
      disabled={loading}
      title="Elimina bozza"
    >
      <svg className="icon icon-sm" aria-hidden="true">
        <use href="/bootstrap-italia/dist/svg/sprites.svg#it-delete" />
      </svg>
      <span className="visually-hidden">Elimina</span>
    </button>
  );
}
