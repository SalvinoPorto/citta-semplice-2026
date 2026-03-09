import { requireAdmin } from '@/lib/auth/session';
import { UtentiTable } from './utenti-table';

export default async function UtentiPage() {
  await requireAdmin();

  return (
    <div>
      <div className="page-header">
        <h1>Utenti</h1>
        <p>Anagrafica dei cittadini registrati — modifica solo dati di contatto</p>
      </div>
      <UtentiTable />
    </div>
  );
}
