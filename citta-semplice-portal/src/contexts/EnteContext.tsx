'use client';

import { createContext, useContext } from 'react';

const EnteContext = createContext<string>('Comune');

export function EnteProvider({ nomeEnte, children }: { nomeEnte: string; children: React.ReactNode }) {
  return <EnteContext.Provider value={nomeEnte}>{children}</EnteContext.Provider>;
}

export function useEnte() {
  return useContext(EnteContext);
}
