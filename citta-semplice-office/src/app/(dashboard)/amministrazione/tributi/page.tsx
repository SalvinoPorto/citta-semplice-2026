import prisma from '@/lib/db/prisma';
import { requireAdmin } from '@/lib/auth/session';
import { Card, CardBody, Badge } from '@/components/ui';
import Link from 'next/link';

async function getTributi() {
  return prisma.tributo.findMany({
    orderBy: { codice: 'asc' },
    include: {
      _count: {
        select: { pagamenti: true },
      },
    },
  });
}

export default async function TributiPage() {
  await requireAdmin();
  const tributi = await getTributi();

  return (
    <div>
      <div className="page-header d-flex justify-content-between align-items-start">
        <div>
          <h1>Codici Tributo</h1>
          <p>Gestione dei codici tributo per i pagamenti</p>
        </div>
        <Link href="/amministrazione/tributi/nuovo" className="btn btn-primary">
          Nuovo Tributo
        </Link>
      </div>

      <Card>
        <CardBody>
          <div className="table-responsive">
            <table className="table table-hover">
              <thead>
                <tr>
                  <th>Codice</th>
                  <th>Descrizione</th>
                  <th>Pagamenti</th>
                  <th>Stato</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {tributi.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-4 text-muted">
                      Nessun tributo presente
                    </td>
                  </tr>
                ) : (
                  tributi.map((tributo) => (
                    <tr key={tributo.id}>
                      <td>
                        <code className="fw-bold">{tributo.codice}</code>
                      </td>
                      <td>{tributo.descrizione || '-'}</td>
                      <td>{tributo._count.pagamenti}</td>
                      <td>
                        {tributo.attivo ? (
                          <Badge variant="success">Attivo</Badge>
                        ) : (
                          <Badge variant="danger">Disattivo</Badge>
                        )}
                      </td>
                      <td>
                        <Link
                          href={`/amministrazione/tributi/${tributo.id}`}
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
