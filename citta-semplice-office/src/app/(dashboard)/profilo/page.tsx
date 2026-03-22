import { requireAuth } from '@/lib/auth/session';
import prisma from '@/lib/db/prisma';
import { Card, CardBody, CardTitle, Badge } from '@/components/ui';

async function getOperatoreDetails(operatoreId: number) {
  return prisma.operatore.findUnique({
    where: { id: operatoreId },
    include: {
      ruoli: {
        include: {
          ruolo: true,
        },
      },
      servizi: {
        include: {
          servizio: {
            select: { id: true, titolo: true },
          },
        },
      },
    },
  });
}

export default async function ProfiloPage() {
  const user = await requireAuth();
  const operatore = await getOperatoreDetails(parseInt(user.id));

  if (!operatore) {
    return <div>Operatore non trovato</div>;
  }

  return (
    <div>
      <div className="page-header">
        <h1>Il mio Profilo</h1>
        <p>Visualizza le informazioni del tuo account</p>
      </div>

      <div className="row g-4">
        <div className="col-12 col-lg-6">
          <Card>
            <CardBody>
              <CardTitle>Informazioni Personali</CardTitle>
              <div className="row g-3">
                <div className="col-md-6">
                  <label className="form-label text-muted small">Nome</label>
                  <div className="fw-bold">{operatore.nome}</div>
                </div>
                <div className="col-md-6">
                  <label className="form-label text-muted small">Cognome</label>
                  <div className="fw-bold">{operatore.cognome}</div>
                </div>
                <div className="col-md-12">
                  <label className="form-label text-muted small">Email</label>
                  <div className="fw-bold">{operatore.email}</div>
                </div>
                {operatore.telefono && (
                  <div className="col-md-6">
                    <label className="form-label text-muted small">Telefono</label>
                    <div className="fw-bold">{operatore.telefono}</div>
                  </div>
                )}
              </div>
            </CardBody>
          </Card>
        </div>

        <div className="col-12 col-lg-6">
          <Card className="mb-4">
            <CardBody>
              <CardTitle>Ruoli Assegnati</CardTitle>
              {operatore.ruoli.length === 0 ? (
                <p className="text-muted">Nessun ruolo assegnato</p>
              ) : (
                <div className="d-flex flex-wrap gap-2">
                  {operatore.ruoli.map((r) => (
                    <Badge
                      key={r.ruoloId}
                      variant={r.ruolo.nome === 'admin' ? 'danger' : 'primary'}
                      className="fs-6"
                    >
                      {r.ruolo.nome}
                    </Badge>
                  ))}
                </div>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardBody>
              <CardTitle>Servizi di Competenza</CardTitle>
              {operatore.servizi.length === 0 ? (
                <p className="text-muted">Nessun servizio assegnato</p>
              ) : (
                <ul className="list-unstyled mb-0">
                  {operatore.servizi.map((s) => (
                    <li key={s.servizioId} className="mb-2">
                      <svg className="icon icon-sm me-2 text-primary">
                        <use href="/bootstrap-italia/dist/svg/sprites.svg#it-pa"></use>
                      </svg>
                      {s.servizio.titolo}
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>
        </div>

        <div className="col-12">
          <Card>
            <CardBody>
              <CardTitle>Servizi Assegnati</CardTitle>
              {operatore.servizi.length === 0 ? (
                <p className="text-muted">Nessun servizio assegnato</p>
              ) : (
                <div className="table-responsive">
                  <table className="table table-sm">
                    <thead>
                      <tr>
                        <th>ID</th>
                        <th>Titolo Servizio</th>
                      </tr>
                    </thead>
                    <tbody>
                      {operatore.servizi.map((s) => (
                        <tr key={s.servizioId}>
                          <td>#{s.servizio.id}</td>
                          <td>{s.servizio.titolo}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
