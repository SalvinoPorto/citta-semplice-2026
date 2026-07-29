import prisma from '@/lib/db/prisma';
import type { ServizioOption } from './operatore-form';

/** Ruoli, uffici e servizi selezionabili nel form operatore. */
export async function getOperatoreFormData() {
  const [ruoli, uffici, servizi] = await Promise.all([
    prisma.ruolo.findMany({ orderBy: { nome: 'asc' } }),
    prisma.ufficio.findMany({
      where: { attivo: true },
      select: { id: true, nome: true },
      orderBy: { nome: 'asc' },
    }),
    prisma.servizio.findMany({
      where: { attivo: true },
      select: {
        id: true,
        titolo: true,
        ufficioId: true,
        area: { select: { nome: true } },
        fasi: { select: { ufficioId: true } },
      },
      orderBy: { titolo: 'asc' },
    }),
  ]);

  const serviziOptions: ServizioOption[] = servizi.map((s) => ({
    id: s.id,
    titolo: s.titolo,
    areaNome: s.area?.nome ?? null,
    // uffici che vedono il servizio: quello del servizio + quelli delle sue fasi
    ufficioIds: Array.from(
      new Set([
        ...(s.ufficioId !== null ? [s.ufficioId] : []),
        ...s.fasi.map((f) => f.ufficioId),
      ])
    ),
  }));

  return { ruoli, uffici, servizi: serviziOptions };
}
