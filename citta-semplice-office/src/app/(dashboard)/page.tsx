import { getCurrentUser } from '@/lib/auth/session';
import prisma from '@/lib/db/prisma';
import { Card, CardBody, CardTitle } from '@/components/ui';
import Link from 'next/link';

async function getDashboardStats() {
  const [
    totalIstanze,
    istanzeAperte,
    istanzeConcluse,
    istanzeRespinte,
    moduliAttivi,
    operatoriAttivi,
  ] = await Promise.all([
    prisma.istanza.count(),
    prisma.istanza.count({
      where: { conclusa: false, respinta: false },
    }),
    prisma.istanza.count({
      where: { conclusa: true },
    }),
    prisma.istanza.count({
      where: { respinta: true },
    }),
    prisma.modulo.count({
      where: { attivo: true },
    }),
    prisma.operatore.count({
      where: { attivo: true },
    }),
  ]);

  return {
    totalIstanze,
    istanzeAperte,
    istanzeConcluse,
    istanzeRespinte,
    moduliAttivi,
    operatoriAttivi,
  };
}

async function getRecentIstanze() {
  return prisma.istanza.findMany({
    take: 10,
    orderBy: { dataInvio: 'desc' },
    include: {
      utente: {
        select: { nome: true, cognome: true, codiceFiscale: true },
      },
      servizio: {
        select: { titolo: true },
      },
    },
  });
}

export default async function DashboardPage() {
  const user = await getCurrentUser();
  const stats = await getDashboardStats();
  const recentIstanze = await getRecentIstanze();

  return (
    <div>
      <div className="page-header">
        <h1>Dashboard</h1>
        <p>Benvenuto, {user?.nome} {user?.cognome}</p>
      </div>

      {/* Stats Cards */}
      <div className="row g-4 mb-4">
        <div className="col-12 col-sm-6 col-lg-3">
          <Card>
            <CardBody className="stat-card">
              <div className="stat-value">{stats.totalIstanze}</div>
              <div className="stat-label">Istanze Totali</div>
            </CardBody>
          </Card>
        </div>
        <div className="col-12 col-sm-6 col-lg-3">
          <Card>
            <CardBody className="stat-card">
              <div className="stat-value text-warning">{stats.istanzeAperte}</div>
              <div className="stat-label">In Lavorazione</div>
            </CardBody>
          </Card>
        </div>
        <div className="col-12 col-sm-6 col-lg-3">
          <Card>
            <CardBody className="stat-card">
              <div className="stat-value text-success">{stats.istanzeConcluse}</div>
              <div className="stat-label">Concluse</div>
            </CardBody>
          </Card>
        </div>
        <div className="col-12 col-sm-6 col-lg-3">
          <Card>
            <CardBody className="stat-card">
              <div className="stat-value text-danger">{stats.istanzeRespinte}</div>
              <div className="stat-label">Respinte</div>
            </CardBody>
          </Card>
        </div>
      </div>

      {/* Quick Links */}
      <div className="row g-4 mb-4">
        <div className="col-12 col-md-6">
          <Card>
            <CardBody>
              <CardTitle>Moduli Attivi</CardTitle>
              <p className="text-muted mb-3">
                {stats.moduliAttivi} moduli disponibili
              </p>
              <Link href="/moduli" className="btn btn-outline-primary btn-sm">
                Gestisci Moduli
              </Link>
            </CardBody>
          </Card>
        </div>
        <div className="col-12 col-md-6">
          <Card>
            <CardBody>
              <CardTitle>Operatori</CardTitle>
              <p className="text-muted mb-3">
                {stats.operatoriAttivi} operatori attivi
              </p>
              <Link href="/operatori" className="btn btn-outline-primary btn-sm">
                Gestisci Operatori
              </Link>
            </CardBody>
          </Card>
        </div>
      </div>

      {/* Recent Istanze */}
      <Card>
        <CardBody>
          <div className="d-flex justify-content-between align-items-center mb-3">
            <CardTitle className="mb-0">Ultime Istanze</CardTitle>
            <Link href="/istanze" className="btn btn-primary btn-sm">
              Vedi Tutte
            </Link>
          </div>

          {recentIstanze.length > 0 ? (
            <div className="table-responsive">
              <table className="table table-hover mb-0">
                <thead>
                  <tr>
                    <th>Protocollo</th>
                    <th>Data Invio</th>
                    <th>Utente</th>
                    <th>Servizio</th>
                    <th>Stato</th>
                  </tr>
                </thead>
                <tbody>
                  {recentIstanze.map((istanza) => (
                    <tr key={istanza.id}>
                      <td>
                        <Link href={`/istanze/${istanza.id}`}>
                          {istanza.protoNumero}
                        </Link>
                      </td>
                      <td>
                        {new Date(istanza.dataInvio).toLocaleDateString('it-IT')}
                      </td>
                      <td>
                        {istanza.utente.cognome} {istanza.utente.nome}
                      </td>
                      <td>{istanza.servizio.titolo}</td>
                      <td>
                        {istanza.conclusa ? (
                          <span className="badge bg-success">Conclusa</span>
                        ) : istanza.respinta ? (
                          <span className="badge bg-danger">Respinta</span>
                        ) : (
                          <span className="badge bg-warning">
                            In Lavorazione
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-muted text-center py-4">
              Nessuna istanza presente
            </p>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
