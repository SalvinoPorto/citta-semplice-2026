import Link from 'next/link';
import prisma from '@/lib/db/prisma';
import { Card, CardBody, CardTitle } from '@/components/ui';

interface SearchParams {
  periodo?: string;
}

async function getStatistiche(giorni: number) {
  const today = new Date();
  today.setHours(23, 59, 59, 999);
  const startDate = new Date(today);
  startDate.setDate(startDate.getDate() - giorni);
  startDate.setHours(0, 0, 0, 0);

  const [
    totalIstanze,
    istanzeAperte,
    istanzeConcluse,
    istanzeRespinte,
    istanzePeriodo,
    statisticheGiornaliere,
    statistichePagamenti,
    istanzePerModulo,
    istanzePerStato,
  ] = await Promise.all([
    prisma.istanza.count(),
    prisma.istanza.count({ where: { conclusa: false, respinta: false } }),
    prisma.istanza.count({ where: { conclusa: true } }),
    prisma.istanza.count({ where: { respinta: true } }),
    prisma.istanza.count({
      where: { dataInvio: { gte: startDate, lte: today } },
    }),
    prisma.statisticheGiornaliere.findMany({
      where: { data: { gte: startDate } },
      orderBy: { data: 'asc' },
    }),
    prisma.statistichePagamenti.findMany({
      where: { data: { gte: startDate } },
      orderBy: { data: 'asc' },
    }),
    prisma.istanza.groupBy({
      by: ['moduloId'],
      _count: true,
      where: { dataInvio: { gte: startDate, lte: today } },
      orderBy: { _count: { moduloId: 'desc' } },
      take: 10,
    }),
    prisma.istanza.groupBy({
      by: ['conclusa', 'respinta'],
      _count: true,
      where: { dataInvio: { gte: startDate, lte: today } },
    }),
  ]);

  // Get modulo names
  const moduloIds = istanzePerModulo.map((i) => i.moduloId);
  const moduli = await prisma.modulo.findMany({
    where: { id: { in: moduloIds } },
    select: { id: true, name: true },
  });

  const moduloMap = Object.fromEntries(moduli.map((m) => [m.id, m.name]));

  // Calculate status distribution
  const statoDistribuzione = {
    aperte: 0,
    concluse: 0,
    respinte: 0,
  };
  istanzePerStato.forEach((s) => {
    if (s.respinta) {
      statoDistribuzione.respinte = s._count;
    } else if (s.conclusa) {
      statoDistribuzione.concluse = s._count;
    } else {
      statoDistribuzione.aperte = s._count;
    }
  });

  return {
    totalIstanze,
    istanzeAperte,
    istanzeConcluse,
    istanzeRespinte,
    istanzePeriodo,
    statisticheGiornaliere,
    statistichePagamenti,
    istanzePerModulo: istanzePerModulo.map((i) => ({
      moduloId: i.moduloId,
      moduloName: moduloMap[i.moduloId] || 'Sconosciuto',
      count: i._count,
    })),
    statoDistribuzione,
    giorni,
  };
}

