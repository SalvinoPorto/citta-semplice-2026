export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { prisma } from '@/lib/db/prisma';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { ServiziSearch } from '@/components/servizi/ServiziSearch';

async function getServiziInEvidenza() {
  return prisma.servizio.findMany({
    where: { attivo: true, evidenza: true, area: { attiva: true, privata: false } },
    select: {
      id: true,
      titolo: true,
      slug: true,
      area: { select: { id: true, slug: true } },
    },
    orderBy: { titolo: 'asc' },
    take: 10,
  });
}

async function getAree() {
  return prisma.area.findMany({
    where: { attiva: true, privata: false },
    select: {
      id: true,
      titolo: true,
      descrizione: true,
      slug: true,
      icona: true,
      servizi: {
        where: { attivo: true },
        select: { id: true, titolo: true, slug: true },
        orderBy: { ordine: 'asc' },
        take: 3,
      },
    },
    orderBy: { ordine: 'asc' },
  });
}

export default async function HomePage() {
  const [serviziInEvidenza, aree] = await Promise.all([
    getServiziInEvidenza(),
    getAree(),
  ]);

  const items = [
    { id: 0, label: 'Home', href: '/', active: false },
    { id: 1, label: 'Tutti i servizi', active: true },
  ];

  return (
    <div className="container">
      <Breadcrumb items={items} />
      <div className="it-hero-text-wrapper">
        <h1 className="no_toc" data-element="hero-title">Servizi</h1>
        <p className="d-none d-lg-block">
          Tutti i servizi comunali per i cittadini, disponibili online, per richiedere documenti
          e permessi, iscriversi a graduatorie ed effettuare pagamenti.
        </p>
      </div>

      {/* Esplora tutti i servizi */}
      <div className="bg-grey-card py-4 mb-5 rounded">
        <div className="container">
          <div className="row mb-4">
            <div className="col-12">
              <h2 className="title-xxlarge">Esplora tutti i servizi</h2>
            </div>
          </div>
          <div className="row">
            {/* Search + list */}
            <div className="col-12 col-lg-8">
              <ServiziSearch />
            </div>

            {/* Servizi in evidenza */}
            <div className="col-12 col-lg-4 mt-4 mt-lg-0">
              <h3 className="h6 text-uppercase text-muted mb-3" style={{ letterSpacing: '0.05em' }}>
                Servizi in evidenza
              </h3>
              <ul className="list-unstyled">
                {serviziInEvidenza.map((s) => (
                  <li key={s.id} className="mb-2">
                    <Link
                      href={`/${s.area.slug ?? s.area.id}/${s.slug ?? s.id}`}
                      className="text-primary small text-decoration-none"
                    >
                      {s.titolo}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Esplora per categoria */}
      <div className="mb-5">
        <div className="row mb-4">
          <div className="col-12">
            <h2 className="title-xxlarge">Esplora per categoria</h2>
          </div>
        </div>
        <div className="row">
          {aree.map((area) => (
            <div key={area.id} className="col-12 col-md-6 col-lg-4 mb-4">
              <div className="card card-teaser rounded shadow h-100">
                <div className="card-body">
                  <h3 className="card-title h5">
                    <Link href={`/${area.slug ?? area.id}`} className="text-decoration-none">
                      {area.icona && (
                        <svg className="icon icon-sm me-2" aria-hidden="true">
                          <use href={`/bootstrap-italia/dist/svg/sprites.svg#${area.icona}`} />
                        </svg>
                      )}
                      {area.titolo}
                    </Link>
                  </h3>
                  {area.descrizione && (
                    <p className="card-text text-paragraph small">{area.descrizione}</p>
                  )}
                  {area.servizi.length > 0 && (
                    <ul className="list-unstyled mt-2 mb-0">
                      {area.servizi.map((s) => (
                        <li key={s.id} className="mb-1">
                          <Link
                            href={`/${area.slug ?? area.id}/${s.slug ?? s.id}`}
                            className="small text-primary"
                          >
                            {s.titolo}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
        {aree.length === 0 && (
          <div className="alert alert-info">Nessuna categoria disponibile al momento.</div>
        )}
      </div>
    </div>
  );
}
