import { notFound } from 'next/navigation';
import prisma from '@/lib/db/prisma';
import { ServizioForm } from '../servizio-form';

async function getServizio(id: number) {
  return prisma.servizio.findUnique({
    where: { id },
  });
}

async function getAree() {
  return prisma.area.findMany({
    where: { attiva: true },
    orderBy: { titolo: 'asc' },
    include: {
      ente: {
        select: { ente: true },
      },
    },
  });
}

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ModificaServizioPage({ params }: PageProps) {
  const { id } = await params;
  const servizioId = parseInt(id, 10);

  if (isNaN(servizioId)) {
    notFound();
  }

  const [servizio, aree] = await Promise.all([
    getServizio(servizioId),
    getAree(),
  ]);

  if (!servizio) {
    notFound();
  }

  return (
    <div>
      <div className="page-header">
        <h1>Modifica Servizio</h1>
        <p>{servizio.titolo}</p>
      </div>

      <ServizioForm
        servizio={{
          id: servizio.id,
          titolo: servizio.titolo,
          descrizione: servizio.descrizione || '',
          icona: servizio.icona || '',
          ordine: servizio.ordine,
          attivo: servizio.attivo,
          areaId: servizio.areaId,
        }}
        aree={aree}
      />
    </div>
  );
}
