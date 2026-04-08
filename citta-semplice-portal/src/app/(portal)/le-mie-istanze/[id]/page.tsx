export const dynamic = 'force-dynamic';

import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { auth } from '@/lib/auth/config';
import { prisma } from '@/lib/db/prisma';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { RispostaComunicazioneForm } from '@/components/istanza/RispostaComunicazioneForm';
import { PagaOnlineButton } from './PagaOnlineButton';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';

interface Props {
  params: Promise<{ id: string }>;
}

interface CampoDato {
  name: string;
  label: string;
  value: string;
}

function parseDati(dati: string | null | undefined): CampoDato[] {
  if (!dati) return [];
  try {
    const parsed = JSON.parse(dati);
    // nuovo formato: array con label
    if (Array.isArray(parsed)) return parsed as CampoDato[];
    // vecchio formato: plain object
    return Object.entries(parsed).map(([name, value]) => ({ name, label: name, value: String(value) }));
  } catch {
    return [];
  }
}

function getStatoBadge(istanza: { conclusa: boolean; respinta: boolean; workflows: { operatoreId: number | null }[] }) {
  if (istanza.conclusa) return { label: 'Conclusa', cls: 'bg-success' };
  if (istanza.respinta) return { label: 'Respinta', cls: 'bg-danger' };
  const presaInCarico = istanza.workflows.some((wf) => wf.operatoreId !== null);
  if (presaInCarico) return { label: 'In lavorazione', cls: 'bg-primary' };
  return { label: 'In attesa', cls: 'bg-secondary' };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  return { title: `Istanza #${id} - Città Semplice` };
}

