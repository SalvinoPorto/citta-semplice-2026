export const dynamic = 'force-dynamic';

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { prisma } from '@/lib/db/prisma';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { ServizioIndice } from '@/components/servizi/ServizioIndice';

interface Props {
  params: Promise<{ areaSlug: string; servizioSlug: string }>;
}

async function getServizio(areaSlug: string, servizioSlug: string) {
  const area = await prisma.area.findFirst({
    where: {
      slug: areaSlug,
      attiva: true,
    },
  });
  if (!area) return null;

  return prisma.servizio.findFirst({
    where: {
      slug: servizioSlug,
      areaId: area.id,
      attivo: true,
    },
    include: { area: true, ufficio: true },
  });
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { areaSlug, servizioSlug } = await params;
  const servizio = await getServizio(areaSlug, servizioSlug);
  if (!servizio) return { title: 'Servizio non trovato' };
  return {
    title: `${servizio.titolo} - Città Semplice`,
    description: servizio.sottoTitolo ?? undefined,
  };
}

export default async function ServizioPage({ params }: Props) {
  const { areaSlug, servizioSlug } = await params;
  const servizio = await getServizio(areaSlug, servizioSlug);

  if (!servizio) notFound();

  const ora = new Date();
  const aperto =
    (!servizio.dataInizio || servizio.dataInizio <= ora) &&
    (!servizio.dataFine || servizio.dataFine >= ora);

  return (
    <>
      <div className="container" id="main-container">
        <Breadcrumb
          items={[
            { label: 'Home', href: '/' },
            { label: 'Servizi', href: '/servizi' },
            { label: servizio.area.titolo, href: `/${areaSlug}` },
            { label: servizio.titolo, active: true },
          ]}
        />
      </div>

      <div className="container">
        <div className="row justify-content-center">
          <div className="col-12 col-lg-10">
            <div className="cmp-heading pb-3 pb-lg-4">
              <div className="row">
                <div className="col-lg-12">
                  <h1 className="title-xxlarge" data-element="service-title">{servizio.titolo}</h1>
                  {servizio.sottoTitolo && (
                    <p className="subtitle-small mb-3">{servizio.sottoTitolo}</p>
                  )}
                  {aperto ? (
                    <Link
                      href={`/${areaSlug}/${servizioSlug}/istanza`}
                      className="btn btn-primary fw-bold"
                      data-element="service-description"
                    >
                      <span>Richiedi il servizio</span>
                    </Link>
                  ) : (
                    <div className="alert alert-warning d-inline-block">
                      {servizio.msgExtraServizio ?? 'Il servizio non è attualmente disponibile.'}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
          <hr className="d-none d-lg-block mt-2" />
        </div>
      </div>

      <div className="container">
        <div className="row row-column-menu-left mt-4 mt-lg-80 pb-lg-80 pb-40">
          {/* Indice laterale */}
          <div className="col-12 col-lg-3 mb-4 border-col">
            <ServizioIndice servizio={servizio} />
          </div>

          {/* Contenuto principale */}
          <div className="col-12 col-lg-8 offset-lg-1">
            <div className="it-page-sections-container">
              {servizio.descrizione && (
                <section className="it-page-section mb-30" id="description">
                  <h2 className="mb-3">Descrizione</h2>
                  <div
                    className="richtext-wrapper lora"
                    dangerouslySetInnerHTML={{ __html: servizio.descrizione }}
                  />
                </section>
              )}

              {servizio.comeFare && (
                <section className="it-page-section mb-30" id="how-to">
                  <h2 className="mb-3">Come fare</h2>
                  <div
                    className="richtext-wrapper lora"
                    data-element="service-how-to"
                    dangerouslySetInnerHTML={{ __html: servizio.comeFare }}
                  />
                </section>
              )}

              {servizio.cosaServe && (
                <section className="it-page-section mb-30 has-bg-grey p-3" id="needed">
                  <h2 className="mb-3">Cosa serve</h2>
                  <div
                    className="richtext-wrapper lora"
                    data-element="service-needed"
                    dangerouslySetInnerHTML={{ __html: servizio.cosaServe }}
                  />
                </section>
              )}

              {servizio.altreInfo && (
                <section className="it-page-section mb-30" id="obtain">
                  <h2 className="mb-3">Ulteriori informazioni</h2>
                  <div
                    className="richtext-wrapper lora"
                    dangerouslySetInnerHTML={{ __html: servizio.altreInfo }}
                  />
                </section>
              )}

              {servizio.contatti && (
                <section className="it-page-section mb-30" id="contacts">
                  <h2 className="mb-3">Contatti</h2>
                  <div
                    className="richtext-wrapper lora"
                    dangerouslySetInnerHTML={{ __html: servizio.contatti }}
                  />
                </section>
              )}

              {/* CTA accesso servizio */}
              <section className="it-page-section mb-30 has-bg-grey p-4" id="submit-request">
                <h2 className="mb-3">Accedi al servizio</h2>
                <p className="text-paragraph lora mb-4" data-element="service-generic-access">
                  Puoi richiedere il servizio direttamente online tramite identità digitale.
                </p>
                {aperto ? (
                  <Link
                    href={`/${areaSlug}/${servizioSlug}/istanza`}
                    className="btn btn-primary mobile-full"
                    data-element="service-online-access"
                  >
                    <span>Richiedi il servizio</span>
                  </Link>
                ) : (
                  <div className="alert alert-warning">
                    {servizio.msgExtraServizio ?? 'Il servizio non è attualmente disponibile.'}
                  </div>
                )}
              </section>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
