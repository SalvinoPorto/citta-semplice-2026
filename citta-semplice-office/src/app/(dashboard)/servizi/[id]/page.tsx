import { notFound } from 'next/navigation';
import prisma from '@/lib/db/prisma';
import { ServizioForm } from '../servizio-form';

async function getServizio(id: number) {
  return prisma.servizio.findUnique({
    where: { id },
    include: {
      steps: { orderBy: { ordine: 'asc' } },
    },
  });
}

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

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ModificaServizioPage({ params }: PageProps) {
  const { id } = await params;
  const servizioId = parseInt(id, 10);

  if (isNaN(servizioId)) {
    notFound();
  }

  const [servizio, { aree, moduli, uffici, unitaOrganizzative, serviziPagamento }] = await Promise.all([
    getServizio(servizioId),
    getFormData(),
  ]);

  if (!servizio) {
    notFound();
  }

  return (
    <div>
      <div className="page-header">
        <h1>Modifica Servizio</h1>
        <p>{servizio.titolo}</p>
      </div>

      <ServizioForm
        servizio={{
          id: servizio.id,
          titolo: servizio.titolo,
          sottoTitolo: servizio.sottoTitolo || '',
          descrizione: servizio.descrizione || '',
          comeFare: servizio.comeFare || '',
          cosaServe: servizio.cosaServe || '',
          altreInfo: servizio.altreInfo || '',
          contatti: servizio.contatti || '',
          slug: servizio.slug || '',
          icona: servizio.icona || '',
          ordine: servizio.ordine,
          attivo: servizio.attivo,
          areaId: servizio.areaId,
          moduloId: servizio.moduloId,
          ufficioId: servizio.ufficioId,
          dataInizio: servizio.dataInizio?.toISOString().split('T')[0] ?? '',
          dataFine: servizio.dataFine?.toISOString().split('T')[0] ?? '',
          unicoInvio: servizio.unicoInvio,
          unicoInvioPerUtente: servizio.unicoInvioPerUtente,
          campiUnicoInvio: servizio.campiUnicoInvio || '',
          numeroMaxIstanze: servizio.numeroMaxIstanze,
          avvisoSoglia: servizio.avvisoSoglia,
          msgExtraServizio: servizio.msgExtraServizio || '',
          campiInEvidenza: servizio.campiInEvidenza || '',
          campiDaEsportare: servizio.campiDaEsportare || '',
          prevedeDocumentoFinale: servizio.prevedeDocumentoFinale,
          templateDocumentoFinale: servizio.templateDocumentoFinale || '',
          nomeDocumentoFinale: servizio.nomeDocumentoFinale || '',
          steps: servizio.steps.map((step) => ({
            id: step.id,
            descrizione: step.descrizione,
            ordine: step.ordine,
            attivo: step.attivo,
            pagamento: step.pagamento,
            allegati: step.allegati,
            allegatiOp: step.allegatiOp,
            allegatiRequired: step.allegatiRequired,
            allegatiOpRequired: step.allegatiOpRequired,
            protocollo: step.protocollo,
            unitaOrganizzativa: step.unitaOrganizzativa || '',
          })),
        }}
        aree={aree}
        moduli={moduli}
        uffici={uffici}
        unitaOrganizzative={unitaOrganizzative}
        serviziPagamento={serviziPagamento}
      />
    </div>
  );
}
