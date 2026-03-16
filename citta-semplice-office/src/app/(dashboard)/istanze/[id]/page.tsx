import { notFound } from 'next/navigation';
import Link from 'next/link';
import prisma from '@/lib/db/prisma';
import { getCurrentUser } from '@/lib/auth/session';
import { Card, CardBody, CardTitle, Badge } from '@/components/ui';
import { WorkflowTimeline } from './workflow-timeline';
import { AllegatiList } from './allegati-list';
import { IstanzaActions } from './istanza-actions';
import { AltreIstanzeModal } from './altre-istanze-modal';
import { ASSIGNEDTO } from '@/lib/models/assigned-to';

async function getIstanza(id: number) {
  const istanza = await prisma.istanza.findUnique({
    where: { id },
    include: {
      utente: true,
      servizio: {
        include: {
          area: true,
          ufficio: true,
          steps: {
            where: { attivo: true },
            orderBy: { ordine: 'asc' },
            include: { pagamentoConfig: true },
          },
        },
      },
      workflows: {
        include: {
          status: true,
          step: {
            include: { pagamentoConfig: true },
          },
          notifica: true,
          operatore: {
            select: { id: true, nome: true, cognome: true },
          },
          allegati: true,
          pagamentoEffettuato: true,
          comunicazione: {
            include: {
              risposta: {
                include: {
                  allegati: {
                    select: { id: true, nomeFile: true },
                  },
                },
              },
            },
          },
        },
        orderBy: { id: 'desc' },
      },
    },
  });

  return istanza;
}

