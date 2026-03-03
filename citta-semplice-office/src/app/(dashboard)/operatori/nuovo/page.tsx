import prisma from '@/lib/db/prisma';
import { OperatoreForm } from '../operatore-form';

async function getFormData() {
  const [ruoli, servizi] = await Promise.all([
    prisma.ruolo.findMany({ orderBy: { nome: 'asc' } }),
    prisma.servizio.findMany({
      where: { attivo: true },
      orderBy: { titolo: 'asc' },
      select: { id: true, titolo: true }
    }),
  ]);

  const moduli = servizi.map((s) => ({ id: s.id, name: s.titolo }));

  return { ruoli, enti: [], moduli };
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
