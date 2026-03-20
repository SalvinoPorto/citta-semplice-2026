'use client';

import { SessionProvider } from 'next-auth/react';
import { Toaster } from 'sonner';
import { EnteProvider } from '@/contexts/EnteContext';

export function Providers({ nomeEnte, children }: { nomeEnte: string; children: React.ReactNode }) {
  return (
    <SessionProvider>
      <EnteProvider nomeEnte={nomeEnte}>
        {children}
        <Toaster position="top-right" richColors closeButton toastOptions={{ duration: 4000 }} />
      </EnteProvider>
    </SessionProvider>
  );
}
