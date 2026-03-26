import Link from 'next/link';
import prisma from '@/lib/db/prisma';
import { requireAdmin } from '@/lib/auth/session';
import { Card, CardBody, Badge } from '@/components/ui';

async function getEnte() {
  return prisma.ente.findFirst();
}

export default async function EntiPage() {
  await requireAdmin();
  const ente = await getEnte();

  return (
    <div>
      <Link href="/amministrazione" className="btn btn-link p-0 mb-2">
        ← Torna ad Amministrazione
      </Link>
      <div className="page-header d-flex justify-content-between align-items-start">
        <div>
          <h1>Ente</h1>
          <p>Gestione dell'organizzazione</p>
        </div>
        {/* <Link href="/amministrazione/enti/nuovo" className="btn btn-primary">
          Nuovo Ente
        </Link> */}
      </div>

      <div className="row g-4">
        {!ente ? (
          <div className="col-12">
            <Card>
              <CardBody className="text-center py-5 text-muted">
                Nessun ente presente
              </CardBody>
            </Card>
          </div>
        ) : (
          <div key={ente.id} className="col-12 col-md-6 col-lg-4">
            <Card>
              <CardBody>
                <div className="d-flex justify-content-between align-items-start mb-3">
                  <h5 className="card-title mb-0">{ente.nome}</h5>
                  {ente.attivo ? (
                    <Badge variant="success">Attivo</Badge>
                  ) : (
                    <Badge variant="danger">Disattivo</Badge>
                  )}
                </div>
                {ente.descrizione && (
                  <p className="text-muted small mb-3">{ente.descrizione}</p>
                )}
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
                  href={`/amministrazione/enti/${ente.id}`}
                  className="btn btn-sm btn-outline-primary"
                >
                  Modifica
                </Link>
              </CardBody>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
