import prisma from '@/lib/db/prisma';
import { ServizioForm } from '../servizio-form';
import Link from 'next/link';

async function getFormData() {
  const [aree, uffici, tributi] = await Promise.all([
    prisma.area.findMany({
      where: { attiva: true },
      orderBy: { nome: 'asc' },
      select: { id: true, nome: true },
    }),
    prisma.ufficio.findMany({
      where: { attivo: true },
      orderBy: { nome: 'asc' },
      select: { id: true, nome: true },
    }),
    prisma.tributo.findMany({
      where: { attivo: true },
      orderBy: { codice: 'asc' },
      select: { id: true, codice: true, descrizione: true },
    }),
  ]);

  return { aree, uffici, tributi };
}

export default async function NuovoServizioPage() {
  const { aree, uffici, tributi } = await getFormData();

  return (
    <div>
      <div className="page-header">
        <div className="d-flex align-items-center gap-2 mb-2">
          <Link href="/amministrazione/servizi" className="btn btn-link p-0">
            ← Torna a Servizi
          </Link>
        </div>
        <h1>Nuovo Servizio</h1>
        <p>Crea un nuovo servizio</p>
      </div>

      <ServizioForm
        aree={aree}
        uffici={uffici}
        tributi={tributi}
        isNew
      />
    </div>
  );
}
