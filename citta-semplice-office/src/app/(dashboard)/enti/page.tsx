import Link from 'next/link';
import prisma from '@/lib/db/prisma';
import { requireAdmin } from '@/lib/auth/session';
import { Card, CardBody, Badge } from '@/components/ui';

async function getEnti() {
  return prisma.ente.findMany({
    orderBy: { ente: 'asc' },
    include: {
      _count: {
        select: {
          aree: true,
          operatori: true,
        },
      },
    },
  });
}

export default async function EntiPage() {
  await requireAdmin();
  const enti = await getEnti();

  return (
    <div>
      <div className="page-header d-flex justify-content-between align-items-start">
        <div>
          <h1>Enti</h1>
          <p>Gestione delle organizzazioni</p>
        </div>
        <Link href="/enti/nuovo" className="btn btn-primary">
          Nuovo Ente
        </Link>
      </div>

      <div className="row g-4">
        {enti.length === 0 ? (
          <div className="col-12">
            <Card>
              <CardBody className="text-center py-5 text-muted">
                Nessun ente presente
              </CardBody>
            </Card>
          </div>
        ) : (
          enti.map((ente) => (
            <div key={ente.id} className="col-12 col-md-6 col-lg-4">
              <Card>
                <CardBody>
                  <div className="d-flex justify-content-between align-items-start mb-3">
                    <h5 className="card-title mb-0">{ente.ente}</h5>
                    {ente.attivo ? (
                      <Badge variant="success">Attivo</Badge>
                    ) : (
                      <Badge variant="danger">Disattivo</Badge>
                    )}
                  </div>
                  {ente.descrizione && (
                    <p className="text-muted small mb-3">{ente.descrizione}</p>
                  )}
                  <div className="d-flex gap-3 mb-3">
                    <div>
                      <strong>{ente._count.aree}</strong>
                      <span className="text-muted ms-1">Aree</span>
                    </div>
                    <div>
                      <strong>{ente._count.operatori}</strong>
                      <span className="text-muted ms-1">Operatori</span>
                    </div>
                  </div>
                  {ente.email && (
                    <div className="small text-muted mb-1">
                      📧 {ente.email}
                    </div>
                  )}
                  {ente.telefono && (
                    <div className="small text-muted mb-3">
                      📞 {ente.telefono}
                    </div>
                  )}
                  <Link
                    href={`/enti/${ente.id}`}
                    className="btn btn-sm btn-outline-primary"
                  >
                    Modifica
                  </Link>
                </CardBody>
              </Card>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
