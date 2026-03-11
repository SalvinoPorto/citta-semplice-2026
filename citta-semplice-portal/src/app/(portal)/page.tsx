export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { prisma } from '@/lib/db/prisma';

async function getAreeInEvidenza() {
  return prisma.area.findMany({
    where: { attiva: true, privata: false },
    include: {
      servizi: {
        where: { attivo: true },
        take: 3,
        orderBy: { ordine: 'asc' },
      },
    },
    orderBy: { ordine: 'asc' },
    take: 6,
  });
}

export default async function HomePage() {
  const aree = await getAreeInEvidenza();

  return (
    <>
      {/* Hero */}
      <div className="it-hero-wrapper bg-dark">
        <div className="img-responsive-wrapper">
          <div className="img-responsive">
            <div className="img-wrapper"></div>
          </div>
        </div>
        <div className="it-hero-text-wrapper with-img">
          <span className="it-category">Comune di Catania</span>
          <h1 className="no_toc" data-element="hero-title">Città Semplice</h1>
          <p className="d-none d-lg-block">
            Tutti i servizi comunali per i cittadini, disponibili online, per richiedere documenti
            e permessi, iscriversi a graduatorie ed effettuare pagamenti.
          </p>
          <div className="it-btn-container">
            <Link href="/servizi" className="btn btn-sm btn-secondary">
              Esplora i servizi
            </Link>
          </div>
        </div>
      </div>

      {/* Servizi in evidenza */}
      <div className="container my-4 my-lg-5">
        <div className="row">
          <div className="col-12">
            <h2 className="title-xxlarge mb-4">Servizi online</h2>
          </div>
        </div>
        <div className="row">
          {aree.map((area) => (
            <div key={area.id} className="col-12 col-md-6 col-lg-4 mb-4">
              <div className="card card-teaser rounded shadow">
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
          <div className="col-12">
            <div className="alert alert-info">
              Nessun servizio disponibile al momento.
            </div>
          </div>
        )}
        <div className="row mt-3">
          <div className="col-12 text-center">
            <Link href="/servizi" className="btn btn-outline-primary">
              Vedi tutti i servizi
            </Link>
          </div>
        </div>
      </div>

      {/* Come funziona */}
      <div className="bg-grey-card py-5">
        <div className="container">
          <div className="row">
            <div className="col-12">
              <h2 className="title-xxlarge mb-4">Come funziona</h2>
            </div>
          </div>
          <div className="row">
            <div className="col-12 col-md-4 mb-4">
              <div className="d-flex">
                <div className="me-3">
                  <svg className="icon icon-xl text-primary" aria-hidden="true">
                    <use href="/bootstrap-italia/dist/svg/sprites.svg#it-user" />
                  </svg>
                </div>
                <div>
                  <h3 className="h5">1. Accedi</h3>
                  <p className="text-paragraph small">Accedi al portale con le tue credenziali o tramite identità digitale (SPID/CIE).</p>
                </div>
              </div>
            </div>
            <div className="col-12 col-md-4 mb-4">
              <div className="d-flex">
                <div className="me-3">
                  <svg className="icon icon-xl text-primary" aria-hidden="true">
                    <use href="/bootstrap-italia/dist/svg/sprites.svg#it-pencil" />
                  </svg>
                </div>
                <div>
                  <h3 className="h5">2. Compila la richiesta</h3>
                  <p className="text-paragraph small">Scegli il servizio di cui hai bisogno e compila il modulo online.</p>
                </div>
              </div>
            </div>
            <div className="col-12 col-md-4 mb-4">
              <div className="d-flex">
                <div className="me-3">
                  <svg className="icon icon-xl text-primary" aria-hidden="true">
                    <use href="/bootstrap-italia/dist/svg/sprites.svg#it-check-circle" />
                  </svg>
                </div>
                <div>
                  <h3 className="h5">3. Monitora lo stato</h3>
                  <p className="text-paragraph small">Tieni traccia delle tue istanze e ricevi aggiornamenti sullo stato della pratica.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
