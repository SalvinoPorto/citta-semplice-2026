import prisma from '@/lib/db/prisma';
import { OperatoreForm } from '../operatore-form';

async function getFormData() {
  const [ruoli, enti, moduli] = await Promise.all([
    prisma.ruolo.findMany({ orderBy: { nome: 'asc' } }),
    prisma.ente.findMany({ where: { attivo: true }, orderBy: { ente: 'asc' } }),
    prisma.modulo.findMany({
      where: { attivo: true },
      orderBy: { name: 'asc' },
      select: { id: true, name: true }
    }),
  ]);

  return { ruoli, enti, moduli };
}

export default async function NuovoOperatorePage() {
  const { ruoli, enti, moduli } = await getFormData();

  return (
    <div>
      <div className="page-header">
        <h1>Nuovo Operatore</h1>
        <p>Crea un nuovo operatore del sistema</p>
      </div>

      <OperatoreForm
        ruoli={ruoli}
        enti={enti}
        moduli={moduli}
        isNew
      />
    </div>
  );
}
