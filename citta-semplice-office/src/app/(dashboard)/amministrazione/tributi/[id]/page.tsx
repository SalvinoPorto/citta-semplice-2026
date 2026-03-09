import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireAdmin } from '@/lib/auth/session';
import { getTributo } from '../actions';
import { TributoForm } from '../tributo-form';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function ModificaTributoPage({ params }: Props) {
  await requireAdmin();
  const { id } = await params;
  const { data: tributo } = await getTributo(parseInt(id));

  if (!tributo) notFound();

  return (
    <div>
      <div className="page-header">
        <div className="d-flex align-items-center gap-2 mb-2">
          <Link href="/amministrazione/tributi" className="btn btn-link p-0">
            ← Torna ai tributi
          </Link>
        </div>
        <h1>Modifica Tributo</h1>
        <p>
          Codice: <code>{tributo.codice}</code>
        </p>
      </div>

      <TributoForm
        initialData={{
          id: tributo.id,
          codice: tributo.codice,
          descrizione: tributo.descrizione || '',
          attivo: tributo.attivo,
        }}
      />
    </div>
  );
}
