// export const dynamic = 'force-dynamic';

import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { auth } from '@/lib/auth/config';
import { prisma } from '@/lib/db/prisma';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { IstanzaStepper } from '@/components/istanza/IstanzaStepper';

interface Props {
  params: Promise<{ areaSlug: string; servizioSlug: string }>;
  searchParams: Promise<{ bozzaId?: string }>;
}

async function getServizio(areaSlug: string, servizioSlug: string) {
  const area = await prisma.area.findFirst({
    where: {
      OR: [{ slug: areaSlug }, { id: isNaN(Number(areaSlug)) ? undefined : Number(areaSlug) }],
      attiva: true,
    },
  });
  if (!area) return null;

  return prisma.servizio.findFirst({
    where: {
      OR: [
        { slug: servizioSlug },
        { id: isNaN(Number(servizioSlug)) ? undefined : Number(servizioSlug) },
      ],
      areaId: area.id,
      attivo: true,
    },
    include: {
      area: true,
      steps: {
        where: { attivo: true },
        orderBy: { ordine: 'asc' },
        include: {
          allegatiRichiestiList: {
            where: { interno: false },
            orderBy: { id: 'asc' },
          },
        },
      },
    },
  });
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { areaSlug, servizioSlug } = await params;
  const servizio = await getServizio(areaSlug, servizioSlug);
  if (!servizio) return { title: 'Servizio non trovato' };
  return { title: `Richiesta: ${servizio.titolo} - Città Semplice` };
}

export default async function IstanzaPage({ params, searchParams }: Props) {
  const { areaSlug, servizioSlug } = await params;
  const { bozzaId: bozzaIdStr } = await searchParams;

  const session = await auth();
  if (!session?.user) {
    redirect(`/login?callbackUrl=/${areaSlug}/${servizioSlug}/istanza`);
  }

  const servizio = await getServizio(areaSlug, servizioSlug);
  if (!servizio) notFound();

  // Controlla disponibilità
  const ora = new Date();
  if (
    (servizio.dataInizio && servizio.dataInizio > ora) ||
    (servizio.dataFine && servizio.dataFine < ora)
  ) {
    redirect(`/${areaSlug}/${servizioSlug}`);
  }

  // Carica eventuale bozza
  let bozzaIniziale: { id: number; datiModulo: Record<string, unknown>; activeStep: number } | undefined;

  if (bozzaIdStr) {
    const bozzaId = Number(bozzaIdStr);
    const utente = await prisma.utente.findUnique({ where: { id: Number(session.user.id) } });
    if (utente) {
      const bozza = await prisma.istanza.findFirst({
        where: { id: bozzaId, utenteId: utente.id, inBozza: true, servizioId: servizio.id },
      });
      if (bozza) {
        let datiModulo: Record<string, unknown> = {};
        try {
          datiModulo = bozza.dati ? JSON.parse(bozza.dati) : {};
        } catch {
          datiModulo = {};
        }
        bozzaIniziale = {
          id: bozza.id,
          datiModulo,
          activeStep: bozza.activeStep ?? 1,
        };
      }
    }
  }

  return (
    <>
      <div className="container" id="main-container">
        <Breadcrumb
          items={[
            { label: 'Home', href: '/' },
            { label: 'Servizi', href: '/servizi' },
            { label: servizio.area.titolo, href: `/${areaSlug}` },
            { label: servizio.titolo, href: `/${areaSlug}/${servizioSlug}` },
            { label: 'Richiesta', active: true },
          ]}
        />
      </div>

      <div className="container">
        <div className="row justify-content-center">
          <div className="col-12 col-lg-10">
            <h1 className="title-xxlarge mb-4">{servizio.titolo}</h1>
            {bozzaIniziale && (
              <div className="alert alert-info d-flex align-items-center mb-4" role="alert">
                <svg className="icon icon-sm me-2" aria-hidden="true">
                  <use href="/bootstrap-italia/dist/svg/sprites.svg#it-info-circle" />
                </svg>
                <span>Hai ripreso una bozza salvata. I dati inseriti in precedenza sono stati ripristinati.</span>
              </div>
            )}
          </div>
          <div className="col-12">
            <IstanzaStepper
              servizio={servizio}
              userId={session.user.id!}
              bozzaIniziale={bozzaIniziale}
            />
          </div>
        </div>
      </div>
    </>
  );
}
