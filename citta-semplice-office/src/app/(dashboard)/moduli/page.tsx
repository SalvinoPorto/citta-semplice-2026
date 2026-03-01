import Link from 'next/link';
import prisma from '@/lib/db/prisma';
import { Card, CardBody, Button, Badge } from '@/components/ui';

async function getModuli() {
  return prisma.modulo.findMany({
    orderBy: { name: 'asc' },
    include: {
      servizio: {
        include: {
          area: {
            include: {
              ente: true,
            },
          },
        },
      },
      ufficio: true,
      steps: {
        where: { attivo: true },
      },
      _count: {
        select: {
          istanze: true,
        },
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
                  <th>Servizio</th>
                  <th>Tipo</th>
                  <th>Periodo</th>
                  <th>Steps</th>
                  <th>Istanze</th>
                  <th>Stato</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {moduli.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center py-4 text-muted">
                      Nessun modulo presente
                    </td>
                  </tr>
                ) : (
                  moduli.map((modulo) => {
                    const now = new Date();
                    const isActive =
                      modulo.attivo &&
                      new Date(modulo.dataInizio) <= now &&
                      new Date(modulo.dataFine) >= now;

                    return (
                      <tr key={modulo.id}>
                        <td>
                          <Link href={`/moduli/${modulo.id}`} className="fw-bold">
                            {modulo.name}
                          </Link>
                          {modulo.description && (
                            <div className="small text-muted">
                              {modulo.description.substring(0, 50)}
                              {modulo.description.length > 50 && '...'}
                            </div>
                          )}
                        </td>
                        <td>
                          <div>{modulo.servizio.titolo}</div>
                          <small className="text-muted">
                            {modulo.servizio.area.titolo}
                          </small>
                        </td>
                        <td>
                          <Badge variant={modulo.tipo === 'HTML' ? 'info' : 'secondary'}>
                            {modulo.tipo}
                          </Badge>
                        </td>
                        <td>
                          <small>
                            {new Date(modulo.dataInizio).toLocaleDateString('it-IT')}
                            {' - '}
                            {new Date(modulo.dataFine).toLocaleDateString('it-IT')}
                          </small>
                        </td>
                        <td>{modulo.steps.length}</td>
                        <td>{modulo._count.istanze}</td>
                        <td>
                          {isActive ? (
                            <Badge variant="success">Attivo</Badge>
                          ) : modulo.attivo ? (
                            <Badge variant="warning">Non in periodo</Badge>
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
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
