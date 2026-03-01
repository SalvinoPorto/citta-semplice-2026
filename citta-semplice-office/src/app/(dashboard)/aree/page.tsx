import Link from 'next/link';
import prisma from '@/lib/db/prisma';
import { requireAdmin } from '@/lib/auth/session';
import { Card, CardBody, Badge } from '@/components/ui';

async function getAree() {
  return prisma.area.findMany({
    orderBy: [{ ente: { ente: 'asc' } }, { ordine: 'asc' }],
    include: {
      ente: true,
      _count: {
        select: { servizi: true },
      },
    },
  });
}

export default async function AreePage() {
  await requireAdmin();
  const aree = await getAree();

  // Group by ente
  const areeByEnte = aree.reduce((acc, area) => {
    const enteNome = area.ente.ente;
    if (!acc[enteNome]) {
      acc[enteNome] = [];
    }
    acc[enteNome].push(area);
    return acc;
  }, {} as Record<string, typeof aree>);

  return (
    <div>
      <div className="page-header d-flex justify-content-between align-items-start">
        <div>
          <h1>Aree</h1>
          <p>Gestione delle aree dei servizi</p>
        </div>
        <Link href="/aree/nuova" className="btn btn-primary">
          Nuova Area
        </Link>
      </div>

      {Object.entries(areeByEnte).map(([enteNome, areeEnte]) => (
        <div key={enteNome} className="mb-4">
          <h4 className="mb-3">{enteNome}</h4>
          <div className="row g-3">
            {areeEnte.map((area) => (
              <div key={area.id} className="col-12 col-md-6 col-lg-4">
                <Card>
                  <CardBody>
                    <div className="d-flex justify-content-between align-items-start mb-2">
                      <h5 className="card-title mb-0">{area.titolo}</h5>
                      {area.attiva ? (
                        <Badge variant="success">Attiva</Badge>
                      ) : (
                        <Badge variant="danger">Disattiva</Badge>
                      )}
                    </div>
                    {area.descrizione && (
                      <p className="text-muted small mb-2">{area.descrizione}</p>
                    )}
                    <div className="mb-3">
                      <strong>{area._count.servizi}</strong>
                      <span className="text-muted ms-1">servizi</span>
                    </div>
                    <div className="d-flex gap-2">
                      <Link
                        href={`/aree/${area.id}`}
                        className="btn btn-sm btn-outline-primary"
                      >
                        Modifica
                      </Link>
                      <Link
                        href={`/servizi?area=${area.id}`}
                        className="btn btn-sm btn-outline-secondary"
                      >
                        Vedi Servizi
                      </Link>
                    </div>
                  </CardBody>
                </Card>
              </div>
            ))}
          </div>
        </div>
      ))}

      {aree.length === 0 && (
        <Card>
          <CardBody className="text-center py-5 text-muted">
            Nessuna area presente. Crea prima un ente, poi potrai aggiungere delle aree.
          </CardBody>
        </Card>
      )}
    </div>
  );
}
