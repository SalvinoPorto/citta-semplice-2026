import prisma from '@/lib/db/prisma';
import { ServizioForm } from '../servizio-form';

async function getFormData() {
  const [aree, moduli, uffici] = await Promise.all([
    prisma.area.findMany({
      where: { attiva: true },
      orderBy: { titolo: 'asc' },
      select: { id: true, titolo: true },
    }),
    prisma.modulo.findMany({
      where: { attivo: true },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, tipo: true },
    }),
    prisma.ufficio.findMany({
      where: { attivo: true },
      orderBy: { nome: 'asc' },
      select: { id: true, nome: true },
    }),
  ]);

  return { aree, moduli, uffici };
}

export default async function NuovoServizioPage() {
  const { aree, moduli, uffici } = await getFormData();

  return (
    <div>
      <div className="page-header">
        <h1>Nuovo Servizio</h1>
        <p>Crea un nuovo servizio</p>
      </div>

      <ServizioForm aree={aree} moduli={moduli} uffici={uffici} isNew />
    </div>
  );
}
