import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db/prisma';
import { auth } from '@/lib/auth';
import { ROLES } from '@/lib/auth/roles';

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

function buildUfficioFilter(ufficioId: number) {
  return {
    OR: [
      { ufficioCorrenteId: ufficioId },
      { ufficioCorrenteId: null, faseCorrente: { ufficioId } },
    ],
  };
}

async function getIstanzeCounts(operatoreId: number, isAdmin: boolean, ufficioId: number | null) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const visibilitaFilter: any = isAdmin || !ufficioId ? {} : buildUfficioFilter(ufficioId);

  const [nuove, inLavorazionePropria, inLavorazioneAltri, respinte, concluse, totale] =
    await Promise.all([
      prisma.istanza.count({
        where: { ...visibilitaFilter, inBozza: false, conclusa: false, respinta: false, workflows: { some: { operatoreId: null, stato: 0 } } },
      }),
      prisma.$queryRaw<[{ count: bigint }]>`
          SELECT COUNT(DISTINCT i.id) as count
          FROM istanze i
          INNER JOIN workflows w ON w.istanza_id = i.id
          WHERE i.in_bozza = false AND i.conclusa = false AND i.respinta = false
          AND w.id = (SELECT w2.id FROM workflows w2 WHERE w2.istanza_id = i.id ORDER BY w2.data_variazione DESC LIMIT 1)
          AND w.operatore_id = ${operatoreId}
        `.then((r) => Number(r[0]?.count || 0)),
      prisma.$queryRaw<[{ count: bigint }]>`
          SELECT COUNT(DISTINCT i.id) as count
          FROM istanze i
          INNER JOIN workflows w ON w.istanza_id = i.id
          WHERE i.in_bozza = false AND i.conclusa = false AND i.respinta = false
          AND w.id = (SELECT w2.id FROM workflows w2 WHERE w2.istanza_id = i.id ORDER BY w2.data_variazione DESC LIMIT 1)
          AND w.operatore_id IS NOT NULL AND w.operatore_id != ${operatoreId}
        `.then((r) => Number(r[0]?.count || 0)),
      prisma.istanza.count({ where: { ...visibilitaFilter, inBozza: false, respinta: true } }),
      prisma.istanza.count({ where: { ...visibilitaFilter, inBozza: false, conclusa: true } }),
      prisma.istanza.count({ where: { ...visibilitaFilter, inBozza: false } }),
    ]);

  return { nuove, inLavorazionePropria, inLavorazioneAltri, respinte, concluse, totale };
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const operatoreId = parseInt(session.user.id);
  const isAdmin = (session.user.ruoli ?? []).includes(ROLES.ADMIN);

  const operatoreDb = isAdmin ? null : await prisma.operatore.findUnique({
    where: { id: operatoreId },
    select: { ufficioId: true },
  });
  const ufficioId = operatoreDb?.ufficioId ?? null;

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
  const whereClause: any = { inBozza: false };

  if (!isAdmin && ufficioId) {
    const f = buildUfficioFilter(ufficioId);
    whereClause.OR = f.OR;
  }

  if (formFilters.modulo) {
    whereClause.servizioId = parseInt(formFilters.modulo);
  }

  if (formFilters.protocollo) {
    whereClause.OR = [
      { protoNumero: { contains: formFilters.protocollo, mode: 'insensitive' } },
      { protoFinaleNumero: { contains: formFilters.protocollo, mode: 'insensitive' } },
    ];
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
    // Copre sia fase con ufficio fisso che ufficio variabile scelto dall'operatore
    const ufficioConditions = [
      { faseCorrente: { ufficioId: uid } },
      { ufficioCorrenteId: uid },
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cercaConditions: any[] = [
      { datiInEvidenza: { contains: formFilters.cerca, mode: 'insensitive' } },
      { dati: { contains: formFilters.cerca, mode: 'insensitive' } },
      { utente: { cognome: { contains: formFilters.cerca, mode: 'insensitive' } } },
      { utente: { nome: { contains: formFilters.cerca, mode: 'insensitive' } } },
      { utente: { codiceFiscale: { contains: formFilters.cerca.toUpperCase(), mode: 'insensitive' } } },
    ];
    if (whereClause.OR) {
      whereClause.AND = [{ OR: whereClause.OR }, { OR: cercaConditions }];
      delete whereClause.OR;
    } else {
      whereClause.OR = cercaConditions;
    }
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

  const datiFilter = columnFilters.find((f) => f.key === 'datiInEvidenza');
  if (datiFilter?.value) {
    whereClause.datiInEvidenza = { contains: datiFilter.value, mode: 'insensitive' };
  }

  // Tab-specific conditions
  switch (tab) {
    case 'nuove':
      whereClause.conclusa = false;
      whereClause.respinta = false;
      whereClause.workflows = { some: { operatoreId: null, stato: 0 } };
      break;
    case 'mie':
    case 'altri':
      whereClause.conclusa = false;
      whereClause.respinta = false;
      break;
    case 'respinte':
      whereClause.respinta = true;
      break;
    case 'concluse':
      whereClause.conclusa = true;
      break;
    // 'tutte': no additional filter
  }

  // Filters that require raw SQL (latest workflow join) are resolved as ID sets
  // and intersected into the where clause at DB level
  const idConstraints: number[][] = [];

  if (tab === 'mie') {
    const rows = await prisma.$queryRaw<{ id: number }[]>`
      SELECT DISTINCT i.id FROM istanze i
      INNER JOIN workflows w ON w.istanza_id = i.id
      WHERE w.id = (SELECT w2.id FROM workflows w2 WHERE w2.istanza_id = i.id ORDER BY w2.data_variazione DESC LIMIT 1)
      AND w.operatore_id = ${operatoreId}
    `;
    idConstraints.push(rows.map((r) => Number(r.id)));
  } else if (tab === 'altri') {
    const rows = await prisma.$queryRaw<{ id: number }[]>`
        SELECT DISTINCT i.id FROM istanze i
        INNER JOIN workflows w ON w.istanza_id = i.id
        WHERE w.id = (SELECT w2.id FROM workflows w2 WHERE w2.istanza_id = i.id ORDER BY w2.data_variazione DESC LIMIT 1)
        AND w.operatore_id IS NOT NULL AND w.operatore_id != ${operatoreId}
      `;
    idConstraints.push(rows.map((r) => Number(r.id)));
  }

  const operatoreFilter = columnFilters.find((f) => f.key === 'operatore');
  if (operatoreFilter?.value) {
    const term = `%${operatoreFilter.value}%`;
    const rows = await prisma.$queryRaw<{ id: number }[]>`
      SELECT DISTINCT i.id FROM istanze i
      INNER JOIN workflows w ON w.istanza_id = i.id
      INNER JOIN operatori o ON o.id = w.operatore_id
      WHERE w.id = (SELECT w2.id FROM workflows w2 WHERE w2.istanza_id = i.id ORDER BY w2.data_variazione DESC LIMIT 1)
      AND (o.cognome ILIKE ${term} OR o.nome ILIKE ${term})
    `;
    idConstraints.push(rows.map((r) => Number(r.id)));
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
      case 'modulo':
        orderBy = { servizio: { titolo: dir } };
        break;
      default:
        orderBy = { dataInvio: 'desc' };
    }
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
        workflows: {
          orderBy: { dataVariazione: 'desc' },
          take: 1,
          include: {
            step: { select: { descrizione: true, ordine: true } },
            operatore: { select: { id: true, nome: true, cognome: true } },
          },
        },
        faseCorrente: {
          include: { ufficio: true },
        },
        ufficioCorrente: true,
      },
      orderBy,
      skip: (safePage - 1) * safePageSize,
      take: safePageSize,
    }),
    getIstanzeCounts(operatoreId, isAdmin, ufficioId),
  ]);

  const totalPages = Math.ceil(total / safePageSize) || 1;

  return NextResponse.json({
    data: istanze,
    total,
    page: safePage,
    totalPages,
    counts,
  });
}
