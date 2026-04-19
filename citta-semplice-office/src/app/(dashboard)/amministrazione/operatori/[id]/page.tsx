import { notFound } from 'next/navigation';
import prisma from '@/lib/db/prisma';
import { OperatoreForm } from '../operatore-form';
import Link from 'next/link';

async function getOperatore(id: number) {
  return prisma.operatore.findUnique({
    where: { id },
    include: {
      ruoli: { select: { ruoloId: true } },
    },
  });
}

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

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ModificaOperatorePage({ params }: PageProps) {
  const { id } = await params;
  const operatoreId = parseInt(id, 10);

  if (isNaN(operatoreId)) notFound();

  const [operatore, { ruoli, uffici }] = await Promise.all([
    getOperatore(operatoreId),
    getFormData(),
  ]);

  if (!operatore) notFound();

  return (
    <div>
      <div className="page-header">
        <div className="d-flex align-items-center gap-2 mb-2">
          <Link href="/amministrazione/operatori" className="btn btn-link p-0">
            ← Torna a Operatori
          </Link>
        </div>
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
          ufficioId: operatore.ufficioId,
        }}
        ruoli={ruoli}
        uffici={uffici}
      />
    </div>
  );
}
