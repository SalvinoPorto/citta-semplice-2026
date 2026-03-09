import Link from 'next/link';
import { requireAdmin } from '@/lib/auth/session';
import { TributoForm } from '../tributo-form';

export default async function NuovoTributoPage() {
  await requireAdmin();

  return (
    <div>
      <div className="page-header">
        <div className="d-flex align-items-center gap-2 mb-2">
          <Link href="/amministrazione/tributi" className="btn btn-link p-0">
            ← Torna ai tributi
          </Link>
        </div>
        <h1>Nuovo Tributo</h1>
        <p>Aggiungi un nuovo codice tributo per i pagamenti PagoPA.</p>
      </div>

      <TributoForm />
    </div>
  );
}
