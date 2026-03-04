import prisma from '@/lib/db/prisma';
import { ServizioForm } from '../servizio-form';

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

// TODO: sostituire con chiamata API esterna reale
async function getServiziPagamento() {
  return [
    { id: 'PAY001', nome: 'PagoPA - Gateway Nazionale' },
    { id: 'PAY002', nome: 'MyPay' },
    { id: 'PAY003', nome: 'Telemaco' },
  ];
}

async function getFormData() {
  const [aree, moduli, uffici, unitaOrganizzative, serviziPagamento] = await Promise.all([
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
    getUnitaOrganizzative(),
    getServiziPagamento(),
  ]);

  return { aree, moduli, uffici, unitaOrganizzative, serviziPagamento };
}

export default async function NuovoServizioPage() {
  const { aree, moduli, uffici, unitaOrganizzative, serviziPagamento } = await getFormData();

  return (
    <div>
      <div className="page-header">
        <h1>Nuovo Servizio</h1>
        <p>Crea un nuovo servizio</p>
      </div>

      <ServizioForm
        aree={aree}
        moduli={moduli}
        uffici={uffici}
        unitaOrganizzative={unitaOrganizzative}
        serviziPagamento={serviziPagamento}
        isNew
      />
    </div>
  );
}
