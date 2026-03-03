import prisma from '@/lib/db/prisma';
import { RicercheClient } from './ricerche-client';

async function getServizi() {
  return prisma.servizio.findMany({
    where: { attivo: true },
    orderBy: { titolo: 'asc' },
    select: { id: true, titolo: true },
  });
}

export default async function RicerchePage() {
  const servizi = await getServizi();
  // Map to { id, name } shape expected by RicercheClient
  const moduli = servizi.map((s) => ({ id: s.id, name: s.titolo }));

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
