import Link from 'next/link';
import { requireAdmin } from '@/lib/auth/session';
import { RuoloForm } from '../ruolo-form';

export default async function NuovoRuoloPage() {
  await requireAdmin();

  return (
    <div>
      <div className="page-header">
        <div className="d-flex align-items-center gap-2 mb-2">
          <Link href="/amministrazione/ruoli" className="btn btn-link p-0">
            ← Torna ai ruoli
          </Link>
        </div>
        <h1>Nuovo Ruolo</h1>
        <p>Crea un nuovo ruolo operatore con i relativi permessi.</p>
      </div>

      <RuoloForm />
    </div>
  );
}
