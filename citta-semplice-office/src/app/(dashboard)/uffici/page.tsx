import Link from 'next/link';
import prisma from '@/lib/db/prisma';
import { requireAdmin } from '@/lib/auth/session';
import { Card, CardBody, Badge } from '@/components/ui';

async function getUffici() {
  return prisma.ufficio.findMany({
    orderBy: { nome: 'asc' },
    include: {
      _count: {
        select: { moduli: true },
      },
    },
  });
}

export default async function UfficiPage() {
  await requireAdmin();
  const uffici = await getUffici();

  return (
    <div>
      <div className="page-header d-flex justify-content-between align-items-start">
        <div>
          <h1>Uffici</h1>
          <p>Gestione degli uffici</p>
        </div>
        <Link href="/uffici/nuovo" className="btn btn-primary">
          Nuovo Ufficio
        </Link>
      </div>

      <div className="row g-4">
        {uffici.length === 0 ? (
          <div className="col-12">
            <Card>
              <CardBody className="text-center py-5 text-muted">
                Nessun ufficio presente
              </CardBody>
            </Card>
          </div>
        ) : (
          uffici.map((ufficio) => (
            <div key={ufficio.id} className="col-12 col-md-6 col-lg-4">
              <Card>
                <CardBody>
                  <div className="d-flex justify-content-between align-items-start mb-2">
                    <h5 className="card-title mb-0">{ufficio.nome}</h5>
                    {ufficio.attivo ? (
                      <Badge variant="success">Attivo</Badge>
                    ) : (
                      <Badge variant="danger">Disattivo</Badge>
                    )}
                  </div>
                  {ufficio.descrizione && (
                    <p className="text-muted small mb-3">{ufficio.descrizione}</p>
                  )}
                  <div className="mb-3">
                    <strong>{ufficio._count.moduli}</strong>
                    <span className="text-muted ms-1">moduli assegnati</span>
                  </div>
                  {ufficio.email && (
                    <div className="small text-muted mb-1">📧 {ufficio.email}</div>
                  )}
                  {ufficio.telefono && (
                    <div className="small text-muted mb-1">📞 {ufficio.telefono}</div>
                  )}
                  {ufficio.indirizzo && (
                    <div className="small text-muted mb-3">📍 {ufficio.indirizzo}</div>
                  )}
                  <Link
                    href={`/uffici/${ufficio.id}`}
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
