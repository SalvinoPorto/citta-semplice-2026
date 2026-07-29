import { notFound } from 'next/navigation';
import { BackButton } from './back-button';
import prisma from '@/lib/db/prisma';
import { getCurrentUser } from '@/lib/auth/session';
import { getVisibilitaOperatore, puoVedereIstanza, puoOperareSuIstanza } from '@/lib/auth/visibilita';
import { getStatoIstanza } from '@/lib/models/stato-istanza';
import { Card, CardBody, CardTitle, Badge } from '@/components/ui';
import { WorkflowTimeline } from './workflow-timeline';
import { ComunicazioniTimeline } from './comunicazioni-timeline';
import { AllegatiList } from './allegati-list';
import { IstanzaActions } from './istanza-actions';
import { AltreIstanzeModal } from './altre-istanze-modal';
import { ASSIGNEDTO } from '@/lib/models/assigned-to';

async function getIstanza(id: number) {
  const istanza = await prisma.istanza.findUnique({
    where: { id },
    include: {
      utente: true,
      faseCorrente: {
        include: { ufficio: true },
      },
      workflowFasi: {
        include: {
          fase: { include: { ufficio: true } },
          operatoreCompletamento: true,
        },
        orderBy: { dataInizio: 'asc' },
      },
      servizio: {
        include: {
          area: true,
          ufficio: true,
          steps: {
            where: { attivo: true },
            orderBy: { ordine: 'asc' },
            include: { pagamentoConfig: true },
          },
          fasi: {
            include: { ufficio: true },
            orderBy: { ordine: 'asc' },
          },
        },
      },
      workflows: {
        include: {
          step: {
            include: { pagamentoConfig: true },
          },
          operatore: {
            select: { id: true, nome: true, cognome: true },
          },
          allegati: true,
          pagamentoAtteso: true,
        },
        orderBy: { id: 'desc' },
      },
      comunicazioni: {
        include: {
          operatore: { select: { nome: true, cognome: true } },
          risposta: {
            include: {
              allegati: {
                select: {
                  id: true,
                  nomeFile: true,
                  nomeFileRichiesto: true,
                  mimeType: true,
                },
              },
            },
          },
        },
        orderBy: { dataCreazione: 'asc' },
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

  const visibilita = await getVisibilitaOperatore(operatoreId, user.ruoli);
  let canOperateFase = visibilita.isAdmin;

  if (!visibilita.isAdmin) {
    // Servizio non assegnato o ufficio estraneo al servizio → istanza invisibile
    if (!puoVedereIstanza(visibilita, istanza)) {
      notFound();
    }
    // Può operare solo se l'ufficio corrente corrisponde al suo
    canOperateFase = puoOperareSuIstanza(visibilita, istanza);
  }

  // Le risposte del cittadino restano evidenziate finché un operatore non apre
  // l'istanza: qui sono ancora "nuove", subito dopo diventano lette.
  const risposteNuove = new Set(
    istanza.comunicazioni
      .filter((com) => com.risposta && !com.risposta.lettaDaOperatore)
      .map((com) => com.id),
  );
  if (risposteNuove.size > 0) {
    await prisma.rispostaComunicazione.updateMany({
      where: { comunicazioneId: { in: [...risposteNuove] } },
      data: { lettaDaOperatore: true },
    });
  }

  const lastWorkflow = istanza.workflows[0];
  const assignedTo = (lastWorkflow === undefined || lastWorkflow.operatore === null)
    ? ASSIGNEDTO.NOONE
    : lastWorkflow.operatore.id === operatoreId
      ? ASSIGNEDTO.ME
      : ASSIGNEDTO.OTHER;

  const faseCorrente = istanza.faseCorrente ?? null;
  const fasePrecedente = faseCorrente && faseCorrente.ordine > 1
    ? istanza.servizio.fasi.find(f => f.ordine === faseCorrente.ordine - 1) ?? null
    : null;
  const canRollbackFase = !istanza.conclusa && !istanza.respinta && fasePrecedente !== null;

  // Prossima fase (per sapere se ha ufficio variabile al momento dell'avanzamento)
  const nextFase = faseCorrente
    ? istanza.servizio.fasi.find(f => f.ordine === faseCorrente.ordine + 1) ?? null
    : null;

  // Ufficio che sta lavorando l'istanza: quello della fase corrente. Per le istanze
  // chiuse (nessuna fase corrente) si elencano gli uffici che lavorano il servizio.
  const ufficioCompetente = faseCorrente?.ufficio?.nome
    ?? (Array.from(new Set(
          istanza.servizio.fasi.map(f => f.ufficio?.nome).filter((n): n is string => !!n)
        )).join(', ') || null);

  interface CampoDato { name: string; label: string; value: string; }
  function parseDati(raw: string | null | undefined): CampoDato[] {
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed as CampoDato[];
      return Object.entries(parsed).map(([name, value]) => ({ name, label: name, value: String(value) }));
    } catch { return []; }
  }
  const dati = parseDati(istanza.dati);

  // Informazioni sullo step corrente
  const currentStep = lastWorkflow?.step ?? null;
  const stepPagamentoConfig = currentStep?.pagamentoConfig ?? null;
  const steps = istanza.servizio.steps;
  const lastStepOrdine = steps.length > 0 ? steps[steps.length - 1].ordine : 0;
  const isLastStep = currentStep ? currentStep.ordine === lastStepOrdine : false;
  const isFirstStepOfCurrentFase = currentStep
    ? !steps.some((s) => s.faseId === currentStep.faseId && s.ordine < currentStep.ordine)
    : true;

  // Il selettore ufficio si mostra solo se lo step corrente è l'ultimo della sua fase
  const isLastStepOfFase = currentStep?.faseId != null
    ? !steps.some(s => s.faseId === currentStep.faseId && s.ordine > currentStep.ordine)
    : false;
  const ufficiDisponibili: { id: number; nome: string }[] = [];

  const getStatusBadge = () => {
    const stato = getStatoIstanza({
      conclusa: istanza.conclusa,
      respinta: istanza.respinta,
      ultimoWorkflow: lastWorkflow ?? null,
    });
    return <Badge variant={stato.variant}>{stato.label}</Badge>;
  };

  const pmpayUrl = `${process.env.PMPAY_URL}/ente/${process.env.PMPAY_ENTE_ID}/pagamento`;

  return (
    <div>
      {/* Header */}
      <div className="page-header d-flex justify-content-between align-items-start">
        <div>
          <div className="d-flex align-items-center gap-2 mb-2">
            <BackButton />
          </div>
          <h1 className="d-flex align-items-center gap-3">
            Istanza #{istanza.id}
            {getStatusBadge()}
            {faseCorrente && (
              <span className="badge text-bg-info ms-2">
                {faseCorrente.nome}
                {faseCorrente.ufficio && ` — ${faseCorrente.ufficio.nome}`}
              </span>
            )}
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
            codiceFiscale: istanza.utente.codiceFiscale,
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
              codiceTributo: stepPagamentoConfig.codiceTributo,
              descrizioneTributo: stepPagamentoConfig.descrizioneTributo,
            } : null,
          } : null}
          currentPayment={lastWorkflow?.pagamentoAtteso ?? null}
          stepOrdine={currentStep?.ordine ?? 0}
          isLastStep={isLastStep}
          isFirstStepOfCurrentFase={isFirstStepOfCurrentFase}
          canRollbackFase={canRollbackFase}
          canOperateFase={canOperateFase}
          faseCorrente={faseCorrente ? { nome: faseCorrente.nome, ordine: faseCorrente.ordine } : null}
          fasePrecedente={fasePrecedente ? {
            nome: fasePrecedente.nome,
            ufficio: fasePrecedente.ufficio ? { nome: fasePrecedente.ufficio.nome, email: fasePrecedente.ufficio.email ?? null } : null,
          } : null}
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
                <div className="col-md-6">
                  <strong>Ufficio di competenza:</strong>
                  {/* Ufficio che lavora l'istanza ORA = ufficio della fase corrente.
                      Le istanze chiuse non hanno fase corrente: si mostrano gli
                      uffici che hanno lavorato il servizio. */}
                  <div>{ufficioCompetente ?? '-'}</div>
                </div>
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
              {dati.length > 0 ? (
                <div className="table-responsive">
                  <table className="table table-sm">
                    <tbody>
                      {dati.map((campo) => (
                        <tr key={campo.name}>
                          <th style={{ width: '30%' }}>{campo.label}</th>
                          <td>{campo.value || '-'}</td>
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
              <AllegatiList
                workflows={istanza.workflows}
                comunicazioni={istanza.comunicazioni}
              />
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
                urlPayment={pmpayUrl}
                istanzaId={istanza.id}
                utente={{
                  codiceFiscale: istanza.utente.codiceFiscale,
                  nome: istanza.utente.nome,
                  cognome: istanza.utente.cognome,
                  email: istanza.utente.email,
                }}
              />
            </CardBody>
          </Card>

          <Card>
            <CardBody>
              <CardTitle>Storico Comunicazioni</CardTitle>
              <ComunicazioniTimeline
                comunicazioni={istanza.comunicazioni}
                risposteNuove={[...risposteNuove]}
              />
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
