export const dynamic = 'force-dynamic';

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { prisma } from '@/lib/db/prisma';
import { Breadcrumb } from '@/components/ui/Breadcrumb';

interface Props {
  params: Promise<{ areaSlug: string }>;
}

async function getArea(slug: string) {
  const area = await prisma.area.findFirst({
    where: {
      OR: [{ slug }, { id: isNaN(Number(slug)) ? undefined : Number(slug) }],
      attiva: true,
      privata: false,
    },
    include: {
      servizi: {
        where: { attivo: true },
        include: { ufficio: true },
        orderBy: { ordine: 'asc' },
      },
    },
  });
  return area;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { areaSlug } = await params;
  const area = await getArea(areaSlug);
  if (!area) return { title: 'Area non trovata' };
  return {
    title: `${area.titolo} - Città Semplice`,
    description: area.descrizione ?? undefined,
  };
}

export default async function AreaPage({ params }: Props) {
  const { areaSlug } = await params;
  const area = await getArea(areaSlug);

  if (!area) notFound();

  return (
    <>
      <div className="container" id="main-container">
        <Breadcrumb
          items={[
            { label: 'Home', href: '/' },
            { label: 'Servizi', href: '/servizi' },
            { label: area.titolo, active: true },
          ]}
        />
      </div>

      <div className="container">
        <div className="row justify-content-center">
          <div className="col-12 col-lg-10">
            <div className="cmp-hero">
              <section className="it-hero-wrapper bg-white align-items-start">
                <div className="it-hero-text-wrapper pt-0 ps-0 pb-4 pb-lg-60">
                  <h1 className="text-black" data-element="page-name">{area.titolo}</h1>
                  {area.descrizione && (
                    <div className="hero-text">
                      <p>{area.descrizione}</p>
                    </div>
                  )}
                </div>
              </section>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-grey-card">
        <div className="container">
          <div className="row">
            <div className="col-12 col-lg-8 pt-30 pt-lg-50 pb-lg-50">
              <div className="cmp-input-search mb-4">
                <div className="form-group mb-0">
                  <div className="input-group">
                    <label htmlFor="search-servizi" className="visually-hidden">
                      Cerca una parola chiave
                    </label>
                    <input
                      type="search"
                      className="form-control"
                      placeholder="Cerca una parola chiave"
                      id="search-servizi"
                    />
                    <span className="input-group-text" aria-hidden="true">
                      <svg className="icon icon-sm icon-primary">
                        <use href="/bootstrap-italia/dist/svg/sprites.svg#it-search" />
                      </svg>
                    </span>
                  </div>
                  <p className="mt-2 mt-lg-3 mb-4">
                    <strong>{area.servizi.length} </strong>servizi trovati in ordine alfabetico
                  </p>
                </div>
              </div>

              {area.servizi.map((servizio) => (
                <div key={servizio.id} className="cmp-card-latest-messages mb-3 mb-30">
                  <div className="card shadow-sm px-4 pt-4 pb-4 rounded">
                    <div className="card-header border-0 p-0" />
                    <div className="card-body p-0 my-2">
                      <h3 className="green-title-big t-primary mb-8">
                        <Link
                          href={`/${areaSlug}/${servizio.slug ?? servizio.id}`}
                          className="text-decoration-none"
                          data-element="service-link"
                        >
                          {servizio.titolo}
                        </Link>
                      </h3>
                      {servizio.sottoTitolo && (
                        <p className="text-paragraph">{servizio.sottoTitolo}</p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Sidebar uffici */}
            <div className="col-12 col-lg-4 pt-30 pt-lg-5 ps-lg-5 order-first order-md-last">
              <div className="link-list-wrap">
                <h2 className="title-xsmall-semi-bold">
                  <span>UFFICI</span>
                </h2>
                <ul className="link-list t-primary">
                  {Array.from(
                    new Map(
                      area.servizi
                        .filter((s) => s.ufficio)
                        .map((s) => [s.ufficio!.id, s.ufficio!])
                    ).values()
                  ).map((ufficio) => (
                    <li key={ufficio.id} className="mb-3 mt-3">
                      <span className="list-item ps-0 title-medium">{ufficio.nome}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
