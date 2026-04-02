import Link from 'next/link';
import prisma from '@/lib/db/prisma';
import { requireAdmin } from '@/lib/auth/session';
import { Card, CardBody, CardTitle, Badge } from '@/components/ui';

async function getSystemInfo() {
  const [
    entiCount,
    areeCount,
    serviziCount,
    operatoriCount,
    utentiCount,
    ruoliCount,
    emailConfig,
  ] = await Promise.all([
    prisma.ente.count(),
    prisma.area.count(),
    prisma.servizio.count(),
    prisma.operatore.count(),
    prisma.utente.count(),
    prisma.ruolo.count(),
    prisma.emailConfig.findFirst(),
  ]);

  return {
    entiCount,
    areeCount,
    serviziCount,
    operatoriCount,
    utentiCount,
    ruoliCount,
    emailConfig,
  };
}

export default async function AmministrazionePage() {
  await requireAdmin();
  const info = await getSystemInfo();

  const adminSections = [
    {
      title: 'Organizzazione',
      items: [
        { href: '/amministrazione/enti', label: 'Enti', count: info.entiCount },
        { href: '/amministrazione/aree', label: 'Aree', count: info.areeCount },
        { href: '/amministrazione/uffici', label: 'Uffici', count: 0 },
      ],
    },
    {
      title: 'Utenti e Ruoli',
      items: [
        { href: '/amministrazione/operatori', label: 'Operatori', count: info.operatoriCount },
        { href: '/amministrazione/ruoli', label: 'Ruoli', count: info.ruoliCount },
        { href: '/amministrazione/utenti', label: 'Utenti', count: info.utentiCount },
      ],
    },
    {
      title: 'Configurazione',
      items: [
        { href: '/amministrazione/servizi', label: 'Servizi', count: info.serviziCount },
        // { href: '/amministrazione/tributi', label: 'Codici Tributo', count: info.tributiCount },
      ],
    },
    {
      title: 'Sistema',
      items: [
        { href: '/amministrazione/email', label: 'Configurazione Email', status: info.emailConfig?.attivo ? 'attivo' : 'non configurato' },
        { href: '/statistiche', label: 'Statistiche', count: 0 },
        { href: '/ricerche', label: 'Ricerche ed Export', count: 0 },
      ],
    },
  ];

  return (
    <div>
      <div className="page-header">
        <h1>Amministrazione</h1>
        <p>Gestione e configurazione del sistema</p>
      </div>

      <div className="row g-4">
        {/* Admin Sections */}
        <div className="col-12 col-lg-8">
          <div className="row g-4">
            {adminSections.map((section) => (
              <div key={section.title} className="col-12 col-md-6">
                <Card>
                  <CardBody>
                    <CardTitle>{section.title}</CardTitle>
                    <ul className="list-group list-group-flush">
                      {section.items.map((item) => (
                        <li
                          key={item.href}
                          className="list-group-item d-flex justify-content-between align-items-center px-0"
                        >
                          <Link href={item.href} className="text-decoration-none">
                            {item.label}
                          </Link>
                          {'count' in item ? (
                            <Badge variant="secondary">{item.count}</Badge>
                          ) : 'status' in item ? (
                            <Badge variant={item.status === 'attivo' ? 'success' : 'warning'}>
                              {item.status}
                            </Badge>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  </CardBody>
                </Card>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Activity Log */}
        <div className="col-12 col-lg-4">

          {/* <Card>
            <CardBody>
              <CardTitle>Ultime Modifiche Moduli</CardTitle>
              {info.logRecenti.length > 0 ? (
                <ul className="list-unstyled mb-0">
                  {info.logRecenti.map((log) => (
                    <li key={log.id} className="mb-3 pb-3 border-bottom">
                      <div className="fw-bold">{log.modulo}</div>
                      <div className="small text-muted">
                        {log.operatore} -{' '}
                        {new Date(log.dataModifica).toLocaleString('it-IT')}
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-muted mb-0">Nessuna modifica recente</p>
              )}
            </CardBody>
          </Card> */}

          {/* System Status */}
          <Card className="mt-4">
            <CardBody>
              <CardTitle>Stato Sistema</CardTitle>
              <ul className="list-unstyled mb-0">
                <li className="d-flex justify-content-between mb-2">
                  <span>Database</span>
                  <Badge variant="success">Online</Badge>
                </li>
                <li className="d-flex justify-content-between mb-2">
                  <span>Cron Jobs</span>
                  <Badge variant={process.env.ENABLE_CRON_JOBS === 'true' ? 'success' : 'warning'}>
                    {process.env.ENABLE_CRON_JOBS === 'true' ? 'Attivi' : 'Disattivi'}
                  </Badge>
                </li>
                <li className="d-flex justify-content-between">
                  <span>Versione</span>
                  <span className="text-muted">1.0.0</span>
                </li>
              </ul>
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
