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
    where: { utenteId },
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

  const istanze = await getIstanze(utente.id);

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
              <section className="it-hero-wrapper bg-white align-items-start">
                <div className="it-hero-text-wrapper pt-0 ps-0 pb-4">
                  <h1 className="text-black">Le mie istanze</h1>
                  <p>
                    Benvenuto, <strong>{utente.nome} {utente.cognome}</strong>.
                    Qui puoi monitorare lo stato delle tue richieste.
                  </p>
                </div>
              </section>
            </div>
          </div>
        </div>
      </div>

      <div className="container mb-5">
        <div className="row justify-content-center">
          <div className="col-12 col-lg-10">
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
                          <td>{istanza.id}</td>
                          <td>
                            <Link
                              href={`/${istanza.servizio.area.slug ?? istanza.servizio.area.id}/${istanza.servizio.slug ?? istanza.servizio.id}`}
                              className="text-decoration-none"
                            >
                              {istanza.servizio.titolo}
                            </Link>
                          </td>
                          <td>
                            {format(istanza.dataInvio, 'dd/MM/yyyy HH:mm', { locale: it })}
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
