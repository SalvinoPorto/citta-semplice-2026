import Link from 'next/link';
import prisma from '@/lib/db/prisma';
import { requireAdmin } from '@/lib/auth/session';
import { Card, CardBody, Badge } from '@/components/ui';

async function getOperatori() {
  return prisma.operatore.findMany({
    orderBy: { cognome: 'asc' },
    include: {
      ruoli: {
        include: {
          ruolo: true,
        },
      },
      _count: {
        select: {
          servizi: true,
        },
      },
    },
  });
}

export default async function OperatoriPage() {
  await requireAdmin();
  const operatori = await getOperatori();

  return (
    <div>
      <Link href="/amministrazione" className="btn btn-link p-0 mb-2">
        ← Torna ad Amministrazione
      </Link>
      <div className="page-header d-flex justify-content-between align-items-start">
        <div>
          <h1>Operatori</h1>
          <p>Gestione degli operatori del sistema</p>
        </div>
        <Link href="/amministrazione/operatori/nuovo" className="btn btn-primary">
          Nuovo Operatore
        </Link>
      </div>

      <Card>
        <CardBody>
          <div className="table-responsive">
            <table className="table table-hover">
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>Email</th>
                  <th>Ruoli</th>
                  <th>Servizi</th>
                  <th>Stato</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {operatori.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-4 text-muted">
                      Nessun operatore presente
                    </td>
                  </tr>
                ) : (
                  operatori.map((operatore) => (
                    <tr key={operatore.id}>
                      <td>
                        <Link href={`/amministrazione/operatori/${operatore.id}`} className="fw-bold">
                          {operatore.cognome} {operatore.nome}
                        </Link>
                      </td>
                      <td>{operatore.email}</td>
                      <td>
                        <div className="d-flex gap-1 flex-wrap">
                          {operatore.ruoli.map((r) => (
                            <Badge key={r.ruoloId} variant="secondary">
                              {r.ruolo.nome}
                            </Badge>
                          ))}
                        </div>
                      </td>
                      <td>{operatore._count.servizi}</td>
                      <td>
                        {operatore.attivo ? (
                          <Badge variant="success">Attivo</Badge>
                        ) : (
                          <Badge variant="danger">Disattivo</Badge>
                        )}
                      </td>
                      <td>
                        <Link
                          href={`/amministrazione/operatori/${operatore.id}`}
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
