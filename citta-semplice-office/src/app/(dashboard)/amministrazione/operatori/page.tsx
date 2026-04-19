import Link from 'next/link';
import prisma from '@/lib/db/prisma';
import { requireAdmin } from '@/lib/auth/session';
import { OperatoriClient } from './operatori-client';

async function getOperatori() {
  return prisma.operatore.findMany({
    orderBy: { cognome: 'asc' },
    include: {
      ruoli: { include: { ruolo: true } },
      ufficio: { select: { id: true, nome: true } },
    },
  });
}

export default async function OperatoriPage() {
  await requireAdmin();
  const operatori = await getOperatori();

  return (
    <div>
      <Link href="/amministrazione" className="btn btn-link p-0 mb-2">
        ← Torna ad Amministrazione
      </Link>
      <div className="page-header d-flex justify-content-between align-items-start">
        <div>
          <h1>Operatori</h1>
          <p>Gestione degli operatori del sistema</p>
        </div>
        <Link href="/amministrazione/operatori/nuovo" className="btn btn-primary">
          Nuovo Operatore
        </Link>
      </div>

      <OperatoriClient operatori={operatori} />
    </div>
  );
}
