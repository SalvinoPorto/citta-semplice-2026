import prisma from '@/lib/db/prisma';
import { AreaForm } from '../area-form';

async function getEnti() {
  return prisma.ente.findMany({
    where: { attivo: true },
    orderBy: { ente: 'asc' },
    select: { id: true, ente: true },
  });
}

export default async function NuovaAreaPage() {
  const enti = await getEnti();

  return (
    <div>
      <div className="page-header">
        <h1>Nuova Area</h1>
        <p>Crea una nuova area servizi</p>
      </div>

      <AreaForm enti={enti} isNew />
    </div>
  );
}
