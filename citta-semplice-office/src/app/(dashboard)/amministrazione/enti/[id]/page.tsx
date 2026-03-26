import { notFound } from 'next/navigation';
import prisma from '@/lib/db/prisma';
import { EnteForm } from '../ente-form';
import Link from 'next/link';

async function getEnte(id: number) {
  return prisma.ente.findUnique({
    where: { id },
  });
}

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ModificaEntePage({ params }: PageProps) {
  const { id } = await params;
  const enteId = parseInt(id, 10);

  if (isNaN(enteId)) {
    notFound();
  }

  const ente = await getEnte(enteId);

  if (!ente) {
    notFound();
  }

  return (
    <div>
      <Link href="/amministrazione/enti" className="btn btn-link p-0 mb-2">
        ← Torna agli enti
      </Link>
      <div className="page-header d-flex justify-content-between align-items-start">
        <h1>Modifica Ente</h1>
        <p>{ente.nome}</p>
      </div>

      <EnteForm
        ente={{
          id: ente.id,
          nome: ente.nome,
          descrizione: ente.descrizione || '',
          indirizzo: ente.indirizzo || '',
          telefono: ente.telefono || '',
          email: ente.email || '',
          pec: ente.pec || '',
          logo: ente.logo || '',
          attivo: ente.attivo,
        }}
      />
    </div>
  );
}
