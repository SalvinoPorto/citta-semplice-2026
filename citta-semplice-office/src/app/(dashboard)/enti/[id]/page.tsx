import { notFound } from 'next/navigation';
import prisma from '@/lib/db/prisma';
import { EnteForm } from '../ente-form';

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
      <div className="page-header">
        <h1>Modifica Ente</h1>
        <p>{ente.ente}</p>
      </div>

      <EnteForm
        ente={{
          id: ente.id,
          ente: ente.ente,
          descrizione: ente.descrizione || '',
          codiceFiscale: ente.codiceFiscale || '',
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