export default async function IstanzaDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: idParam } = await params;
  const id = parseInt(idParam);
  if (isNaN(id)) {
    notFound();
  }

  const user = await getCurrentUser();
  if (!user) {
    return <div>Non autorizzato</div>;
  }

  const operatoreId = parseInt(user.id);

  const istanza = await getIstanza(id);

  if (!istanza) {
    notFound();
  }

  const lastWorkflow = istanza.workflows[0];
  const assignedTo = lastWorkflow === undefined ? ASSIGNEDTO.NOONE : lastWorkflow?.operatore?.id === operatoreId ? ASSIGNEDTO.ME : ASSIGNEDTO.OTHER;
  const dati = istanza.dati ? JSON.parse(istanza.dati) : {};

  // Informazioni sullo step corrente
  const currentStep = lastWorkflow?.step ?? null;
  const stepPagamentoConfig = currentStep?.pagamentoConfig ?? null;
  const steps = istanza.servizio.steps;
  const lastStepOrdine = steps.length > 0 ? steps[steps.length - 1].ordine : 0;
  const isLastStep = currentStep ? currentStep.ordine === lastStepOrdine : false;

  const getStatusBadge = () => {
    if (istanza.conclusa) {
      return <Badge variant="success">Conclusa</Badge>;
    }
    if (istanza.respinta) {
      return <Badge variant="danger">Respinta</Badge>;
    }
    if (assignedTo === ASSIGNEDTO.NOONE) {
      return <Badge variant='warning'>In Attesa</Badge>;
    }
    return <Badge variant="warning">In Lavorazione</Badge>;
  };

  return (
    <div>
      {/* Header */}
      <div className="page-header d-flex justify-content-between align-items-start">
        <div>
          <div className="d-flex align-items-center gap-2 mb-2">
            <Link href="/istanze" className="btn btn-link p-0">
              ← Torna alle istanze
            </Link>
          </div>
          <h1 className="d-flex align-items-center gap-3">
            Istanza #{istanza.id}
            {getStatusBadge()}
          </h1>
          <p>
            {istanza.servizio.titolo}
          </p>
        </div>
        <IstanzaActions
          istanza={{
            id: istanza.id,
            conclusa: istanza.conclusa,
            respinta: istanza.respinta,
            protoNumero: istanza.protoNumero,
            protoData: istanza.protoData,
            attributoId: null,
          }}
          utente={{
            email: istanza.utente.email,
            nome: istanza.utente.nome,
            cognome: istanza.utente.cognome,
          }}
          assignedTo={assignedTo}
          currentStep={currentStep ? {
            id: currentStep.id,
            descrizione: currentStep.descrizione,
            ordine: currentStep.ordine,
            protocollo: currentStep.protocollo,
            tipoProtocollo: currentStep.tipoProtocollo,
            unitaOrganizzativa: currentStep.unitaOrganizzativa,
            pagamento: currentStep.pagamento,
            pagamentoConfig: stepPagamentoConfig ? {
              importo: stepPagamentoConfig.importo,
              importoVariabile: stepPagamentoConfig.importoVariabile,
              causale: stepPagamentoConfig.causale,
              causaleVariabile: stepPagamentoConfig.causaleVariabile,
              obbligatorio: stepPagamentoConfig.obbligatorio,
            } : null,
          } : null}
          stepOrdine={currentStep?.ordine ?? 0}
          isLastStep={isLastStep}
        />
      </div>

      <div className="row g-4">
        {/* Main Content */}
        <div className="col-12 col-lg-8">
          {/* Info Card */}
          <Card className="mb-4">
            <CardBody>
              <CardTitle>Informazioni Generali</CardTitle>
              <div className="row g-3">
                <div className="col-md-6">
                  <strong>Protocollo Ingresso:</strong>
                  <div>{istanza.protoNumero || '-'}</div>
                  {istanza.protoData && (
                    <small className="text-muted">
                      del {new Date(istanza.protoData).toLocaleDateString('it-IT')}
                    </small>
                  )}
                </div>
                <div className="col-md-6">
                  <strong>Protocollo Finale:</strong>
                  <div>{istanza.protoFinaleNumero || '-'}</div>
                  {istanza.protoFinaleData && (
                    <small className="text-muted">
                      del {new Date(istanza.protoFinaleData).toLocaleDateString('it-IT')}
                    </small>
                  )}
                </div>
                <div className="col-md-6">
                  <strong>Data Invio:</strong>
                  <div>{new Date(istanza.dataInvio).toLocaleString('it-IT')}</div>
                </div>
                <div className="col-md-6">
                  <strong>Municipalità:</strong>
                  <div>{istanza.municipalita || '-'}</div>
                </div>
                {istanza.servizio.ufficio && (
                  <div className="col-md-6">
                    <strong>Ufficio di competenza:</strong>
                    <div>{istanza.servizio.ufficio.nome}</div>
                  </div>
                )}
                {istanza.datiInEvidenza && (
                  <div className="col-12">
                    <strong>Dati in Evidenza:</strong>
                    <div>{istanza.datiInEvidenza}</div>
                  </div>
                )}
              </div>
            </CardBody>
          </Card>

          {/* User Info Card */}
          <Card className="mb-4">
            <CardBody>
              <div className="d-flex justify-content-between align-items-center mb-3">
                <CardTitle className="mb-0">Dati Utente</CardTitle>
                <AltreIstanzeModal
                  codiceFiscale={istanza.utente.codiceFiscale}
                  nome={istanza.utente.nome}
                  cognome={istanza.utente.cognome}
                  istanzaCorrenteId={istanza.id}
                />
              </div>
              <div className="row g-3">
                <div className="col-md-6">
                  <strong>Nome e Cognome:</strong>
                  <div>
                    {istanza.utente.nome} {istanza.utente.cognome}
                  </div>
                </div>
                <div className="col-md-6">
                  <strong>Codice Fiscale:</strong>
                  <div>{istanza.utente.codiceFiscale}</div>
                </div>
                <div className="col-md-6">
                  <strong>Email:</strong>
                  <div>{istanza.utente.email || '-'}</div>
                </div>
                <div className="col-md-6">
                  <strong>Telefono:</strong>
                  <div>{istanza.utente.telefono || '-'}</div>
                </div>
                {istanza.utente.indirizzo && (
                  <div className="col-12">
                    <strong>Indirizzo:</strong>
                    <div>
                      {istanza.utente.indirizzo}
                      {istanza.utente.cap && `, ${istanza.utente.cap}`}
                      {istanza.utente.citta && ` ${istanza.utente.citta}`}
                      {istanza.utente.provincia && ` (${istanza.utente.provincia})`}
                    </div>
                  </div>
                )}
              </div>
            </CardBody>
          </Card>

          {/* Form Data Card */}
          <Card className="mb-4">
            <CardBody>
              <CardTitle>Dati Inseriti</CardTitle>
              {Object.keys(dati).length > 0 ? (
                <div className="table-responsive">
                  <table className="table table-sm">
                    <tbody>
                      {Object.entries(dati).map(([key, value]) => (
                        <tr key={key}>
                          <th style={{ width: '30%' }}>{key}</th>
                          <td>{String(value) || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-muted">Nessun dato disponibile</p>
              )}
            </CardBody>
          </Card>

          {/* Allegati Card */}
          <Card className="mb-4">
            <CardBody>
              <CardTitle>Allegati</CardTitle>
              <AllegatiList workflows={istanza.workflows} />
            </CardBody>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="col-12 col-lg-4">
            {/* Workflow Timeline */}
          <Card>
            <CardBody>
              <CardTitle>Storico Workflow</CardTitle>
              <WorkflowTimeline
                workflows={istanza.workflows}
                steps={istanza.servizio.steps}
              />
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
