export const dynamic = 'force-dynamic';

import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { auth } from '@/lib/auth/config';
import { prisma } from '@/lib/db/prisma';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { IstanzeTable } from './IstanzeTable';
import { BozzaDeleteButton } from './BozzaDeleteButton';

export const metadata: Metadata = {
  title: 'Le mie istanze - Città Semplice',
};

async function getBozze(utenteId: number) {
  return prisma.istanza.findMany({
    where: { utenteId, inBozza: true },
    include: {
      servizio: { include: { area: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
}

export default async function LeMieIstanzePage() {
  const session = await auth();
  if (!session?.user) {
    redirect('/login?callbackUrl=/le-mie-istanze');
  }

  const utente = await prisma.utente.findUnique({ where: { id: Number(session.user.id) } });
  if (!utente) redirect('/login');

  const bozze = await getBozze(utente.id);

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
                      <th style={{ width: '40%' }} scope="col">Servizio</th>
                      <th style={{ width: '20%' }} scope="col">Ultimo aggiornamento</th>
                      <th style={{ width: '10%' }} scope="col">Step</th>
                      <th style={{ width: '30%' }} scope="col"></th>
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
                            <BozzaDeleteButton bozzaId={bozza.id} />
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
            <IstanzeTable utenteId={utente.id} />
          </div>
        </div>
      </div>
    </>
  );
}
