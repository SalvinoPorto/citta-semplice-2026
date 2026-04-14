'use client';

import { useRouter } from 'next/navigation';

export function BackButton() {
  const router = useRouter();
  return (
    <button type="button" className="btn btn-link p-0" onClick={() => router.back()}>
      ← Torna alle istanze
    </button>
  );
}
