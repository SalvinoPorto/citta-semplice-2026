import { Suspense } from 'react';
import prisma from '@/lib/db/prisma';
import { requireAuth } from '@/lib/auth/session';
import { ROLES } from '@/lib/auth/roles';
import { IstanzeClient } from './istanze-client';

async function getServizi(operatoreId: number, isAdmin: boolean) {
  const ufficioId = isAdmin ? null : (await prisma.operatore.findUnique({
    where: { id: operatoreId },
    select: { ufficioId: true },
  }))?.ufficioId ?? null;

  return prisma.servizio.findMany({
    where: {
      attivo: true,
      OR: [{ dataFine: null }, { dataFine: { gte: new Date() } }],
      ...(!isAdmin && ufficioId && { fasi: { some: { ufficioId } } }),
    },
    orderBy: { titolo: 'asc' },
    select: { id: true, titolo: true, campiInEvidenza: true },
  });
}

export default async function IstanzePage() {
  const user = await requireAuth();
  const operatoreId = parseInt(user.id);
  const isAdmin = (user.ruoli ?? []).includes(ROLES.ADMIN);
  const [servizi, uffici] = await Promise.all([
    getServizi(operatoreId, isAdmin),
    prisma.ufficio.findMany({
      where: { attivo: true },
      select: { id: true, nome: true },
      orderBy: { nome: 'asc' },
    }),
  ]);

  return (
    <>
      <div className="page-header">
        <h1>Istanze</h1>
        <p>Gestione delle istanze degli utenti</p>
      </div>
      <Suspense>
        <IstanzeClient servizi={servizi} uffici={uffici} />
      </Suspense>
    </>
  );
}
