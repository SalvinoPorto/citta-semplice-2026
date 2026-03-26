import { notFound } from 'next/navigation';
import prisma from '@/lib/db/prisma';
import { UfficioForm } from '../ufficio-form';
import Link from 'next/link';

async function getUfficio(id: number) {
  return prisma.ufficio.findUnique({
    where: { id },
  });
}

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ModificaUfficioPage({ params }: PageProps) {
  const { id } = await params;
  const ufficioId = parseInt(id, 10);

  if (isNaN(ufficioId)) {
    notFound();
  }

  const ufficio = await getUfficio(ufficioId);

  if (!ufficio) {
    notFound();
  }

  return (
    <div>
      <div className="page-header">
        <div className="d-flex align-items-center gap-2 mb-2">
          <Link href="/amministrazione/uffici" className="btn btn-link p-0">
            ← Torna a Uffici
          </Link>
        </div>
        <h1>Modifica Ufficio</h1>
        <p>{ufficio.nome}</p>
      </div>

      <UfficioForm
        ufficio={{
          id: ufficio.id,
          nome: ufficio.nome,
          descrizione: ufficio.descrizione || '',
          email: ufficio.email || '',
          telefono: ufficio.telefono || '',
          indirizzo: ufficio.indirizzo || '',
          attivo: ufficio.attivo,
        }}
      />
    </div>
  );
}
