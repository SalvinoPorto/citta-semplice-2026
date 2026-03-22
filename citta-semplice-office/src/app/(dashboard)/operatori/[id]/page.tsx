import { notFound } from 'next/navigation';
import prisma from '@/lib/db/prisma';
import { OperatoreForm } from '../operatore-form';

async function getOperatore(id: number) {
  return prisma.operatore.findUnique({
    where: { id },
    include: {
      ruoli: { select: { ruoloId: true } },
      servizi: { select: { servizioId: true } },
    },
  });
}

async function getFormData() {
  const [ruoli, servizi] = await Promise.all([
    prisma.ruolo.findMany({ orderBy: { nome: 'asc' } }),
    prisma.servizio.findMany({
      where: { attivo: true },
      select: { id: true, titolo: true, area: { select: { nome: true } } },
      orderBy: [{ area: { nome: 'asc' } }, { titolo: 'asc' }],
    }),
  ]);
  return { ruoli, servizi };
}

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ModificaOperatorePage({ params }: PageProps) {
  const { id } = await params;
  const operatoreId = parseInt(id, 10);

  if (isNaN(operatoreId)) notFound();

  const [operatore, { ruoli, servizi }] = await Promise.all([
    getOperatore(operatoreId),
    getFormData(),
  ]);

  if (!operatore) notFound();

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
          userName: operatore.userName,
          nome: operatore.nome,
          cognome: operatore.cognome,
          telefono: operatore.telefono || '',
          attivo: operatore.attivo,
          ruoliIds: operatore.ruoli.map((r) => r.ruoloId),
          serviziIds: operatore.servizi.map((s) => s.servizioId),
        }}
        ruoli={ruoli}
        servizi={servizi}
      />
    </div>
  );
}
