import prisma from '@/lib/db/prisma';
import { RicercheClient } from './ricerche-client';

async function getModuli() {
  return prisma.modulo.findMany({
    where: { attivo: true },
    orderBy: { name: 'asc' },
    select: { id: true, name: true },
  });
}

export default async function RicerchePage() {
  const moduli = await getModuli();

  return (
    <div>
      <div className="page-header">
        <h1>Ricerche</h1>
        <p>Ricerca avanzata e esportazione dati</p>
      </div>

      <RicercheClient moduli={moduli} />
    </div>
  );
}