export default async function StatistichePage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const giorni = params.periodo ? parseInt(params.periodo) : 30;
  const stats = await getStatistiche(giorni);

  const totalePagamenti = stats.statistichePagamenti.reduce(
    (acc, s) => acc + s.importoTotale,
    0
  );
  const numeroTransazioni = stats.statistichePagamenti.reduce(
    (acc, s) => acc + s.numeroTransazioni,
    0
  );

  const periodi = [
    { label: '7 giorni', value: 7 },
    { label: '30 giorni', value: 30 },
    { label: '90 giorni', value: 90 },
    { label: '365 giorni', value: 365 },
  ];

  return (
    <div>
      <div className="page-header d-flex justify-content-between align-items-start">
        <div>
          <h1>Statistiche</h1>
          <p>Panoramica delle attività del sistema</p>
        </div>
        <Link href="/ricerche" className="btn btn-outline-primary">
          Esporta Dati
        </Link>
      </div>

      {/* Period Filter */}
      <div className="mb-4">
        <div className="d-flex flex-wrap gap-2">
          {periodi.map((periodo) => (
            <Link
              key={periodo.value}
              href={`/statistiche?periodo=${periodo.value}`}
              className={`btn btn-sm ${
                giorni === periodo.value ? 'btn-primary' : 'btn-outline-primary'
              }`}
            >
              {periodo.label}
            </Link>
          ))}
        </div>
      </div>

      {/* Summary Cards - Totals */}
      <div className="row g-4 mb-4">
        <div className="col-12 col-sm-6 col-lg-3">
          <Card>
            <CardBody className="stat-card">
              <div className="stat-value">{stats.totalIstanze}</div>
              <div className="stat-label">Istanze Totali (sempre)</div>
            </CardBody>
          </Card>
        </div>
        <div className="col-12 col-sm-6 col-lg-3">
          <Card>
            <CardBody className="stat-card">
              <div className="stat-value text-warning">{stats.istanzeAperte}</div>
              <div className="stat-label">In Lavorazione (sempre)</div>
            </CardBody>
          </Card>
        </div>
        <div className="col-12 col-sm-6 col-lg-3">
          <Card>
            <CardBody className="stat-card">
              <div className="stat-value text-success">{stats.istanzeConcluse}</div>
              <div className="stat-label">Concluse (sempre)</div>
            </CardBody>
          </Card>
        </div>
        <div className="col-12 col-sm-6 col-lg-3">
          <Card>
            <CardBody className="stat-card">
              <div className="stat-value text-danger">{stats.istanzeRespinte}</div>
              <div className="stat-label">Respinte (sempre)</div>
            </CardBody>
          </Card>
        </div>
      </div>

      {/* Period Stats */}
      <div className="row g-4 mb-4">
        <div className="col-12 col-md-4">
          <Card>
            <CardBody>
              <CardTitle>Istanze nel Periodo</CardTitle>
              <div className="display-4 text-primary mb-2">
                {stats.istanzePeriodo}
              </div>
              <p className="text-muted mb-0">ultimi {giorni} giorni</p>
            </CardBody>
          </Card>
        </div>
        <div className="col-12 col-md-4">
          <Card>
            <CardBody>
              <CardTitle>Pagamenti nel Periodo</CardTitle>
              <div className="display-4 text-success mb-2">
                €{totalePagamenti.toLocaleString('it-IT', { minimumFractionDigits: 2 })}
              </div>
              <p className="text-muted mb-0">{numeroTransazioni} transazioni</p>
            </CardBody>
          </Card>
        </div>
        <div className="col-12 col-md-4">
          <Card>
            <CardBody>
              <CardTitle>Media Giornaliera</CardTitle>
              <div className="display-4 text-info mb-2">
                {(stats.istanzePeriodo / giorni).toFixed(1)}
              </div>
              <p className="text-muted mb-0">istanze/giorno</p>
            </CardBody>
          </Card>
        </div>
      </div>

      {/* Status Distribution */}
      <Card className="mb-4">
        <CardBody>
          <CardTitle>Distribuzione Stato Istanze (ultimi {giorni} giorni)</CardTitle>
          <div className="row align-items-center">
            <div className="col-md-6">
              <div className="progress mb-3" style={{ height: '30px' }}>
                {stats.istanzePeriodo > 0 && (
                  <>
                    <div
                      className="progress-bar bg-warning"
                      style={{
                        width: `${(stats.statoDistribuzione.aperte / stats.istanzePeriodo) * 100}%`,
                      }}
                    >
                      Aperte ({stats.statoDistribuzione.aperte})
                    </div>
                    <div
                      className="progress-bar bg-success"
                      style={{
                        width: `${(stats.statoDistribuzione.concluse / stats.istanzePeriodo) * 100}%`,
                      }}
                    >
                      Concluse ({stats.statoDistribuzione.concluse})
                    </div>
                    <div
                      className="progress-bar bg-danger"
                      style={{
                        width: `${(stats.statoDistribuzione.respinte / stats.istanzePeriodo) * 100}%`,
                      }}
                    >
                      Respinte ({stats.statoDistribuzione.respinte})
                    </div>
                  </>
                )}
              </div>
            </div>
            <div className="col-md-6">
              <div className="d-flex justify-content-around text-center">
                <div>
                  <div className="h4 text-warning mb-0">{stats.statoDistribuzione.aperte}</div>
                  <small className="text-muted">Aperte</small>
                </div>
                <div>
                  <div className="h4 text-success mb-0">{stats.statoDistribuzione.concluse}</div>
                  <small className="text-muted">Concluse</small>
                </div>
                <div>
                  <div className="h4 text-danger mb-0">{stats.statoDistribuzione.respinte}</div>
                  <small className="text-muted">Respinte</small>
                </div>
              </div>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Top Moduli */}
      <Card className="mb-4">
        <CardBody>
          <CardTitle>Top 10 Moduli per Numero di Istanze (ultimi {giorni} giorni)</CardTitle>
          <div className="table-responsive">
            <table className="table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Modulo</th>
                  <th className="text-end">Istanze</th>
                  <th style={{ width: '40%' }}></th>
                </tr>
              </thead>
              <tbody>
                {stats.istanzePerModulo.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="text-center text-muted">
                      Nessuna istanza nel periodo selezionato
                    </td>
                  </tr>
                ) : (
                  stats.istanzePerModulo.map((item, index) => {
                    const percentage =
                      stats.istanzePeriodo > 0
                        ? (item.count / stats.istanzePeriodo) * 100
                        : 0;
                    return (
                      <tr key={item.moduloId}>
                        <td>{index + 1}</td>
                        <td>
                          <Link href={`/moduli/${item.moduloId}`}>{item.moduloName}</Link>
                        </td>
                        <td className="text-end">{item.count}</td>
                        <td>
                          <div className="progress" style={{ height: '20px' }}>
                            <div
                              className="progress-bar bg-primary"
                              style={{ width: `${percentage}%` }}
                            >
                              {percentage.toFixed(1)}%
                            </div>
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

      {/* Daily Chart */}
      <Card>
        <CardBody>
          <CardTitle>Andamento Giornaliero</CardTitle>
          <div className="table-responsive">
            <table className="table table-sm">
              <thead>
                <tr>
                  <th>Data</th>
                  <th className="text-end">Inviate</th>
                  <th className="text-end">Concluse</th>
                  <th className="text-end">Respinte</th>
                </tr>
              </thead>
              <tbody>
                {stats.statisticheGiornaliere.slice(-15).reverse().map((giorno) => (
                  <tr key={giorno.id}>
                    <td>{new Date(giorno.data).toLocaleDateString('it-IT')}</td>
                    <td className="text-end">{giorno.istanzeInviate}</td>
                    <td className="text-end text-success">{giorno.istanzeConcluse}</td>
                    <td className="text-end text-danger">{giorno.istanzeRespinte}</td>
                  </tr>
                ))}
                {stats.statisticheGiornaliere.length === 0 && (
                  <tr>
                    <td colSpan={4} className="text-center text-muted">
                      Nessun dato disponibile. I dati vengono generati dal job schedulato.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
