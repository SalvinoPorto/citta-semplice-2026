import { notFound } from 'next/navigation';
import prisma from '@/lib/db/prisma';
import { AreaForm } from '../area-form';

async function getArea(id: number) {
  return prisma.area.findUnique({
    where: { id },
  });
}

async function getEnti() {
  return prisma.ente.findMany({
    where: { attivo: true },
    orderBy: { ente: 'asc' },
    select: { id: true, ente: true },
  });
}

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ModificaAreaPage({ params }: PageProps) {
  const { id } = await params;
  const areaId = parseInt(id, 10);

  if (isNaN(areaId)) {
    notFound();
  }

  const [area, enti] = await Promise.all([
    getArea(areaId),
    getEnti(),
  ]);

  if (!area) {
    notFound();
  }

  return (
    <div>
      <div className="page-header">
        <h1>Modifica Area</h1>
        <p>{area.titolo}</p>
      </div>

      <AreaForm
        area={{
          id: area.id,
          titolo: area.titolo,
          descrizione: area.descrizione || '',
          icona: area.icona || '',
          ordine: area.ordine,
          attiva: area.attiva,
          enteId: area.enteId,
        }}
        enti={enti}
      />
    </div>
  );
}
