import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireAdmin } from '@/lib/auth/session';
import { getRuolo } from '../actions';
import { RuoloForm } from '../ruolo-form';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function ModificaRuoloPage({ params }: Props) {
  await requireAdmin();
  const { id } = await params;
  const { data: ruolo } = await getRuolo(parseInt(id));

  if (!ruolo) notFound();

  return (
    <div>
      <div className="page-header">
        <div className="d-flex align-items-center gap-2 mb-2">
          <Link href="/amministrazione/ruoli" className="btn btn-link p-0">
            ← Torna ai ruoli
          </Link>
        </div>
        <h1>Modifica Ruolo</h1>
        <p>{ruolo.nome}</p>
      </div>

      <RuoloForm
        initialData={{
          id: ruolo.id,
          nome: ruolo.nome,
          descrizione: ruolo.descrizione || '',
          permessi: ruolo.permessi,
        }}
      />
    </div>
  );
}
