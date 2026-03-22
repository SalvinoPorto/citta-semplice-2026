export const dynamic = 'force-dynamic';

import type { Metadata } from 'next';
import Link from 'next/link';
import { prisma } from '@/lib/db/prisma';
import { Breadcrumb } from '@/components/ui/Breadcrumb';

export const metadata: Metadata = {
  title: 'Servizi - Città Semplice',
  description: 'Tutti i servizi comunali per i cittadini, disponibili online.',
};

async function getAree() {
  return prisma.area.findMany({
    where: { attiva: true, privata: false },
    include: {
      servizi: {
        where: { attivo: true },
        orderBy: { ordine: 'asc' },
      },
    },
    orderBy: { ordine: 'asc' },
  });
}

export default async function ServiziPage() {
  const aree = await getAree();
  const totaleServizi = aree.reduce((acc, a) => acc + a.servizi.length, 0);

  return (
    <>
      <div className="container" id="main-container">
        <Breadcrumb
          items={[
            { label: 'Home', href: '/' },
            { label: 'Servizi', active: true },
          ]}
        />
      </div>

      <div className="container">
        <div className="row justify-content-center">
          <div className="col-12 col-lg-10">
            <div className="cmp-hero">
              <section className="it-hero-wrapper bg-white align-items-start">
                <div className="it-hero-text-wrapper pt-0 ps-0 pb-4 pb-lg-60">
                  <h1 className="text-black" data-element="page-name">Servizi</h1>
                  <div className="hero-text">
                    <p>
                      Tutti i servizi comunali per i cittadini, disponibili online, per richiedere
                      documenti e permessi, iscriversi a graduatorie ed effettuare pagamenti.
                    </p>
                  </div>
                </div>
              </section>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-grey-card">
        <div className="container">
          <div className="row">
            <div className="col-12">
              <h2 className="title-xxlarge mb-4 mt-5 mb-lg-10">
                Esplora tutti i servizi
              </h2>
              <p className="mt-2 mt-lg-3 mb-4">
                <strong>{totaleServizi} </strong>servizi disponibili
              </p>
            </div>
          </div>

          {aree.map((area) => (
            <div key={area.id} className="mb-5">
              <div className="row">
                <div className="col-12">
                  <h3 className="title-xlarge mb-3">
                    <Link href={`/${area.slug ?? area.id}`} className="text-decoration-none text-primary">
                      {area.icona && (
                        <svg className="icon icon-sm me-2" aria-hidden="true">
                          <use href={`/bootstrap-italia/dist/svg/sprites.svg#${area.icona}`} />
                        </svg>
                      )}
                      {area.nome}
                    </Link>
                  </h3>
                  {area.descrizione && (
                    <p className="text-paragraph mb-3">{area.descrizione}</p>
                  )}
                </div>
              </div>
              <div className="row">
                {area.servizi.map((servizio) => (
                  <div key={servizio.id} className="col-12 col-md-6 col-lg-4 mb-3">
                    <div className="cmp-card-latest-messages">
                      <div className="card shadow-sm px-4 pt-4 pb-4 rounded h-100">
                        <div className="card-body p-0">
                          <h4 className="green-title-big t-primary mb-2">
                            <Link
                              href={`/${area.slug ?? area.id}/${servizio.slug ?? servizio.id}`}
                              className="text-decoration-none"
                              data-element="service-link"
                            >
                              {servizio.titolo}
                            </Link>
                          </h4>
                          {servizio.sottoTitolo && (
                            <p className="text-paragraph small">{servizio.sottoTitolo}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {aree.length === 0 && (
            <div className="row pb-5">
              <div className="col-12">
                <div className="alert alert-info">Nessun servizio disponibile al momento.</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
