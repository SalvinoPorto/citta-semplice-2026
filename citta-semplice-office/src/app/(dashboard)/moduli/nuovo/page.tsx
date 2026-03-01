import prisma from '@/lib/db/prisma';
import { ModuloForm } from '../modulo-form';

async function getFormData() {
  const [servizi, uffici] = await Promise.all([
    prisma.servizio.findMany({
      where: { attivo: true },
      orderBy: { titolo: 'asc' },
      include: {
        area: {
          select: { titolo: true },
        },
      },
    }),
    prisma.ufficio.findMany({
      where: { attivo: true },
      orderBy: { nome: 'asc' },
      select: { id: true, nome: true },
    }),
  ]);

  return { servizi, uffici };
}

export default async function NuovoModuloPage() {
  const { servizi, uffici } = await getFormData();

  return (
    <div>
      <div className="page-header">
        <h1>Nuovo Modulo</h1>
        <p>Crea un nuovo modulo/template form</p>
      </div>

      <ModuloForm servizi={servizi} uffici={uffici} isNew />
    </div>
  );
}
