import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db/prisma';
import { whereVisibileAgliOperatori } from '@citta/db';
import { auth } from '@/lib/auth';
import { whereTab } from '@/lib/istanze/filtri-tab';
import {
  getVisibilitaOperatore,
  istanzaVisibilityWhere,
  isVisibilitaTotale,
  type VisibilitaOperatore,
} from '@/lib/auth/visibilita';

interface SortState {
  field: string;
  direction: number;
}

interface Filter {
  key: string;
  value: string;
}

interface FormFilters {
  protocollo: string;
  modulo: string;
  anno: string;
  cerca: string;
  ufficioId?: string;
}

interface SearchBody {
  tab: string;
  page: number;
  pageSize: number;
  sort: SortState;
  formFilters: FormFilters;
  columnFilters: Filter[];
}

async function getIstanzeCounts(visibilita: VisibilitaOperatore) {
  const operatoreId = visibilita.operatoreId;
  const visibilitaFilter = istanzaVisibilityWhere(visibilita);

  const [nuove, inLavorazionePropria, inLavorazioneAltri, respinte, concluse, totale] =
    await Promise.all(
      [
        whereTab('nuove', operatoreId),
        whereTab('mie', operatoreId),
        whereTab('altri', operatoreId),
        whereTab('respinte', operatoreId),
        whereTab('concluse', operatoreId),
        whereVisibileAgliOperatori(),
      ].map((where) =>
        prisma.istanza.count({ where: { ...where, AND: [visibilitaFilter] } }),
      ),
    );

  return { nuove, inLavorazionePropria, inLavorazioneAltri, respinte, concluse, totale };
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const operatoreId = parseInt(session.user.id);
  const visibilita = await getVisibilitaOperatore(operatoreId, session.user.ruoli);

  let body: SearchBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const {
    tab = 'nuove',
    page = 1,
    pageSize = 10,
    sort = { field: 'dataInvio', direction: -1 },
    formFilters = { protocollo: '', modulo: '', anno: '', cerca: '' },
    columnFilters = [],
  } = body;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const whereClause: any = { ...whereVisibileAgliOperatori() };

  if (formFilters.modulo) {
    whereClause.servizioId = parseInt(formFilters.modulo);
  }

  if (formFilters.protocollo) {
    const protoConditions = [
      { protoNumero: { contains: formFilters.protocollo, mode: 'insensitive' } },
      { protoFinaleNumero: { contains: formFilters.protocollo, mode: 'insensitive' } },
    ];
    if (whereClause.OR) {
      whereClause.AND = [{ OR: whereClause.OR }, { OR: protoConditions }];
      delete whereClause.OR;
    } else {
      whereClause.OR = protoConditions;
    }
  }

  if (formFilters.anno) {
    const year = parseInt(formFilters.anno);
    if (!isNaN(year)) {
      whereClause.dataInvio = {
        gte: new Date(`${year}-01-01`),
        lt: new Date(`${year + 1}-01-01`),
      };
    }
  }

  if (formFilters.ufficioId) {
    const uid = parseInt(formFilters.ufficioId, 10);
    // Come il filtro di visibilità: ufficio della fase corrente, con fallback
    // sugli uffici del servizio per le istanze chiuse (senza fase corrente)
    const ufficioConditions = [
      { faseCorrente: { ufficioId: uid } },
      { faseCorrenteId: null, servizio: { fasi: { some: { ufficioId: uid } } } },
    ];
    if (whereClause.AND) {
      whereClause.AND = [...whereClause.AND, { OR: ufficioConditions }];
    } else if (whereClause.OR) {
      whereClause.AND = [{ OR: whereClause.OR }, { OR: ufficioConditions }];
      delete whereClause.OR;
    } else {
      whereClause.OR = ufficioConditions;
    }
  }

  if (formFilters.cerca) {
    // Un solo predicato su `istanze.ricerca`, che contiene già codice fiscale,
    // nome e cognome dell'utente più i valori del modulo (vedi il trigger in
    // 20260813100000_ricerca_istanze).
    //
    // Prima erano cinque rami in OR, due dei quali sulla relazione `utente`.
    // Postgres combina i rami di un OR in BitmapOr solo se sono tutti index
    // scan sulla stessa tabella: un semi-join diventa un `hashed SubPlan` e
    // l'intero piano collassa in Seq Scan, quindi NESSUN indice era usabile.
    // Con un predicato solo il GIN trigram entra: COUNT da 3081 ms a 10 ms.
    //
    // Niente `mode: 'insensitive'`: la colonna è già in minuscolo, quindi si
    // abbassa il termine e si usa LIKE, che costa meno di ILIKE.
    whereClause.ricerca = { contains: formFilters.cerca.toLowerCase() };
  }

  const protoColFilter = columnFilters.find((f) => f.key === 'protoNumero');
  if (protoColFilter?.value) {
    whereClause.protoNumero = { contains: protoColFilter.value, mode: 'insensitive' };
  }

  const cognomeFilter = columnFilters.find((f) => f.key === 'cognome');
  if (cognomeFilter?.value) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const utenteOr: any[] = [
      { cognome: { contains: cognomeFilter.value, mode: 'insensitive' } },
      { nome: { contains: cognomeFilter.value, mode: 'insensitive' } },
      { codiceFiscale: { contains: cognomeFilter.value.toUpperCase(), mode: 'insensitive' } },
    ];
    whereClause.utente = { ...(whereClause.utente || {}), OR: utenteOr };
  }

  const servizioFilter = columnFilters.find((f) => f.key === 'servizio');
  if (servizioFilter?.value) {
    whereClause.servizio = { titolo: { contains: servizioFilter.value, mode: 'insensitive' } };
  }

  const datiFilter = columnFilters.find((f) => f.key === 'datiInEvidenza');
  if (datiFilter?.value) {
    whereClause.datiInEvidenza = { contains: datiFilter.value, mode: 'insensitive' };
  }

  // Tab-specific conditions
  Object.assign(whereClause, whereTab(tab, operatoreId));

  // Restano due filtri che non dipendono dall'assegnazione e che Prisma non
  // esprime: il formato di data italiano e la ricerca sull'assegnatario per
  // nome. Il secondo diventa una condizione ordinaria; il primo resta raw.
  const idConstraints: number[][] = [];

  const operatoreFilter = columnFilters.find((f) => f.key === 'operatore');
  if (operatoreFilter?.value) {
    whereClause.assegnatario = {
      OR: [
        { cognome: { contains: operatoreFilter.value, mode: 'insensitive' } },
        { nome: { contains: operatoreFilter.value, mode: 'insensitive' } },
      ],
    };
  }

  const dataColFilter = columnFilters.find((f) => f.key === 'dataInvio');
  if (dataColFilter?.value) {
    const term = `%${dataColFilter.value}%`;
    const rows = await prisma.$queryRaw<{ id: number }[]>`
      SELECT id FROM istanze
      WHERE TO_CHAR(data_invio, 'DD/MM/YYYY') LIKE ${term}
    `;
    idConstraints.push(rows.map((r) => Number(r.id)));
  }

  // Intersect all ID constraint sets into a single id filter
  if (idConstraints.length > 0) {
    let ids = idConstraints[0];
    for (let i = 1; i < idConstraints.length; i++) {
      const set = new Set(idConstraints[i]);
      ids = ids.filter((id) => set.has(id));
    }
    whereClause.id = { in: ids };
  }

  // Sort order
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let orderBy: any = { dataInvio: 'desc' };
  if (sort.field && sort.direction !== 0) {
    const dir = sort.direction === 1 ? 'asc' : 'desc';
    switch (sort.field) {
      case 'protoNumero':
        orderBy = { protoNumero: dir };
        break;
      case 'dataInvio':
        orderBy = { dataInvio: dir };
        break;
      case 'cognome':
        orderBy = { utente: { cognome: dir } };
        break;
      case 'servizio':
        orderBy = { servizio: { titolo: dir } };
        break;
      default:
        orderBy = { dataInvio: 'desc' };
    }
  }

  // Visibilità operatore (ufficio + servizi assegnati): applicata per ultima, in AND
  // con tutti i filtri di ricerca, così nessuna condizione OR può aggirarla.
  if (!isVisibilitaTotale(visibilita)) {
    const visibilitaFilter = istanzaVisibilityWhere(visibilita);
    whereClause.AND = whereClause.AND ? [...whereClause.AND, visibilitaFilter] : [visibilitaFilter];
  }

  const safePageSize = Math.max(1, pageSize);
  const safePage = Math.max(1, page);

  const [total, istanze, counts] = await Promise.all([
    prisma.istanza.count({ where: whereClause }),
    prisma.istanza.findMany({
      where: whereClause,
      include: {
        utente: {
          select: { nome: true, cognome: true, codiceFiscale: true, email: true },
        },
        servizio: {
          select: { titolo: true, campiInEvidenza: true },
        },
        attivitaCorrente: {
          include: {
            step: { select: { descrizione: true, ordine: true } },
          },
        },
        assegnatario: { select: { id: true, nome: true, cognome: true } },
        faseCorrente: {
          include: { ufficio: true },
        },
        comunicazioni: {
          select: { risposta: { select: { lettaDaOperatore: true } } },
        },
      },
      orderBy,
      skip: (safePage - 1) * safePageSize,
      take: safePageSize,
    }),
    getIstanzeCounts(visibilita),
  ]);

  const totalPages = Math.ceil(total / safePageSize) || 1;

  // Risposte del cittadino non ancora aperte da nessun operatore: vanno
  // evidenziate in lista, altrimenti restano invisibili fino all'apertura.
  const data = istanze.map(({ comunicazioni, ...istanza }) => ({
    ...istanza,
    risposteNuove: comunicazioni.filter((c) => c.risposta && !c.risposta.lettaDaOperatore).length,
  }));

  return NextResponse.json({
    data,
    total,
    page: safePage,
    totalPages,
    counts,
  });
}
