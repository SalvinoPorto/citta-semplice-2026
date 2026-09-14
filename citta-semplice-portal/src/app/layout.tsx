import type { Metadata } from 'next';
import { Titillium_Web } from 'next/font/google';
import Script from 'next/script';
import 'bootstrap-italia/dist/css/bootstrap-italia.min.css';
import './globals.css';
import { Providers } from './providers';
import { prisma } from '@/lib/db/prisma';

const titillium = Titillium_Web({
  subsets: ['latin'],
  weight: ['200', '300', '400', '600', '700'],
  display: 'swap',
  variable: '--font-titillium',
});

/**
 * Il nome dell'ente è un dettaglio di presentazione: non deve poter impedire al
 * layout di rendersi. Senza questo `catch`:
 *  - `next build` fallisce mentre prerenderizza _not-found e _global-error, che
 *    passano da questo layout, ogni volta che il database non è raggiungibile —
 *    per esempio dentro un container di build, dove è giusto che non lo sia;
 *  - a runtime un singolo sfarfallio del database restituisce 500 su TUTTE le
 *    pagine del portale, comprese quelle che non mostrano dati.
 * Il fallback `?? 'Comune'` esisteva già per il caso "nessun ente in tabella":
 * qui copre anche l'errore di connessione. L'errore viene loggato, non
 * inghiottito in silenzio.
 */
async function leggiNomeEnte(): Promise<string> {
  try {
    const ente = await prisma.ente.findFirst();
    return ente?.nome ?? 'Comune';
  } catch (error) {
    console.error('[layout] lettura Ente fallita, uso il nome di riserva:', error);
    return 'Comune';
  }
}

export async function generateMetadata(): Promise<Metadata> {
  const nomeEnte = await leggiNomeEnte();
  return {
    title: `Città Semplice - ${nomeEnte}`,
    description: `Portale dei servizi online a istanza di parte del ${nomeEnte}`,
  };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const nomeEnte = await leggiNomeEnte();

  return (
    <html lang="it" className={titillium.variable} data-scroll-behavior="smooth">
      <body>
        <Providers nomeEnte={nomeEnte}>
          {children}
        </Providers>
      </body>
      <Script
        src="/bootstrap-italia/dist/js/bootstrap-italia.bundle.min.js"
        strategy="afterInteractive"
      />
    </html>
  );
}
