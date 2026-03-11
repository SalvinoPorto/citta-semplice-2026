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
  title: 'Città Semplice - Comune di Catania',
  description: 'Portale dei servizi online a istanza di parte del Comune di Catania',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="it" className={titillium.variable} data-scroll-behavior="smooth">
      <body>
        <Providers>
          {children}
        </Providers>
        <BootstrapClient />
      </body>
    </html>
  );
}
