import { notFound } from 'next/navigation';
import prisma from '@/lib/db/prisma';
import { ModuloForm } from '../modulo-form';

async function getModulo(id: number) {
  return prisma.modulo.findUnique({
    where: { id },
    include: {
      steps: {
        orderBy: { ordine: 'asc' },
      },
    },
  });
}

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

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ModificaModuloPage({ params }: PageProps) {
  const { id } = await params;
  const moduloId = parseInt(id, 10);

  if (isNaN(moduloId)) {
    notFound();
  }

  const [modulo, { servizi, uffici }] = await Promise.all([
    getModulo(moduloId),
    getFormData(),
  ]);

  if (!modulo) {
    notFound();
  }

  return (
    <div>
      <div className="page-header">
        <h1>Modifica Modulo</h1>
        <p>{modulo.name}</p>
      </div>

      <ModuloForm
        modulo={{
          id: modulo.id,
          name: modulo.name,
          slug: modulo.slug,
          description: modulo.description || '',
          tipo: modulo.tipo as 'HTML' | 'PDF',
          nomeFile: modulo.nomeFile || '',
          attributes: modulo.attributes || '',
          corpo: modulo.corpo || '',
          dataInizio: modulo.dataInizio.toISOString().split('T')[0],
          dataFine: modulo.dataFine.toISOString().split('T')[0],
          attivo: modulo.attivo,
          campiInEvidenza: modulo.campiInEvidenza || '',
          campiDaEsportare: modulo.campiDaEsportare || '',
          unicoInvio: modulo.unicoInvio,
          unicoInvioPerUtente: modulo.unicoInvioPerUtente,
          campiUnicoInvio: modulo.campiUnicoInvio || '',
          numeroMaxIstanze: modulo.numeroMaxIstanze,
          avvisoSoglia: modulo.avvisoSoglia,
          msgExtraModulo: modulo.msgExtraModulo || '',
          prevedeDocumentoFinale: modulo.prevedeDocumentoFinale,
          templateDocumentoFinale: modulo.templateDocumentoFinale || '',
          nomeDocumentoFinale: modulo.nomeDocumentoFinale || '',
          servizioId: modulo.servizioId,
          ufficioId: modulo.ufficioId,
          steps: modulo.steps.map((step) => ({
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
        servizi={servizi}
        uffici={uffici}
      />
    </div>
  );
}
