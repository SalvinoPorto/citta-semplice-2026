import prisma from '@/lib/db/prisma';
import { requireAdmin } from '@/lib/auth/session';
import { Card, CardBody, Badge } from '@/components/ui';
import Link from 'next/link';

async function getAttributoTypes() {
  return prisma.attributoType.findMany({
    orderBy: { tipoAttributo: 'asc' },
    include: {
      attributi: true,
      _count: {
        select: { moduli: true },
      },
    },
  });
}

export default async function AttributiPage() {
  await requireAdmin();
  const tipi = await getAttributoTypes();

  return (
    <div>
      <div className="page-header d-flex justify-content-between align-items-start">
        <div>
          <h1>Attributi</h1>
          <p>Gestione dei tipi di attributo e valori</p>
        </div>
        <Link href="/amministrazione/attributi/nuovo" className="btn btn-primary">
          Nuovo Tipo Attributo
        </Link>
      </div>

      <div className="row g-4">
        {tipi.length === 0 ? (
          <div className="col-12">
            <Card>
              <CardBody className="text-center py-5 text-muted">
                Nessun tipo di attributo presente
              </CardBody>
            </Card>
          </div>
        ) : (
          tipi.map((tipo) => (
            <div key={tipo.id} className="col-12 col-md-6 col-lg-4">
              <Card>
                <CardBody>
                  <div className="d-flex justify-content-between align-items-start mb-3">
                    <h5 className="card-title mb-0">{tipo.tipoAttributo}</h5>
                    <Badge variant="info">{tipo._count.moduli} moduli</Badge>
                  </div>

                  <p className="mb-2">
                    <strong>{tipo.attributi.length}</strong> valori definiti
                  </p>

                  {tipo.attributi.length > 0 && (
                    <div className="mb-3">
                      <div className="d-flex flex-wrap gap-1">
                        {tipo.attributi.slice(0, 5).map((attr) => (
                          <Badge key={attr.id} variant="light">
                            {attr.valore}
                          </Badge>
                        ))}
                        {tipo.attributi.length > 5 && (
                          <Badge variant="secondary">
                            +{tipo.attributi.length - 5}
                          </Badge>
                        )}
                      </div>
                    </div>
                  )}

                  <Link
                    href={`/amministrazione/attributi/${tipo.id}`}
                    className="btn btn-sm btn-outline-primary"
                  >
                    Gestisci
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
