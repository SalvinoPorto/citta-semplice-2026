import { notFound } from 'next/navigation';
import prisma from '@/lib/db/prisma';
import { AreaForm } from '../area-form';
import Link from 'next/link';

async function getArea(id: number) {
  return prisma.area.findUnique({
    where: { id },
  });
}

async function getEnti() {
  return prisma.ente.findMany({
    where: { attivo: true },
    orderBy: { nome: 'asc' },
    select: { id: true, nome: true },
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

  const area = await getArea(areaId);

  if (!area) {
    notFound();
  }

  return (
    <div>
      <div className="page-header">
        <div className="d-flex align-items-center gap-2 mb-2">
          <Link href="/amministrazione/aree" className="btn btn-link p-0">
            ← Torna alle aree
          </Link>
        </div>
        <h1>Modifica Area</h1>
        <p>{area.nome}</p>
      </div>

      <AreaForm
        area={{
          id: area.id,
          nome: area.nome,
          descrizione: area.descrizione || '',
          icona: area.icona || '',
          ordine: area.ordine,
          attiva: area.attiva
        }}
      />
    </div>
  );
}
