import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db/prisma';
import { auth } from '@/lib/auth';

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
  codiceFiscale: string;
  modulo: string;
  anno: string;
  cerca: string;
}

interface SearchBody {
  tab: string;
  page: number;
  pageSize: number;
  sort: SortState;
  formFilters: FormFilters;
  columnFilters: Filter[];
}

async function getIstanzeCounts(operatoreId: number) {
  const [nuove, inLavorazionePropria, inLavorazioneAltri, respinte, concluse, totale] =
    await Promise.all([
      prisma.istanza.count({
        where: {
          conclusa: false,
          respinta: false,
          workflows: { every: { operatoreId: null } },
        },
      }),
      prisma.$queryRaw<[{ count: bigint }]>`
        SELECT COUNT(DISTINCT i.id) as count
        FROM istanze i
        INNER JOIN workflows w ON w.istanza_id = i.id
        WHERE i.conclusa = false AND i.respinta = false
        AND w.id = (
          SELECT w2.id FROM workflows w2
          WHERE w2.istanza_id = i.id
          ORDER BY w2.data_variazione DESC
          LIMIT 1
        )
        AND w.operatore_id = ${operatoreId}
      `.then((r) => Number(r[0]?.count || 0)),
      prisma.$queryRaw<[{ count: bigint }]>`
        SELECT COUNT(DISTINCT i.id) as count
        FROM istanze i
        INNER JOIN workflows w ON w.istanza_id = i.id
        WHERE i.conclusa = false AND i.respinta = false
        AND w.id = (
          SELECT w2.id FROM workflows w2
          WHERE w2.istanza_id = i.id
          ORDER BY w2.data_variazione DESC
          LIMIT 1
        )
        AND w.operatore_id IS NOT NULL
        AND w.operatore_id != ${operatoreId}
      `.then((r) => Number(r[0]?.count || 0)),
      prisma.istanza.count({ where: { respinta: true } }),
      prisma.istanza.count({ where: { conclusa: true } }),
      prisma.istanza.count(),
    ]);

  return { nuove, inLavorazionePropria, inLavorazioneAltri, respinte, concluse, totale };
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const operatoreId = parseInt(session.user.id);

  let body: SearchBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const {
    tab = 'nuove',
    page = 1,
    pageSize = 20,
    sort = { field: 'dataInvio', direction: -1 },
    formFilters = { protocollo: '', codiceFiscale: '', modulo: '', anno: '', cerca: '' },
    columnFilters = [],
  } = body;

  // Build where clause
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const whereClause: any = {};

  if (formFilters.modulo) {
    whereClause.moduloId = parseInt(formFilters.modulo);
  }

  if (formFilters.protocollo) {
    whereClause.OR = [
      { protoNumero: { contains: formFilters.protocollo, mode: 'insensitive' } },
      { protoFinaleNumero: { contains: formFilters.protocollo, mode: 'insensitive' } },
    ];
  }

  if (formFilters.codiceFiscale) {
    whereClause.utente = {
      codiceFiscale: { contains: formFilters.codiceFiscale.toUpperCase(), mode: 'insensitive' },
    };
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

  if (formFilters.cerca) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cercaConditions: any[] = [
      { datiInEvidenza: { contains: formFilters.cerca, mode: 'insensitive' } },
      { dati: { contains: formFilters.cerca, mode: 'insensitive' } },
      { utente: { cognome: { contains: formFilters.cerca, mode: 'insensitive' } } },
      { utente: { nome: { contains: formFilters.cerca, mode: 'insensitive' } } },
    ];
    if (whereClause.OR) {
      whereClause.AND = [{ OR: whereClause.OR }, { OR: cercaConditions }];
      delete whereClause.OR;
    } else {
      whereClause.OR = cercaConditions;
    }
  }

  // Column filter: protoNumero
  const protoColFilter = columnFilters.find((f) => f.key === 'protoNumero');
  if (protoColFilter?.value) {
    whereClause.protoNumero = { contains: protoColFilter.value, mode: 'insensitive' };
  }

  // Column filter: cognome (search nome, cognome, CF)
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

  // Column filter: datiInEvidenza
  const datiFilter = columnFilters.find((f) => f.key === 'datiInEvidenza');
  if (datiFilter?.value) {
    whereClause.datiInEvidenza = { contains: datiFilter.value, mode: 'insensitive' };
  }

  // Tab-specific conditions
  switch (tab) {
    case 'nuove':
      whereClause.conclusa = false;
      whereClause.respinta = false;
      whereClause.workflows = { every: { operatoreId: null } };
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
        orderBy = { modulo: { name: dir } };
        break;
      default:
        orderBy = { dataInvio: 'desc' };
    }
  }

  let istanze = await prisma.istanza.findMany({
    where: whereClause,
    include: {
      utente: {
        select: { nome: true, cognome: true, codiceFiscale: true, email: true },
      },
      modulo: {
        select: { name: true, campiInEvidenza: true },
      },
      workflows: {
        orderBy: { dataVariazione: 'desc' },
        take: 1,
        include: {
          step: { select: { descrizione: true, ordine: true } },
          status: { select: { stato: true } },
          operatore: { select: { id: true, nome: true, cognome: true } },
        },
      },
    },
    orderBy,
  });

  // In-memory filtering for mie/altri tabs
  if (tab === 'mie') {
    istanze = istanze.filter((i) => i.workflows[0]?.operatore?.id === operatoreId);
  } else if (tab === 'altri') {
    istanze = istanze.filter((i) => {
      const op = i.workflows[0]?.operatore;
      return op?.id && op.id !== operatoreId;
    });
  }

  // In-memory filter: operatore column
  const operatoreFilter = columnFilters.find((f) => f.key === 'operatore');
  if (operatoreFilter?.value) {
    const term = operatoreFilter.value.toLowerCase();
    istanze = istanze.filter((i) => {
      const op = i.workflows[0]?.operatore;
      if (!op) return false;
      return op.cognome.toLowerCase().includes(term) || op.nome.toLowerCase().includes(term);
    });
  }

  // In-memory filter: dataInvio column (text search on formatted date)
  const dataColFilter = columnFilters.find((f) => f.key === 'dataInvio');
  if (dataColFilter?.value) {
    const term = dataColFilter.value.toLowerCase();
    istanze = istanze.filter((i) =>
      new Date(i.dataInvio).toLocaleDateString('it-IT').toLowerCase().includes(term)
    );
  }

  const total = istanze.length;
  const safePageSize = Math.max(1, pageSize);
  const safePage = Math.max(1, page);
  const start = (safePage - 1) * safePageSize;
  const paginatedIstanze = istanze.slice(start, start + safePageSize);
  const totalPages = Math.ceil(total / safePageSize) || 1;

  const counts = await getIstanzeCounts(operatoreId);

  return NextResponse.json({
    data: paginatedIstanze,
    total,
    page: safePage,
    totalPages,
    counts,
  });
}
