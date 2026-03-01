import { notFound } from 'next/navigation';
import prisma from '@/lib/db/prisma';
import { UfficioForm } from '../ufficio-form';

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
