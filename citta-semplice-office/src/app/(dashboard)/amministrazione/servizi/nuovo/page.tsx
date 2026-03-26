import prisma from '@/lib/db/prisma';
import { ServizioForm } from '../servizio-form';
import Link from 'next/link';

// TODO: sostituire con chiamata API esterna reale
async function getUnitaOrganizzative() {
  return [
    { id: 'UO001', nome: 'Ufficio Protocollo Generale' },
    { id: 'UO002', nome: 'Ufficio Anagrafe' },
    { id: 'UO003', nome: 'Ufficio Tributi' },
    { id: 'UO004', nome: 'Ufficio Edilizia Privata' },
    { id: 'UO005', nome: 'Ufficio Lavori Pubblici' },
  ];
}

async function getFormData() {
  const [aree, uffici, tributi, unitaOrganizzative] = await Promise.all([
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
    getUnitaOrganizzative(),
  ]);

  return { aree, uffici, tributi, unitaOrganizzative };
}

export default async function NuovoServizioPage() {
  const { aree, uffici, tributi, unitaOrganizzative } = await getFormData();

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
        unitaOrganizzative={unitaOrganizzative}
        isNew
      />
    </div>
  );
}
