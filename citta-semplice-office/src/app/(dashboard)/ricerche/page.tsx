import prisma from '@/lib/db/prisma';
import { requireAuth } from '@/lib/auth/session';
import { getVisibilitaOperatore, servizioVisibilityWhere, type VisibilitaOperatore } from '@/lib/auth/visibilita';
import { RicercheClient } from './ricerche-client';

async function getServizi(visibilita: VisibilitaOperatore) {
  return prisma.servizio.findMany({
    where: { attivo: true, AND: [servizioVisibilityWhere(visibilita)] },
    orderBy: { titolo: 'asc' },
    select: { id: true, titolo: true },
  });
}

export default async function RicerchePage() {
  const user = await requireAuth();
  const visibilita = await getVisibilitaOperatore(parseInt(user.id), user.ruoli);
  const servizi = await getServizi(visibilita);

  return (
    <div>
      <div className="page-header">
        <h1>Ricerche</h1>
        <p>Ricerca avanzata e esportazione dati</p>
      </div>

      <RicercheClient servizi={servizi} />
    </div>
  );
}
