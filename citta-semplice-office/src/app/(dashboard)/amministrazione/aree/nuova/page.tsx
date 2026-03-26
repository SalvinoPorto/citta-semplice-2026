import Link from 'next/link';
import { AreaForm } from '../area-form';

export default async function NuovaAreaPage() {
  
  return (
    <div>
      <div className="page-header">
        <div className="d-flex align-items-center gap-2 mb-2">
          <Link href="/amministrazione/aree" className="btn btn-link p-0">
            ← Torna alle aree
          </Link>
        </div>
        <h1>Nuova Area</h1>
        <p>Crea una nuova area servizi</p>
      </div>

      <AreaForm isNew />
    </div>
  );
}
