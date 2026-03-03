import { notFound } from 'next/navigation';
import prisma from '@/lib/db/prisma';
import { OperatoreForm } from '../operatore-form';

async function getOperatore(id: number) {
  const operatore = await prisma.operatore.findUnique({
    where: { id },
    include: {
      ruoli: { select: { ruoloId: true } },
      servizi: { select: { servizioId: true } },
    },
  });

  return operatore;
}

async function getFormData() {
  const [ruoli, servizi] = await Promise.all([
    prisma.ruolo.findMany({ orderBy: { nome: 'asc' } }),
    prisma.servizio.findMany({
      where: { attivo: true },
      orderBy: { titolo: 'asc' },
      select: { id: true, titolo: true }
    }),
  ]);

  // Map servizi to { id, name } shape expected by OperatoreForm
  const moduli = servizi.map((s) => ({ id: s.id, name: s.titolo }));

  return { ruoli, enti: [], moduli };
}

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ModificaOperatorePage({ params }: PageProps) {
  const { id } = await params;
  const operatoreId = parseInt(id, 10);

  if (isNaN(operatoreId)) {
    notFound();
  }

  const [operatore, { ruoli, enti, moduli }] = await Promise.all([
    getOperatore(operatoreId),
    getFormData(),
  ]);

  if (!operatore) {
    notFound();
  }

  return (
    <div>
      <div className="page-header">
        <h1>Modifica Operatore</h1>
        <p>{operatore.nome} {operatore.cognome}</p>
      </div>

      <OperatoreForm
        operatore={{
          id: operatore.id,
          email: operatore.email,
          nome: operatore.nome,
          cognome: operatore.cognome,
          codiceFiscale: operatore.codiceFiscale || '',
          telefono: operatore.telefono || '',
          attivo: operatore.attivo,
          ruoliIds: operatore.ruoli.map((r) => r.ruoloId),
          entiIds: [],
          moduliIds: operatore.servizi.map((s) => s.servizioId),
        }}
        ruoli={ruoli}
        enti={enti}
        moduli={moduli}
      />
    </div>
  );
}
