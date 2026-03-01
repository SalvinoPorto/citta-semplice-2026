import prisma from '@/lib/db/prisma';
import { ServizioForm } from '../servizio-form';

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

export default async function NuovoServizioPage() {
  const aree = await getAree();

  return (
    <div>
      <div className="page-header">
        <h1>Nuovo Servizio</h1>
        <p>Crea un nuovo servizio</p>
      </div>

      <ServizioForm aree={aree} isNew />
    </div>
  );
}
