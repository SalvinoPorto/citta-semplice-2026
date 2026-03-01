import type { Metadata } from 'next';
import { Titillium_Web } from 'next/font/google';
import 'bootstrap-italia/dist/css/bootstrap-italia.min.css';
import './globals.css';
import { Providers } from './providers';
import BootstrapClient from '@/lib/bootstrap-client';

const titillium = Titillium_Web({
  subsets: ['latin'],
  weight: ['200', '300', '400', '600', '700'],
  display: 'swap',
  variable: '--font-titillium',
});

export const metadata: Metadata = {
  title: 'Citta Semplice Office',
  description: 'Backoffice per la gestione delle Istanze Online - Comune di Catania',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="it" className={titillium.variable} data-scroll-behavior="smooth">
      {/* <head>
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/npm/bootstrap-italia@2.8.8/dist/css/bootstrap-italia.min.css"
        />
      </head> */}
      <body>
        <Providers>
          {children}
        </Providers>
        <BootstrapClient />
      </body>
    </html>
  );
}
