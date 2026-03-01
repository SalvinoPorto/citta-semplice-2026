import prisma from '@/lib/db/prisma';
import { requireAuth } from '@/lib/auth/session';
import { IstanzeClient } from './istanze-client';

async function getModuli() {
  return prisma.modulo.findMany({
    where: { attivo: true },
    orderBy: { name: 'asc' },
    select: { id: true, name: true, campiInEvidenza: true },
  });
}

export default async function IstanzePage() {
  const user = await requireAuth();
  const operatoreId = parseInt(user.id);
  const moduli = await getModuli();

  return (
    <>
      <div className="page-header">
        <h1>Istanze</h1>
        <p>Gestione delle istanze degli utenti</p>
      </div>
      <IstanzeClient moduli={moduli} operatoreId={operatoreId} />
    </>
  );
}
