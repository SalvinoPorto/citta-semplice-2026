import prisma from '@/lib/db/prisma';
import { requireAdmin } from '@/lib/auth/session';
import { Card, CardBody, Badge } from '@/components/ui';
import Link from 'next/link';

async function getRuoli() {
  return prisma.ruolo.findMany({
    orderBy: { nome: 'asc' },
    include: {
      _count: {
        select: { operatori: true },
      },
    },
  });
}

export default async function RuoliPage() {
  await requireAdmin();
  const ruoli = await getRuoli();

  return (
    <div>
      <Link href="/amministrazione" className="btn btn-link p-0">
        ← Torna ad Amministrazione
      </Link>

      <div className="page-header d-flex justify-content-between align-items-start">
        <div>
          <h1>Ruoli</h1>
          <p>Gestione dei ruoli operatore</p>
        </div>
        <Link href="/amministrazione/ruoli/nuovo" className="btn btn-primary">
          Nuovo Ruolo
        </Link>
      </div>

      <Card>
        <CardBody>
          <div className="table-responsive">
            <table className="table table-hover">
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>Descrizione</th>
                  <th>Permessi</th>
                  <th>Operatori</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {ruoli.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-4 text-muted">
                      Nessun ruolo presente
                    </td>
                  </tr>
                ) : (
                  ruoli.map((ruolo) => (
                    <tr key={ruolo.id}>
                      <td className="fw-bold">{ruolo.nome}</td>
                      <td>{ruolo.descrizione || '-'}</td>
                      <td>
                        <div className="d-flex flex-wrap gap-1">
                          {ruolo.permessi.slice(0, 3).map((permesso, i) => (
                            <Badge key={i} variant="info">
                              {permesso}
                            </Badge>
                          ))}
                          {ruolo.permessi.length > 3 && (
                            <Badge variant="light">+{ruolo.permessi.length - 3}</Badge>
                          )}
                        </div>
                      </td>
                      <td>{ruolo._count.operatori}</td>
                      <td>
                        <Link
                          href={`/amministrazione/ruoli/${ruolo.id}`}
                          className="btn btn-sm btn-outline-primary"
                        >
                          Modifica
                        </Link>
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
