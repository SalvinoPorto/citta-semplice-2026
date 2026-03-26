import { notFound } from 'next/navigation';
import Link from 'next/link';
import prisma from '@/lib/db/prisma';
import { requireAdmin } from '@/lib/auth/session';
import { Card, CardBody, CardTitle } from '@/components/ui';
import { UtenteContattiForm } from './utente-contatti-form';

async function getUtente(id: number) {
  return prisma.utente.findUnique({
    where: { id },
    include: {
      _count: { select: { istanze: true } },
    },
  });
}

export default async function UtenteDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id: idParam } = await params;
  const id = parseInt(idParam, 10);
  if (isNaN(id)) notFound();

  const utente = await getUtente(id);
  if (!utente) notFound();

  return (
    <div>
      <div className="page-header">
        <div className="d-flex align-items-center gap-2 mb-2">
          <Link href="/amministrazione/utenti" className="btn btn-link p-0">
            ← Torna agli utenti
          </Link>
        </div>
        <h1>
          {utente.cognome} {utente.nome}
        </h1>
        <p className="text-muted">
          <code>{utente.codiceFiscale}</code> · {utente._count.istanze} istanze
        </p>
      </div>

      <div className="row g-4">
        <div className="col-12 col-lg-6">
          {/* Dati anagrafici — sola lettura */}
          <Card className="mb-4">
            <CardBody>
              <CardTitle>Dati Anagrafici</CardTitle>
              <p className="text-muted small mb-3">
                Questi dati provengono dal sistema di autenticazione e non sono modificabili da qui.
              </p>
              <dl className="row mb-0">
                <dt className="col-5">Cognome</dt>
                <dd className="col-7">{utente.cognome}</dd>
                <dt className="col-5">Nome</dt>
                <dd className="col-7">{utente.nome}</dd>
                <dt className="col-5">Codice Fiscale</dt>
                <dd className="col-7"><code>{utente.codiceFiscale}</code></dd>
                {utente.dataNascita && (
                  <>
                    <dt className="col-5">Data di nascita</dt>
                    <dd className="col-7">
                      {new Date(utente.dataNascita).toLocaleDateString('it-IT')}
                    </dd>
                  </>
                )}
                {utente.luogoNascita && (
                  <>
                    <dt className="col-5">Luogo di nascita</dt>
                    <dd className="col-7">{utente.luogoNascita}</dd>
                  </>
                )}
              </dl>
            </CardBody>
          </Card>
        </div>

        <div className="col-12 col-lg-6">
          {/* Contatti — modificabili */}
          <Card>
            <CardBody>
              <CardTitle>Dati di Contatto</CardTitle>
              <UtenteContattiForm
                utenteId={utente.id}
                defaultValues={{
                  email: utente.email ?? '',
                  telefono: utente.telefono ?? '',
                  pec: utente.pec ?? '',
                  indirizzo: utente.indirizzo ?? '',
                  cap: utente.cap ?? '',
                  citta: utente.citta ?? '',
                  provincia: utente.provincia ?? '',
                }}
              />
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
