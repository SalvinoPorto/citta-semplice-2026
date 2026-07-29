import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db/prisma';
import { auth } from '@/lib/auth';
import {
  getVisibilitaOperatore,
  istanzaVisibilityWhere,
  istanzaVisibilitySql,
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
  const visibilitaSql = istanzaVisibilitySql(visibilita, 'i');

  const [nuove, inLavorazionePropria, inLavorazioneAltri, respinte, concluse, totale] =
    await Promise.all([
      // "Nuove" = istanze il cui ULTIMO workflow non è assegnato a nessuno.
      // (Prima: `workflows: some(operatoreId null)`, che contava anche le istanze
      // già prese in carico da altri se un qualsiasi step passato era non assegnato:
      // nuove + mie + altri superava il totale delle istanze aperte.)
      prisma.$queryRaw<[{ count: bigint }]>`
          SELECT COUNT(DISTINCT i.id) as count
          FROM istanze i
          INNER JOIN workflows w ON w.istanza_id = i.id
          WHERE i.in_bozza = false AND i.conclusa = false AND i.respinta = false
          AND w.id = (SELECT w2.id FROM workflows w2 WHERE w2.istanza_id = i.id ORDER BY w2.data_variazione DESC LIMIT 1)
          AND w.operatore_id IS NULL
          ${visibilitaSql}
        `.then((r) => Number(r[0]?.count || 0)),
      prisma.$queryRaw<[{ count: bigint }]>`
          SELECT COUNT(DISTINCT i.id) as count
          FROM istanze i
          INNER JOIN workflows w ON w.istanza_id = i.id
          WHERE i.in_bozza = false AND i.conclusa = false AND i.respinta = false
          AND w.id = (SELECT w2.id FROM workflows w2 WHERE w2.istanza_id = i.id ORDER BY w2.data_variazione DESC LIMIT 1)
          AND w.operatore_id = ${operatoreId}
          ${visibilitaSql}
        `.then((r) => Number(r[0]?.count || 0)),
      prisma.$queryRaw<[{ count: bigint }]>`
          SELECT COUNT(DISTINCT i.id) as count
          FROM istanze i
          INNER JOIN workflows w ON w.istanza_id = i.id
          WHERE i.in_bozza = false AND i.conclusa = false AND i.respinta = false
          AND w.id = (SELECT w2.id FROM workflows w2 WHERE w2.istanza_id = i.id ORDER BY w2.data_variazione DESC LIMIT 1)
          AND w.operatore_id IS NOT NULL AND w.operatore_id != ${operatoreId}
          ${visibilitaSql}
        `.then((r) => Number(r[0]?.count || 0)),
      prisma.istanza.count({ where: { AND: [visibilitaFilter], inBozza: false, respinta: true } }),
      prisma.istanza.count({ where: { AND: [visibilitaFilter], inBozza: false, conclusa: true } }),
      prisma.istanza.count({ where: { AND: [visibilitaFilter], inBozza: false } }),
    ]);

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
  const whereClause: any = { inBozza: false };

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

  const servizioFilter = columnFilters.find((f) => f.key === 'servizio');
  if (servizioFilter?.value) {
    whereClause.servizio = { titolo: { contains: servizioFilter.value, mode: 'insensitive' } };
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
      // il vincolo "ultimo workflow non assegnato" è risolto sotto via raw SQL
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

  // il set di id è già ristretto alla visibilità per non gonfiare la clausola IN
  const visibilitaSql = istanzaVisibilitySql(visibilita, 'i');

  if (tab === 'nuove') {
    const rows = await prisma.$queryRaw<{ id: number }[]>`
      SELECT DISTINCT i.id FROM istanze i
      INNER JOIN workflows w ON w.istanza_id = i.id
      WHERE w.id = (SELECT w2.id FROM workflows w2 WHERE w2.istanza_id = i.id ORDER BY w2.data_variazione DESC LIMIT 1)
      AND w.operatore_id IS NULL
      ${visibilitaSql}
    `;
    idConstraints.push(rows.map((r) => Number(r.id)));
  } else if (tab === 'mie') {
    const rows = await prisma.$queryRaw<{ id: number }[]>`
      SELECT DISTINCT i.id FROM istanze i
      INNER JOIN workflows w ON w.istanza_id = i.id
      WHERE w.id = (SELECT w2.id FROM workflows w2 WHERE w2.istanza_id = i.id ORDER BY w2.data_variazione DESC LIMIT 1)
      AND w.operatore_id = ${operatoreId}
      ${visibilitaSql}
    `;
    idConstraints.push(rows.map((r) => Number(r.id)));
  } else if (tab === 'altri') {
    const rows = await prisma.$queryRaw<{ id: number }[]>`
        SELECT DISTINCT i.id FROM istanze i
        INNER JOIN workflows w ON w.istanza_id = i.id
        WHERE w.id = (SELECT w2.id FROM workflows w2 WHERE w2.istanza_id = i.id ORDER BY w2.data_variazione DESC LIMIT 1)
        AND w.operatore_id IS NOT NULL AND w.operatore_id != ${operatoreId}
        ${visibilitaSql}
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
