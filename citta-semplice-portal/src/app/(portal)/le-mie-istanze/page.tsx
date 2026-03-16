export const dynamic = 'force-dynamic';

import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { auth } from '@/lib/auth/config';
import { prisma } from '@/lib/db/prisma';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';

export const metadata: Metadata = {
  title: 'Le mie istanze - Città Semplice',
};

async function getIstanze(utenteId: number) {
  return prisma.istanza.findMany({
    where: { utenteId, inBozza: false },
    include: {
      servizio: { include: { area: true } },
      workflows: {
        include: { step: true },
        orderBy: { dataVariazione: 'desc' },
        take: 1,
      },
    },
    orderBy: { dataInvio: 'desc' },
  });
}

async function getBozze(utenteId: number) {
  return prisma.istanza.findMany({
    where: { utenteId, inBozza: true },
    include: {
      servizio: { include: { area: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
}

function getStatoBadge(istanza: { conclusa: boolean; respinta: boolean }) {
  if (istanza.conclusa) return { label: 'Conclusa', cls: 'bg-success' };
  if (istanza.respinta) return { label: 'Respinta', cls: 'bg-danger' };
  return { label: 'In lavorazione', cls: 'bg-primary' };
}

export default async function LeMieIstanzePage() {
  const session = await auth();
  if (!session?.user) {
    redirect('/login?callbackUrl=/le-mie-istanze');
  }

  const utente = await prisma.utente.findUnique({ where: { id: Number(session.user.id) } });
  if (!utente) redirect('/login');

  const [istanze, bozze] = await Promise.all([
    getIstanze(utente.id),
    getBozze(utente.id),
  ]);

  return (
    <>
      <div className="container" id="main-container">
        <Breadcrumb
          items={[
            { label: 'Home', href: '/' },
            { label: 'Le mie istanze', active: true },
          ]}
        />
      </div>

      <div className="container">
        <div className="row justify-content-center">
          <div className="col-12 col-lg-10">
            <div className="cmp-hero">
              <section className="bg-white align-items-start">
                <div className="it-hero-text-wrapper pt-0 ps-0 pb-4">
                  
                    <h1>Benvenuto, <strong>{utente.nome} {utente.cognome}</strong>.</h1>
                    <h2>Qui puoi monitorare lo stato delle tue richieste.</h2>
                  
                </div>
              </section>
            </div>
          </div>
        </div>
      </div>

      {/* Sezione bozze */}
      {bozze.length > 0 && (
        <div className="container mb-4">
          <div className="row justify-content-center">
            <div className="col-12 col-lg-10">
              <h2 className="h4 mb-3">
                <svg className="icon icon-sm me-2 text-warning" aria-hidden="true">
                  <use href="/bootstrap-italia/dist/svg/sprites.svg#it-save" />
                </svg>
                Bozze salvate
              </h2>
              <div className="table-responsive">
                <table className="table table-hover">
                  <thead>
                    <tr>
                      <th scope="col">Servizio</th>
                      <th scope="col">Ultimo aggiornamento</th>
                      <th scope="col">Step</th>
                      <th scope="col"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {bozze.map((bozza) => {
                      const stepLabel = bozza.activeStep !== null && bozza.activeStep !== undefined
                        ? ['Privacy', 'Modulo', 'Allegati', 'Riepilogo'][bozza.activeStep] ?? '—'
                        : '—';
                      const riprendiUrl = `/${bozza.servizio.area.slug ?? bozza.servizio.area.id}/${bozza.servizio.slug ?? bozza.servizio.id}/istanza?bozzaId=${bozza.id}`;
                      return (
                        <tr key={bozza.id}>
                          <td>{bozza.servizio.titolo}</td>
                          <td>
                            {format(bozza.createdAt, 'dd/MM/yyyy HH:mm', { locale: it })}
                          </td>
                          <td>
                            <span className="badge bg-warning text-dark">{stepLabel}</span>
                          </td>
                          <td className="text-end">
                            <Link href={riprendiUrl} className="btn btn-sm btn-outline-primary">
                              <svg className="icon icon-sm me-1" aria-hidden="true">
                                <use href="/bootstrap-italia/dist/svg/sprites.svg#it-restore" />
                              </svg>
                              Riprendi
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Sezione istanze inviate */}
      <div className="container mb-5">
        <div className="row justify-content-center">
          <div className="col-12 col-lg-10">
            {bozze.length > 0 && (
              <h2 className="h4 mb-3">Istanze inviate</h2>
            )}
            {istanze.length === 0 ? (
              <div className="card p-5 text-center">
                <svg className="icon icon-xl text-muted mx-auto mb-3" aria-hidden="true">
                  <use href="/bootstrap-italia/dist/svg/sprites.svg#it-inbox" />
                </svg>
                <h2 className="h5 text-muted">Nessuna istanza trovata</h2>
                <p className="text-muted mb-4">Non hai ancora inviato nessuna richiesta.</p>
                <Link href="/servizi" className="btn btn-primary mx-auto" style={{ width: 'fit-content' }}>
                  Esplora i servizi
                </Link>
              </div>
            ) : (
              <div className="table-responsive">
                <table className="table table-hover">
                  <thead>
                    <tr>
                      <th scope="col">N°</th>
                      <th scope="col">Servizio</th>
                      <th scope="col">Data invio</th>
                      <th scope="col">Protocollo</th>
                      <th scope="col">Stato</th>
                      <th scope="col">Fase attuale</th>
                    </tr>
                  </thead>
                  <tbody>
                    {istanze.map((istanza) => {
                      const stato = getStatoBadge(istanza);
                      const ultimoWorkflow = istanza.workflows[0];
                      return (
                        <tr key={istanza.id}>
                          <td>
                            <Link href={`/le-mie-istanze/${istanza.id}`} className="text-decoration-none fw-semibold">
                              #{istanza.id}
                            </Link>
                          </td>
                          <td>
                            <Link
                              href={`/le-mie-istanze/${istanza.id}`}
                              className="text-decoration-none"
                            >
                              {istanza.servizio.titolo}
                            </Link>
                          </td>
                          <td>
                            {istanza.dataInvio
                              ? format(istanza.dataInvio, 'dd/MM/yyyy HH:mm', { locale: it })
                              : '—'}
                          </td>
                          <td>
                            {istanza.protoNumero ? (
                              <span>
                                {istanza.protoNumero}
                                {istanza.protoData && (
                                  <small className="text-muted d-block">
                                    {format(istanza.protoData, 'dd/MM/yyyy', { locale: it })}
                                  </small>
                                )}
                              </span>
                            ) : (
                              <span className="text-muted">—</span>
                            )}
                          </td>
                          <td>
                            <span className={`badge ${stato.cls}`}>{stato.label}</span>
                          </td>
                          <td>
                            {ultimoWorkflow?.step
                              ? ultimoWorkflow.step.descrizione
                              : <span className="text-muted">—</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
