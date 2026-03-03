import prisma from '@/lib/db/prisma';
import { requireAuth } from '@/lib/auth/session';
import { IstanzeClient } from './istanze-client';

async function getServizi() {
  return prisma.servizio.findMany({
    where: { attivo: true },
    orderBy: { titolo: 'asc' },
    select: { id: true, titolo: true, campiInEvidenza: true },
  });
}

export default async function IstanzePage() {
  const user = await requireAuth();
  const operatoreId = parseInt(user.id);
  const servizi = await getServizi();

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
