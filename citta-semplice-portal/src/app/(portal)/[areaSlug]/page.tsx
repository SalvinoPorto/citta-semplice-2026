export const dynamic = 'force-dynamic';
import React from 'react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db/prisma';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { AreaServiziSearch } from '@/components/servizi/AreaServiziSearch';

interface Props {
  params: Promise<{ areaSlug: string }>;
}

async function getArea(slug: string) {
  const area = await prisma.area.findFirst({
    where: {
      slug: slug,
      attiva: true,
      privata: false,
    },
    include: {
      servizi: {
        where: {
          attivo: true,
          OR: [{ dataFine: null }, { dataFine: { gte: new Date() } }],
        },
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
    title: `${area.nome} - Città Semplice`,
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
            { label: area.nome, active: true },
          ]}
        />
      </div>

      <div className="container">
        <div className="row justify-content-center">
          <div className="col-12 col-lg-10">
            <section className="bg-white align-items-start">
              <div className="pt-0 ps-0 pb-4 pb-lg-60">
                <h1 className="text-black" data-element="page-name">{area.nome}</h1>
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

      <div className="bg-grey-card">
        <div className="container">
          <div className="row">
            <div className="col-12 col-lg-8 pt-30 pt-lg-50 pb-lg-50">
              <AreaServiziSearch
                areaSlug={areaSlug}
                servizi={area.servizi.map((s) => ({
                  id: s.id,
                  titolo: s.titolo,
                  sottoTitolo: s.sottoTitolo,
                  descrizione: s.descrizione,
                  slug: s.slug,
                }))}
              />
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
