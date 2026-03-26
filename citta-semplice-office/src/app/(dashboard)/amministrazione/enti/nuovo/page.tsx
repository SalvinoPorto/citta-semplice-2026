import Link from 'next/link';
import { EnteForm } from '../ente-form';

export default function NuovoEntePage() {
  return (
    <div>
      <Link href="/amministrazione/enti" className="btn btn-link p-0 mb-2">
        ← Torna agli enti
      </Link>
      <div className="page-header d-flex justify-content-between align-items-start">
        <h1>Nuovo Ente</h1>
        <p>Crea una nuova organizzazione</p>
      </div>

      <EnteForm isNew />
    </div>
  );
}
