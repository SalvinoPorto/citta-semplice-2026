import Link from 'next/link';
import { UfficioForm } from '../ufficio-form';

export default function NuovoUfficioPage() {
  return (
    <div>
      <div className="page-header">
        <div className="d-flex align-items-center gap-2 mb-2">
          <Link href="/amministrazione/uffici" className="btn btn-link p-0">
            ← Torna a Uffici
          </Link>
        </div>
        <h1>Nuovo Ufficio</h1>
        <p>Crea un nuovo ufficio</p>
      </div>

      <UfficioForm isNew />
    </div>
  );
}
