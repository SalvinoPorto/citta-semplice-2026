import type { Metadata } from 'next';
import { Titillium_Web } from 'next/font/google';
import 'bootstrap-italia/dist/css/bootstrap-italia.min.css';
import './globals.css';
import { Providers } from './providers';
import BootstrapClient from '@/lib/bootstrap-client';
import { prisma } from '@/lib/db/prisma';

const titillium = Titillium_Web({
  subsets: ['latin'],
  weight: ['200', '300', '400', '600', '700'],
  display: 'swap',
  variable: '--font-titillium',
});

export async function generateMetadata(): Promise<Metadata> {
  const ente = await prisma.ente.findFirst();
  const nomeEnte = ente?.nome ?? 'Comune';
  return {
    title: `Città Semplice - ${nomeEnte}`,
    description: `Portale dei servizi online a istanza di parte del ${nomeEnte}`,
  };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const ente = await prisma.ente.findFirst();
  const nomeEnte = ente?.nome ?? 'Comune';

  return (
    <html lang="it" className={titillium.variable} data-scroll-behavior="smooth">
      <body>
        <Providers nomeEnte={nomeEnte}>
          {children}
        </Providers>
        <BootstrapClient />
      </body>
    </html>
  );
}
