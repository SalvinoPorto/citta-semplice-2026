import { Suspense } from 'react';
import prisma from '@/lib/db/prisma';
import { requireAuth } from '@/lib/auth/session';
import { getVisibilitaOperatore, servizioVisibilityWhere, type VisibilitaOperatore } from '@/lib/auth/visibilita';
import { IstanzeClient } from './istanze-client';

async function getServizi(visibilita: VisibilitaOperatore) {
  return prisma.servizio.findMany({
    where: {
      attivo: true,
      OR: [{ dataFine: null }, { dataFine: { gte: new Date() } }],
      AND: [servizioVisibilityWhere(visibilita)],
    },
    orderBy: { titolo: 'asc' },
    select: { id: true, titolo: true, campiInEvidenza: true },
  });
}

export default async function IstanzePage() {
  const user = await requireAuth();
  const visibilita = await getVisibilitaOperatore(parseInt(user.id), user.ruoli);
  const [servizi, uffici] = await Promise.all([
    getServizi(visibilita),
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
        <p>Gestione istanze</p>
      </div>
      <Suspense>
        <IstanzeClient servizi={servizi} uffici={uffici} />
      </Suspense>
    </>
  );
}