export default async function IstanzaDettaglioPage({ params }: Props) {
  const { id: idStr } = await params;
  const id = Number(idStr);
  if (isNaN(id)) notFound();

  const session = await auth();
  if (!session?.user) {
    redirect(`/login?callbackUrl=/le-mie-istanze/${id}`);
  }

  const utente = await prisma.utente.findUnique({ where: { id: Number(session.user.id) } });
  if (!utente) redirect('/login');

  const istanza = await prisma.istanza.findFirst({
    where: { id, utenteId: utente.id, inBozza: false },
    include: {
      servizio: { include: { area: true } },
      workflows: {
        include: {
          step: true,
          allegati: true,
          notifica: true,
          pagamentoAtteso: true,
        },
        orderBy: { dataVariazione: 'asc' },
      },
      comunicazioni: { include: { risposta: { include: { allegati: true } } } },
    },
  });

  if (!istanza) notFound();

  const stato = getStatoBadge(istanza);
  const dati = parseDati(istanza.dati);

  // Tutti gli allegati caricati dal cittadino (invUtente = true)
  const allegatiUtente = istanza.workflows.flatMap((wf) =>
    wf.allegati.filter((a) => a.invUtente),
  );

  // Allegati caricati dall'ufficio (invUtente = false)
  const allegatiUfficio = istanza.workflows.flatMap((wf) =>
    wf.allegati.filter((a) => !a.invUtente),
  );

  // Pagamento: cerca un workflow con pagamentoAtteso
  const pagamentoAtteso = istanza.workflows
    .map((wf) => wf.pagamentoAtteso)
    .find((p) => p !== null) ?? null;

  const pagamentoDaEseguire = pagamentoAtteso?.stato === 'ATT' ? pagamentoAtteso : null;
  const pagamentoConfermato = pagamentoAtteso?.stato === 'CON' ? pagamentoAtteso : null;

  // Comunicazioni dell'ufficio con eventuali risposte del cittadino
  const comunicazioni = istanza.comunicazioni
    .filter((com) => com !== null)
    .map((com) => {
      let allegatiRichiesti: { nome: string; obbligatorio: boolean }[] = [];
      try {
        if (com.allegatiRichiesti) allegatiRichiesti = JSON.parse(com.allegatiRichiesti);
      } catch { /* ignore */ }
      return { ...com, allegatiRichiesti };
    });

  return (
    <>
      <div className="container" id="main-container">
        <Breadcrumb
          items={[
            { label: 'Home', href: '/' },
            { label: 'Le mie istanze', href: '/le-mie-istanze' },
            { label: `Istanza #${istanza.id}`, active: true },
          ]}
        />
      </div>

      <div className="container mb-5">
        <div className="row justify-content-center">
          <div className="col-12 col-lg-10">

            {/* Header */}
            <div className="d-flex align-items-center justify-content-between flex-wrap gap-3 mb-4">
              <div>
                <h1 className="title mb-1">{istanza.servizio.titolo}</h1>
                <p className="text-muted mb-0">
                  Istanza #{istanza.id}
                  {istanza.dataInvio && (
                    <> &mdash; Inviata il {format(istanza.dataInvio, 'dd MMMM yyyy', { locale: it })}</>
                  )}
                </p>
              </div>
              <span className={`badge fs-6 ${stato.cls}`}>{stato.label}</span>
            </div>

            {/* Protocollo */}
            {istanza.protoNumero && (
              <div className="alert alert-secondary d-flex align-items-center gap-2 mb-4">
                <svg className="icon icon-sm" aria-hidden="true">
                  <use href="/bootstrap-italia/dist/svg/sprites.svg#it-pa" />
                </svg>
                <span>
                  Numero di protocollo: <strong>{istanza.protoNumero}</strong>
                  {istanza.protoData && (
                    <> del {format(istanza.protoData, 'dd/MM/yyyy', { locale: it })}</>
                  )}
                </span>
              </div>
            )}

            {/* ─── SEZIONE PAGAMENTO ─── */}
            {(pagamentoDaEseguire || pagamentoConfermato) && (
              <div className={`alert d-flex flex-column flex-sm-row align-items-sm-center gap-3 mb-4 ${pagamentoConfermato ? 'alert-success' : 'alert-warning'}`}>
                {/* <svg className="icon icon-sm flex-shrink-0" aria-hidden="true">
                  <use href={`/bootstrap-italia/dist/svg/sprites.svg#${pagamentoConfermato ? 'it-check-circle' : 'it-warning-circle'}`} />
                </svg> */}
                <div className="flex-grow-1">
                  {pagamentoDaEseguire && (
                    <>
                      <strong>Pagamento richiesto</strong>
                      <p className="mb-0 small">
                        Importo: <strong>{pagamentoDaEseguire.importoTotale.toFixed(2)} €</strong>
                        {pagamentoDaEseguire.causale && <> &mdash; {pagamentoDaEseguire.causale}</>}
                        {pagamentoDaEseguire.dataScadenza && (
                          <> &mdash; scadenza {new Date(pagamentoDaEseguire.dataScadenza).toLocaleDateString('it-IT')}</>
                        )}
                      </p>
                    </>
                  )}
                  {pagamentoConfermato && (
                    <>
                      <strong>Pagamento confermato</strong>
                      <p className="mb-0 small">
                        Importo: <strong>{pagamentoConfermato.importoTotale.toFixed(2)} €</strong>
                        {pagamentoConfermato.causale && <> &mdash; {pagamentoConfermato.causale}</>}
                      </p>
                    </>
                  )}
                </div>
                <div className="d-flex flex-wrap gap-2">
                  {pagamentoDaEseguire && (
                    <>
                      <a
                        href={`/api/pagamenti/bollettino/${pagamentoDaEseguire.iuv}`}
                        className="btn btn-sm btn-outline-warning"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <svg className="icon icon-sm me-1" aria-hidden="true">
                          <use href="/bootstrap-italia/dist/svg/sprites.svg#it-download" />
                        </svg>
                        Scarica bollettino
                      </a>
                      <PagaOnlineButton iuv={pagamentoDaEseguire.iuv!} />
                    </>
                  )}
                  {pagamentoConfermato && (
                    <a
                      href={`/api/pagamenti/ricevuta/${pagamentoConfermato.iuv}`}
                      className="btn btn-sm btn-outline-success"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <svg className="icon icon-sm me-1" aria-hidden="true">
                        <use href="/bootstrap-italia/dist/svg/sprites.svg#it-download" />
                      </svg>
                      Scarica ricevuta
                    </a>
                  )}
                </div>
              </div>
            )}

            {/* ─── SEZIONE 1: RIEPILOGO DATI ─── */}
            <section className="mb-5">
              <h2 className="h4 border-bottom pb-2 mb-4">
                <svg className="icon icon-sm me-2" aria-hidden="true">
                  <use href="/bootstrap-italia/dist/svg/sprites.svg#it-note" />
                </svg>
                Dati della richiesta
              </h2>

              <div className="card">
                <div className="card-body p-0">
                  <table className="table table-sm mb-0">
                    <tbody>
                      {dati.map((campo) => (
                        <tr key={campo.name}>
                          <th style={{ width: '30%' }} className="ps-3">{campo.label}</th>
                          <td>{campo.value || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Allegati caricati dal cittadino */}
              {allegatiUtente.length > 0 && (
                <div className="mt-3">
                  <h3 className="h6 mb-2">Allegati caricati</h3>
                  <ul className="list-group">
                    {allegatiUtente.map((allegato) => (
                      <li
                        key={allegato.id}
                        className="list-group-item d-flex align-items-center justify-content-between"
                      >
                        <div className="d-flex align-items-center gap-2">
                          <svg className="icon icon-sm text-primary" aria-hidden="true">
                            <use href="/bootstrap-italia/dist/svg/sprites.svg#it-file" />
                          </svg>
                          <div>
                            <div className="fw-semibold">
                              {allegato.nomeFileRichiesto ?? allegato.nomeFile}
                            </div>
                            <div className="small text-muted font-monospace">{allegato.nomeFile}</div>
                          </div>
                        </div>
                        <div className="d-flex gap-2">
                          <a
                            href={`/api/allegati/${allegato.id}`}
                            className="btn btn-sm btn-outline-primary"
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <svg className="icon icon-sm me-1" aria-hidden="true">
                              <use href="/bootstrap-italia/dist/svg/sprites.svg#it-download" />
                            </svg>
                            Scarica
                          </a>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </section>

            {/* ─── SEZIONE 2: ITER / TIMELINE ─── */}
            <section className="mb-5">
              <h2 className="h4 border-bottom pb-2 mb-4">
                <svg className="icon icon-sm me-2" aria-hidden="true">
                  <use href="/bootstrap-italia/dist/svg/sprites.svg#it-chart-line" />
                </svg>
                Iter della pratica
              </h2>

              {istanza.workflows.length === 0 ? (
                <p className="text-muted fst-italic">Nessuna fase registrata.</p>
              ) : (
                <div className="timeline-wrapper">
                  <div className="it-timeline-wrapper">
                    <div className="row">
                      {istanza.workflows.map((wf, idx) => (
                        <div key={wf.id} className="col-12">
                          <div className="timeline-element">
                            <div className="it-pin-wrapper it-evidence">
                              <div className="pin-icon">
                                <svg className="icon icon-sm" aria-hidden="true">
                                  <use href={`/bootstrap-italia/dist/svg/sprites.svg#${idx === istanza.workflows.length - 1 ? 'it-check-circle' : 'it-check'}`} />
                                </svg>
                              </div>
                            </div>
                            <div className="it-timeline-element-wrapper">
                              <div className="it-evidence-date-wrapper d-flex align-items-center gap-2 mb-1">
                                <span className="it-evidence-date small text-muted">
                                  {format(wf.dataVariazione, 'dd/MM/yyyy HH:mm', { locale: it })}
                                </span>
                                <span className={`badge ${idx === istanza.workflows.length - 1 ? 'bg-primary' : 'bg-secondary'}`}>
                                  {wf.operatoreId === null ? 'In attesa' : wf.stato === 1 ? 'Completata' : 'In lavorazione'}
                                </span>
                              </div>
                              <div className="card shadow-sm">
                                <div className="card-body py-3">
                                  <h3 className="h6 mb-1">
                                    {wf.step?.descrizione ?? 'Avanzamento pratica'}
                                  </h3>
                                  {wf.note && (
                                    <p className="mb-2 text-muted small">{wf.note}</p>
                                  )}
                                  {wf.notifica && (
                                    <div className="alert alert-info py-2 mb-2 small">
                                      <svg className="icon icon-sm me-1" aria-hidden="true">
                                        <use href="/bootstrap-italia/dist/svg/sprites.svg#it-mail" />
                                      </svg>
                                      {wf.notifica.descrizione}
                                    </div>
                                  )}
                                  {/* Allegati dell'ufficio in questo step */}
                                  {wf.allegati.filter((a) => !a.invUtente).length > 0 && (
                                    <div className="mt-2">
                                      <p className="small mb-1 fw-semibold">Documenti allegati dall&apos;ufficio:</p>
                                      <ul className="list-unstyled mb-0">
                                        {wf.allegati.filter((a) => !a.invUtente).map((allegato) => (
                                          <li key={allegato.id} className="d-flex align-items-center gap-2 small">
                                            <svg className="icon icon-sm text-primary" aria-hidden="true">
                                              <use href="/bootstrap-italia/dist/svg/sprites.svg#it-file" />
                                            </svg>
                                            <a
                                              href={`/api/allegati/${allegato.id}`}
                                              className="text-decoration-none"
                                              target="_blank"
                                              rel="noopener noreferrer"
                                            >
                                              {allegato.nomeFileRichiesto ?? allegato.nomeFile}
                                            </a>
                                          </li>
                                        ))}
                                      </ul>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </section>

            {/* ─── SEZIONE 3: COMUNICAZIONI ─── */}
            {(comunicazioni.length > 0 || allegatiUfficio.length > 0) && (
              <section className="mb-5">
                <h2 className="h4 border-bottom pb-2 mb-4">
                  <svg className="icon icon-sm me-2" aria-hidden="true">
                    <use href="/bootstrap-italia/dist/svg/sprites.svg#it-comment" />
                  </svg>
                  Comunicazioni dall&apos;ufficio
                </h2>

                {comunicazioni.length === 0 && (
                  <p className="text-muted fst-italic">Nessuna comunicazione ricevuta.</p>
                )}

                <div className="d-flex flex-column gap-3">
                  {comunicazioni.map((com) => (
                    <div key={com.id} className={`card ${com.richiedeRisposta ? 'border-warning' : 'border-info'}`}>
                      <div className="card-body">
                        <div className="d-flex align-items-center gap-2 mb-2">
                          <svg className={`icon icon-sm ${com.richiedeRisposta ? 'text-warning' : 'text-info'}`} aria-hidden="true">
                            <use href={`/bootstrap-italia/dist/svg/sprites.svg#${com.richiedeRisposta ? 'it-warning-circle' : 'it-info-circle'}`} />
                          </svg>
                          <small className="text-muted">
                            {format(com.dataCreazione, 'dd MMMM yyyy, HH:mm', { locale: it })}
                          </small>
                          {com.richiedeRisposta && (
                            <span className="badge bg-warning text-dark ms-auto">Richiede risposta</span>
                          )}
                        </div>
                        <p className="mb-0">{com.testo}</p>
                        {com.richiedeRisposta && (
                          <RispostaComunicazioneForm
                            comunicazioneId={com.id}
                            allegatiRichiesti={com.allegatiRichiesti}
                            risposta={com.risposta ? {
                              id: com.risposta.id,
                              testo: com.risposta.testo,
                              dataRisposta: com.risposta.createdAt,
                              allegati: com.risposta.allegati.map((a: { id: number; nomeFile: string }) => ({ id: a.id, nomeFile: a.nomeFile })),
                            } : null}
                          />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            <div className="mt-4">
              <Link href="/le-mie-istanze" className="btn btn-outline-primary">
                <svg className="icon icon-sm me-1" aria-hidden="true">
                  <use href="/bootstrap-italia/dist/svg/sprites.svg#it-arrow-left" />
                </svg>
                Torna alle mie istanze
              </Link>
            </div>

          </div>
        </div>
      </div>
    </>
  );
}
