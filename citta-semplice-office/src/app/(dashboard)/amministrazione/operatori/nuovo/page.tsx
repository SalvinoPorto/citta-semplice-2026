import prisma from '@/lib/db/prisma';
import { OperatoreForm } from '../operatore-form';
import Link from 'next/link';

async function getFormData() {
  const [ruoli, uffici] = await Promise.all([
    prisma.ruolo.findMany({ orderBy: { nome: 'asc' } }),
    prisma.ufficio.findMany({
      where: { attivo: true },
      select: { id: true, nome: true },
      orderBy: { nome: 'asc' },
    }),
  ]);
  return { ruoli, uffici };
}

export default async function NuovoOperatorePage() {
  const { ruoli, uffici } = await getFormData();

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
        uffici={uffici}
        isNew={true}
      />
    </div>
  );
}
