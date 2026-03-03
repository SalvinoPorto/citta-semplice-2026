import Link from 'next/link';
import prisma from '@/lib/db/prisma';
import { requireAdmin } from '@/lib/auth/session';
import { Card, CardBody, Badge } from '@/components/ui';

interface SearchParams {
  area?: string;
}

async function getServizi(areaId?: number) {
  const where = areaId ? { areaId } : {};

  return prisma.servizio.findMany({
    where,
    orderBy: [{ area: { titolo: 'asc' } }, { ordine: 'asc' }],
    include: {
      area: {
        select: { titolo: true },
      },
      modulo: {
        select: { name: true, tipo: true },
      },
      _count: {
        select: { steps: true },
      },
    },
  });
}

async function getAree() {
  return prisma.area.findMany({
    where: { attiva: true },
    orderBy: { titolo: 'asc' },
  });
}

export default async function ServiziPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireAdmin();
  const areaId = searchParams.area ? parseInt(searchParams.area) : undefined;
  const [servizi, aree] = await Promise.all([getServizi(areaId), getAree()]);

  return (
    <div>
      <div className="page-header d-flex justify-content-between align-items-start">
        <div>
          <h1>Servizi</h1>
          <p>Gestione dei servizi offerti</p>
        </div>
        <Link href="/servizi/nuovo" className="btn btn-primary">
          Nuovo Servizio
        </Link>
      </div>

      {/* Filter by Area */}
      <div className="mb-4">
        <div className="d-flex flex-wrap gap-2">
          <Link
            href="/servizi"
            className={`btn btn-sm ${!areaId ? 'btn-primary' : 'btn-outline-primary'}`}
          >
            Tutti
          </Link>
          {aree.map((area) => (
            <Link
              key={area.id}
              href={`/servizi?area=${area.id}`}
              className={`btn btn-sm ${
                areaId === area.id ? 'btn-primary' : 'btn-outline-primary'
              }`}
            >
              {area.titolo}
            </Link>
          ))}
        </div>
      </div>

      <Card>
        <CardBody>
          <div className="table-responsive">
            <table className="table table-hover">
              <thead>
                <tr>
                  <th>Titolo</th>
                  <th>Area</th>
                  <th>Modulo</th>
                  <th>Steps</th>
                  <th>Stato</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {servizi.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-4 text-muted">
                      Nessun servizio presente
                    </td>
                  </tr>
                ) : (
                  servizi.map((servizio) => (
                    <tr key={servizio.id}>
                      <td>
                        <Link href={`/servizi/${servizio.id}`} className="fw-bold">
                          {servizio.titolo}
                        </Link>
                        {servizio.descrizione && (
                          <div className="small text-muted">
                            {servizio.descrizione.substring(0, 60)}
                            {servizio.descrizione.length > 60 && '...'}
                          </div>
                        )}
                      </td>
                      <td>{servizio.area.titolo}</td>
                      <td>
                        {servizio.modulo ? (
                          <span className="small">{servizio.modulo.name}</span>
                        ) : (
                          <span className="text-muted small">—</span>
                        )}
                      </td>
                      <td>{servizio._count.steps}</td>
                      <td>
                        {servizio.attivo ? (
                          <Badge variant="success">Attivo</Badge>
                        ) : (
                          <Badge variant="danger">Disattivo</Badge>
                        )}
                      </td>
                      <td>
                        <div className="d-flex gap-1">
                          <Link
                            href={`/servizi/${servizio.id}`}
                            className="btn btn-sm btn-outline-primary"
                          >
                            Modifica
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
