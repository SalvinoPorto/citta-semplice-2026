import Link from 'next/link';
import prisma from '@/lib/db/prisma';
import { requireAdmin } from '@/lib/auth/session';
import { ServiziTable } from './servizi-table';

interface SearchParams {
  area?: string;
}

async function getAree() {
  return prisma.area.findMany({
    where: { attiva: true },
    orderBy: { nome: 'asc' },
  });
}

export default async function ServiziPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await requireAdmin();
  const { area } = await searchParams;
  const areaId = area ? parseInt(area) : 0;
  const aree = await getAree();

  return (
    <div>
      <Link href="/amministrazione" className="btn btn-link p-0 mb-2">
        ← Torna ad Amministrazione
      </Link>
      <div className="page-header d-flex justify-content-between align-items-start">
        <div>
          <h1>Servizi</h1>
          <p>Gestione dei servizi offerti</p>
        </div>
        <Link href="/amministrazione/servizi/nuovo" className="btn btn-primary">
          Nuovo Servizio
        </Link>
      </div>
      <ServiziTable areaId={areaId} aree={aree} />
    </div>
  );
}
