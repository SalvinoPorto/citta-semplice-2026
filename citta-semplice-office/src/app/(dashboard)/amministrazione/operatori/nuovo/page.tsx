import prisma from '@/lib/db/prisma';
import { OperatoreForm } from '../operatore-form';
import Link from 'next/link';

async function getFormData() {
  const [ruoli, servizi] = await Promise.all([
    prisma.ruolo.findMany({ orderBy: { nome: 'asc' } }),
    prisma.servizio.findMany({
      where: { attivo: true },
      orderBy: { titolo: 'asc' },
      select: { id: true, titolo: true, area: { select: { nome: true } } },
      //orderBy: [{ area: { nome: 'asc' } }, { titolo: 'asc' }]
    }),
  ]);

  return { ruoli, servizi };
}

export default async function NuovoOperatorePage() {
  const { ruoli, servizi } = await getFormData();

  return (
    <div>
      <Link href="/amministrazione/operatori" className="btn btn-link p-0 mb-2">
        ← Torna a Operatori
      </Link>
      <div className="page-header">
        <h1>Nuovo Operatore</h1>
        <p>Crea un nuovo operatore del sistema</p>
      </div>

      <OperatoreForm
        ruoli={ruoli}
        servizi={servizi}
        isNew={true}
      />
    </div>
  );
}
