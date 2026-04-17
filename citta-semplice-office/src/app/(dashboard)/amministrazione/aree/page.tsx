import Link from 'next/link';
import prisma from '@/lib/db/prisma';
import { requireAdmin } from '@/lib/auth/session';
import { Card, CardBody, Badge } from '@/components/ui';

async function getAree() {
  return prisma.area.findMany({
    orderBy: { ordine: 'asc' },
    include: {
      _count: {
        select: { servizi: true },
      },
    },
  });
}

export default async function AreePage() {
  await requireAdmin();
  const aree = await getAree();

  return (
    <div>
      <Link href="/amministrazione" className="btn btn-link p-0 mb-2">
        ← Torna ad Amministrazione
      </Link>
      <div className="page-header d-flex justify-content-between align-items-start">
        <div>
          <h1>Aree</h1>
          <p>Gestione delle aree dei servizi</p>
        </div>
        <Link href="/amministrazione/aree/nuova" className="btn btn-primary">
          Nuova Area
        </Link>
      </div>

      <div className="row g-3">
        {aree.map((area) => (
          <div key={area.id} className="col-12 col-md-6 col-lg-4">
            <Card>
              <CardBody>
                <div className="d-flex justify-content-between align-items-start mb-2">
                  <h5 className="card-title mb-0">{area.nome}</h5>
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
                    href={`/amministrazione/aree/${area.id}`}
                    className="btn btn-sm btn-outline-primary"
                  >
                    Modifica
                  </Link>
                  <Link
                    href={`/amministrazione/servizi?area=${area.id}`}
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

      {aree.length === 0 && (
        <Card>
          <CardBody className="text-center py-5 text-muted">
            Nessuna area presente.
          </CardBody>
        </Card>
      )}
    </div>
  );
}
