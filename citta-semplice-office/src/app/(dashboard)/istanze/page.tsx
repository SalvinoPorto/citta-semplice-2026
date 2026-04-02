import prisma from '@/lib/db/prisma';
import { requireAuth } from '@/lib/auth/session';
import { ROLES } from '@/lib/auth/roles';
import { IstanzeClient } from './istanze-client';

async function getServizi(operatoreId: number, isAdmin: boolean) {
  return prisma.servizio.findMany({
    where: {
      attivo: true,
      ...(!isAdmin && { operatori: { some: { operatoreId } } }),
    },
    orderBy: { titolo: 'asc' },
    select: { id: true, titolo: true, campiInEvidenza: true },
  });
}

export default async function IstanzePage() {
  const user = await requireAuth();
  const operatoreId = parseInt(user.id);
  const isAdmin = (user.ruoli ?? []).includes(ROLES.ADMIN);
  const servizi = await getServizi(operatoreId, isAdmin);

  return (
    <>
      <div className="page-header">
        <h1>Istanze</h1>
        <p>Gestione delle istanze degli utenti</p>
      </div>
      <IstanzeClient servizi={servizi} operatoreId={operatoreId} />
    </>
  );
}
