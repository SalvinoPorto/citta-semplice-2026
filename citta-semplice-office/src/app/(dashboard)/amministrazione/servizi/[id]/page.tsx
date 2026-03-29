import { notFound } from 'next/navigation';
import prisma from '@/lib/db/prisma';
import { ServizioForm } from '../servizio-form';
import Link from 'next/link';

async function getServizio(id: number) {
  return prisma.servizio.findUnique({
    where: { id },
    include: {
      steps: {
        include: { pagamentoConfig: true, allegatiRichiestiList: true },
        orderBy: { ordine: 'asc' },
      },
      ricevuta: true,
    },
  });
}

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

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ModificaServizioPage({ params }: PageProps) {
  const { id } = await params;
  const servizioId = parseInt(id, 10);

  if (isNaN(servizioId)) {
    notFound();
  }

  const [servizio, { aree, uffici, tributi }] = await Promise.all([
    getServizio(servizioId),
    getFormData(),
  ]);

  if (!servizio) {
    notFound();
  }

  return (
    <div>
      <div className="page-header">
        <div className="d-flex align-items-center gap-2 mb-2">
          <Link href="/amministrazione/servizi" className="btn btn-link p-0">
            ← Torna a Servizi
          </Link>
        </div>
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
          ufficioId: servizio.ufficioId,
          dataInizio: servizio.dataInizio?.toISOString().split('T')[0] ?? '',
          dataFine: servizio.dataFine?.toISOString().split('T')[0] ?? '',
          unicoInvio: servizio.unicoInvio,
          unicoInvioPerUtente: servizio.unicoInvioPerUtente,
          campiUnicoInvio: servizio.campiUnicoInvio || '',
          numeroMaxIstanze: servizio.numeroMaxIstanze,
          msgSopraSoglia: servizio.msgSopraSoglia || '',
          msgExtraServizio: servizio.msgExtraServizio || '',
          campiInEvidenza: servizio.campiInEvidenza || '',
          campiDaEsportare: servizio.campiDaEsportare || '',
          // prevedeDocumentoFinale: servizio.prevedeDocumentoFinale,
          // templateDocumentoFinale: servizio.templateDocumentoFinale || '',
          // nomeDocumentoFinale: servizio.nomeDocumentoFinale || '',
          //moduloTipo: (servizio.moduloTipo as 'HTML' | 'PDF') || 'HTML',
          attributi: servizio.attributi || '',
          postFormValidation: servizio.postFormValidation,
          postFormValidationAPI: servizio.postFormValidationAPI || '',
          postFormValidationFields: servizio.postFormValidationFields || '',
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
            tipoProtocollo: (step.tipoProtocollo as 'E' | 'U' | undefined) || undefined,
            unitaOrganizzativa: step.unitaOrganizzativa || '',
            numerazioneInterna: step.numerazioneInterna,
            pagamentoCodiceTributoId: step.pagamentoConfig?.codiceTributoId ?? null,
            pagamentoImporto: step.pagamentoConfig?.importo ?? null,
            pagamentoImportoVariabile: step.pagamentoConfig?.importoVariabile ?? false,
            pagamentoCausale: step.pagamentoConfig?.causale || '',
            pagamentoCausaleVariabile: step.pagamentoConfig?.causaleVariabile ?? false,
            pagamentoObbligatorio: step.pagamentoConfig?.obbligatorio ?? false,
            pagamentoTipologia: step.pagamentoConfig?.tipologiaPagamento || '',
            allegatiRichiestiList: step.allegatiRichiestiList.map((a) => ({
              id: a.id,
              nomeAllegatoRichiesto: a.nomeAllegatoRichiesto,
              obbligatorio: a.obbligatorio,
              interno: a.interno,
              soggetto: (a.soggetto ?? 'UT') as 'UT' | 'OP',
            })),
          })),
          ricevutaArt18: servizio.ricevuta ? {
            richiestaArt18: servizio.ricevuta.richiestaArt18,
            unitaOrganizzativaCompetente: servizio.ricevuta.unitaOrganizzativaCompetente || '',
            ufficioCompetente: servizio.ricevuta.ufficioCompetente || '',
            responsabileProcedimento: servizio.ricevuta.responsabileProcedimento || '',
            durataMassimaProcedimento: servizio.ricevuta.durataMassimaProcedimento,
            responsabileProvvedimentoFinale: servizio.ricevuta.responsabileProvvedimentoFinale || '',
            personaPotereSostitutivo: servizio.ricevuta.personaPotereSostitutivo || '',
            urlServizioWeb: servizio.ricevuta.urlServizioWeb || '',
            ufficioRicevimento: servizio.ricevuta.ufficioRicevimento || '',
          } : undefined,
        }}
        aree={aree}
        uffici={uffici}
        tributi={tributi}
      />
    </div>
  );
}
