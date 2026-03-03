import Link from 'next/link';
import prisma from '@/lib/db/prisma';
import { Card, CardBody, Badge } from '@/components/ui';

async function getModuli() {
  return prisma.modulo.findMany({
    orderBy: { name: 'asc' },
    include: {
      _count: {
        select: { servizi: true },
      },
    },
  });
}

export default async function ModuliPage() {
  const moduli = await getModuli();

  return (
    <div>
      <div className="page-header d-flex justify-content-between align-items-start">
        <div>
          <h1>Moduli</h1>
          <p>Gestione dei moduli e template form</p>
        </div>
        <Link href="/moduli/nuovo" className="btn btn-primary">
          Nuovo Modulo
        </Link>
      </div>

      <Card>
        <CardBody>
          <div className="table-responsive">
            <table className="table table-hover">
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>Tipo</th>
                  <th>Servizi</th>
                  <th>Stato</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {moduli.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-4 text-muted">
                      Nessun modulo presente
                    </td>
                  </tr>
                ) : (
                  moduli.map((modulo) => (
                    <tr key={modulo.id}>
                      <td>
                        <Link href={`/moduli/${modulo.id}`} className="fw-bold">
                          {modulo.name}
                        </Link>
                        {modulo.description && (
                          <div className="small text-muted">
                            {modulo.description.substring(0, 60)}
                            {modulo.description.length > 60 && '...'}
                          </div>
                        )}
                      </td>
                      <td>
                        <Badge variant={modulo.tipo === 'HTML' ? 'info' : 'secondary'}>
                          {modulo.tipo}
                        </Badge>
                      </td>
                      <td>{modulo._count.servizi}</td>
                      <td>
                        {modulo.attivo ? (
                          <Badge variant="success">Attivo</Badge>
                        ) : (
                          <Badge variant="danger">Disattivo</Badge>
                        )}
                      </td>
                      <td>
                        <div className="d-flex gap-1">
                          <Link
                            href={`/moduli/${modulo.id}`}
                            className="btn btn-sm btn-outline-primary"
                          >
                            Modifica
                          </Link>
                          <Link
                            href={`/moduli/${modulo.id}/clone`}
                            className="btn btn-sm btn-outline-secondary"
                          >
                            Clona
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
