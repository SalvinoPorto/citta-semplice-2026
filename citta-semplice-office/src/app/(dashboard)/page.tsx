import { requireAuth } from '@/lib/auth/session';
import prisma from '@/lib/db/prisma';
import {
  getVisibilitaOperatore,
  istanzaVisibilityWhere,
  type VisibilitaOperatore,
} from '@/lib/auth/visibilita';
import { getStatoIstanza } from '@/lib/models/stato-istanza';
import { Card, CardBody, CardTitle, Badge } from '@/components/ui';
import Link from 'next/link';

async function getDashboardStats(visibilita: VisibilitaOperatore) {
  const v = istanzaVisibilityWhere(visibilita);
  const [
    totalIstanze,
    istanzeAperte,
    istanzeConcluse,
    istanzeRespinte,
  ] = await Promise.all([
    prisma.istanza.count({ where: { inBozza: false, AND: [v] } }),
    prisma.istanza.count({
      where: { inBozza: false, conclusa: false, respinta: false, AND: [v] },
    }),
    prisma.istanza.count({
      where: { inBozza: false, conclusa: true, AND: [v] },
    }),
    prisma.istanza.count({
      where: { inBozza: false, respinta: true, AND: [v] },
    }),
  ]);

  return {
    totalIstanze,
    istanzeAperte,
    istanzeConcluse,
    istanzeRespinte,
  };
}

/** Card di governo (servizi/operatori): solo per gli amministratori. */
async function getAdminStats() {
  const [serviziAttivi, operatoriAttivi] = await Promise.all([
    prisma.servizio.count({ where: { attivo: true } }),
    prisma.operatore.count({ where: { attivo: true } }),
  ]);

  return { serviziAttivi, operatoriAttivi };
}

async function getRecentIstanze(visibilita: VisibilitaOperatore) {
  return prisma.istanza.findMany({
    take: 10,
    orderBy: { dataInvio: 'desc' },
    where: { inBozza: false, AND: [istanzaVisibilityWhere(visibilita)] },
    include: {
      utente: {
        select: { nome: true, cognome: true, codiceFiscale: true },
      },
      servizio: {
        select: { titolo: true },
      },
      // serve per lo stato: stesso criterio della lista istanze
      workflows: {
        orderBy: { dataVariazione: 'desc' },
        take: 1,
        select: { operatoreId: true, stato: true },
      },
    },
  });
}

export default async function DashboardPage() {
  const user = await requireAuth();
  const visibilita = await getVisibilitaOperatore(parseInt(user.id), user.ruoli);
  const stats = await getDashboardStats(visibilita);
  const adminStats = visibilita.isAdmin ? await getAdminStats() : null;
  const recentIstanze = await getRecentIstanze(visibilita);

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

      {/* Quick Links - solo admin */}
      {adminStats && (
        <div className="row g-4 mb-4">
          <div className="col-12 col-md-6">
            <Card>
              <CardBody>
                <CardTitle>Servizi Attivi</CardTitle>
                <p className="text-muted mb-3">
                  {adminStats.serviziAttivi} servizi disponibili
                </p>
                <Link href="/amministrazione/servizi" className="btn btn-outline-primary btn-sm">
                  Gestisci servizi
                </Link>
              </CardBody>
            </Card>
          </div>
          <div className="col-12 col-md-6">
            <Card>
              <CardBody>
                <CardTitle>Operatori</CardTitle>
                <p className="text-muted mb-3">
                  {adminStats.operatoriAttivi} operatori attivi
                </p>
                <Link href="/amministrazione/operatori" className="btn btn-outline-primary btn-sm">
                  Gestisci Operatori
                </Link>
              </CardBody>
            </Card>
          </div>
        </div>
      )}

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
                        {(() => {
                          const stato = getStatoIstanza({
                            conclusa: istanza.conclusa,
                            respinta: istanza.respinta,
                            ultimoWorkflow: istanza.workflows[0] ?? null,
                          });
                          return <Badge variant={stato.variant}>{stato.label}</Badge>;
                        })()}
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
