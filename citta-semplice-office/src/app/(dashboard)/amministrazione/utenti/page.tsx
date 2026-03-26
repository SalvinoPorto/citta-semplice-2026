import { requireAdmin } from '@/lib/auth/session';
import { UtentiTable } from './utenti-table';
import Link from 'next/link';

export default async function UtentiPage() {
  await requireAdmin();

  return (
    <div>
      <Link href="/amministrazione" className="btn btn-link p-0 mb-2">
        ← Torna ad Amministrazione
      </Link>
      <div className="page-header d-flex justify-content-between align-items-start">
        <div>
          <h1>Utenti</h1>
          <p>Anagrafica dei cittadini registrati — modifica solo dati di contatto</p>
        </div>
      </div>
      <UtentiTable />
    </div>
  );
}
