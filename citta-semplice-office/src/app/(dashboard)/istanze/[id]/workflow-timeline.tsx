'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { z } from 'zod';
import { Button, Modal, ModalHeader, ModalBody, ModalFooter, Input } from '@/components/ui';
import { generatePayment } from './actions';
import { PagamentoAtteso } from '@/types/pagamento-atteso';
interface Workflow {
  id: number;
  note: string | null;
  dataVariazione: Date;
  stato: number;
  operatoreId: number | null;
  step: {
    id: number;
    descrizione: string;
    ordine: number;
  } | null;
  operatore: {
    nome: string;
    cognome: string;
  } | null;
  pagamentoAtteso: PagamentoAtteso | null;
}

interface Step {
  id: number;
  descrizione: string;
  ordine: number;
  pagamento: boolean;
  pagamentoConfig: {
    importo: number | null;
    importoVariabile: boolean;
    causale: string | null;
    causaleVariabile: boolean;
    obbligatorio: boolean;
    codiceTributo: string | null;
    descrizioneTributo: string | null;
  } | null;
}

interface WorkflowTimelineProps {
  workflows: Workflow[];
  steps: Step[];
  urlPayment: string;
  istanzaId: number;
  utente: {
    codiceFiscale: string;
    nome: string;
    cognome: string;
    email: string | null;
  };
}

interface PaymentDetail {
  iuv: string;
  statoPagamento: string;
  importo?: string;
  dataOperazione?: string;
  numeroAvviso?: string;
}

function formatDateTime(date: Date) {
  return new Date(date).toLocaleString('it-IT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const oddCodiceFiscaleMap: Record<string, number> = {
  '0': 1, '1': 0, '2': 5, '3': 7, '4': 9, '5': 13, '6': 15, '7': 17, '8': 19, '9': 21,
  A: 1, B: 0, C: 5, D: 7, E: 9, F: 13, G: 15, H: 17, I: 19, J: 21,
  K: 2, L: 4, M: 18, N: 20, O: 11, P: 3, Q: 6, R: 8, S: 12, T: 14,
  U: 16, V: 10, W: 22, X: 25, Y: 24, Z: 23,
};

const evenCodiceFiscaleMap: Record<string, number> = {
  '0': 0, '1': 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9,
  A: 0, B: 1, C: 2, D: 3, E: 4, F: 5, G: 6, H: 7, I: 8, J: 9,
  K: 10, L: 11, M: 12, N: 13, O: 14, P: 15, Q: 16, R: 17, S: 18, T: 19,
  U: 20, V: 21, W: 22, X: 23, Y: 24, Z: 25,
};

const controlloCodiceFiscale = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

function isValidItalianCodiceFiscale(value: string) {
  const cf = value.toUpperCase().trim();
  if (!/^[A-Z0-9]{16}$/.test(cf)) return false;
  let sum = 0;
  for (let i = 0; i < 15; i += 1) {
    const char = cf[i];
    sum += i % 2 === 0 ? oddCodiceFiscaleMap[char] ?? 0 : evenCodiceFiscaleMap[char] ?? 0;
  }
  const expected = controlloCodiceFiscale[sum % 26];
  return cf[15] === expected;
}

function isValidItalianPartitaIva(value: string) {
  const pi = value.trim();
  if (!/^[0-9]{11}$/.test(pi)) return false;
  const digits = pi.split('').map((ch) => parseInt(ch, 10));
  let sum = 0;
  for (let i = 0; i < 10; i += 1) {
    const num = digits[i];
    if (i % 2 === 0) {
      sum += [1, 0, 5, 7, 9, 13, 15, 17, 19, 21][num];
    } else {
      sum += num;
    }
  }
  const control = (10 - (sum % 10)) % 10;
  return control === digits[10];
}

const pagamentoModalSchema = z.object({
  importo: z.number().positive('Inserire un importo valido').optional(),
  causale: z.string().trim().min(1, 'La causale è obbligatoria').optional(),
  codiceFiscale: z
    .string()
    .trim()
    .min(1, 'Il codice fiscale o la partita IVA del debitore sono obbligatori')
    .refine(
      (value) => isValidItalianCodiceFiscale(value) || isValidItalianPartitaIva(value),
      {
        message: 'Codice fiscale o partita IVA non valido',
      }
    ),
  nome: z.string().trim().min(1, 'Il nominativo o la ragione sociale del debitore è obbligatorio'),
  email: z
    .string()
    .trim()
    .refine((value) => value === '' || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value), {
      message: 'Email non valida',
    }),
});

const STATO_PAGAMENTO_LABEL: Record<string, string> = {
  ATT: 'In attesa di pagamento',
  CON: 'Pagato',
  NCO: 'Non confermato',
  DAD: 'Da definire',
  RAT: 'Rateale',
};

const STATO_PAGAMENTO_BADGE: Record<string, string> = {
  ATT: 'bg-warning',
  CON: 'bg-success',
  NCO: 'bg-secondary',
  DAD: 'bg-secondary',
  RAT: 'bg-info',
};

export function WorkflowTimeline({ workflows, steps, urlPayment, istanzaId, utente }: WorkflowTimelineProps) {
  const router = useRouter();
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<number | null>(null);
  const [selectedStep, setSelectedStep] = useState<Step | null>(null);

  // Payment generation state
  const [pagamentoImporto, setPagamentoImporto] = useState('');
  const [pagamentoCausale, setPagamentoCausale] = useState('');
  const [pagamentoCf, setPagamentoCf] = useState(utente.codiceFiscale);
  const [pagamentoNome, setPagamentoNome] = useState(utente.nome);
  const [pagamentoCognome, setPagamentoCognome] = useState(utente.cognome);
  const [pagamentoEmail, setPagamentoEmail] = useState(utente.email ?? '');
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const [loading, setLoading] = useState(false);
  const [paymentInfoLoading, setPaymentInfoLoading] = useState(false);
  const [paymentDetail, setPaymentDetail] = useState<PaymentDetail | null>(null);
  const [showPaymentInfoModal, setShowPaymentInfoModal] = useState(false);

  const handleShowPaymentInfo = async (iuv: string) => {
    setPaymentInfoLoading(true);
    try {
      const res = await fetch(`/api/pagamenti/info/${iuv}`, { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok || !data.success) {
        toast.error(data?.error || 'Errore recupero informazioni pagamento');
        return;
      }
      setPaymentDetail(data.detail);
      setShowPaymentInfoModal(true);
    } catch {
      toast.error('Errore recupero informazioni pagamento');
    } finally {
      setPaymentInfoLoading(false);
    }
  };

  const handleGeneratePayment = async () => {
    if (!selectedStep?.pagamentoConfig) return;

    const config = selectedStep.pagamentoConfig;
    const importo = config.importoVariabile ? parseFloat(pagamentoImporto.replace(',', '.')) : undefined;
    const causale = config.causaleVariabile ? pagamentoCausale : undefined;

    const parsed = pagamentoModalSchema.safeParse({
      importo,
      causale,
      codiceFiscale: pagamentoCf,
      nome: pagamentoNome,
      email: pagamentoEmail,
    });

    if (!parsed.success) {
      const fieldErrors = Object.fromEntries(
        Object.entries(parsed.error.flatten().fieldErrors).map(([key, values]) => [key, values?.[0] ?? ''])
      );
      setFormErrors(fieldErrors);
      toast.error('Correggere i campi evidenziati');
      return;
    }

    setFormErrors({});
    setLoading(true);
    try {
      const result = await generatePayment({
        istanzaId,
        workflowId: selectedWorkflowId!,
        importo: config.importoVariabile ? importo : undefined,
        causale: config.causaleVariabile ? causale?.trim() : undefined,
        cf: pagamentoCf || undefined,
        nome: pagamentoNome || undefined,
        cognome: pagamentoCognome || undefined,
        email: pagamentoEmail?.trim() || undefined,
      });

      if (result.success) {
        toast.success(result.message || 'Pagamento generato con successo');
        setShowPaymentModal(false);
        setPagamentoImporto('');
        setPagamentoCausale('');
        setSelectedWorkflowId(null);
        setSelectedStep(null);
        router.refresh();
      } else {
        toast.error(result.message || 'Errore nella generazione del pagamento');
      }
    } catch {
      toast.error('Si è verificato un errore');
    } finally {
      setLoading(false);
    }
  };

  const openPaymentModal = (workflowId: number, step: Step) => {
    setSelectedWorkflowId(workflowId);
    setSelectedStep(step);
    setPagamentoCf(utente.codiceFiscale);
    setPagamentoNome(utente.nome);
    setPagamentoCognome(utente.cognome);
    setPagamentoEmail(utente.email ?? '');
    setPagamentoImporto('');
    setPagamentoCausale('');
    setFormErrors({});
    setShowPaymentModal(true);
  };
  const getStatusClass = (operatoreId: number | null, stato: number): string => {
    if (operatoreId === null) return 'pending';
    if (stato === 1) return 'completed';
    return 'pending';
  };

  if (workflows.length === 0) {
    return <p className="text-muted">Nessun workflow disponibile</p>;
  }

  const sorted = [...workflows].sort(
    (a, b) => new Date(a.dataVariazione).getTime() - new Date(b.dataVariazione).getTime()
  );

  const eventsByOrdine = new Map<number, Workflow[]>();
  for (const wf of sorted) {
    const key = wf.step?.ordine ?? 0;
    if (!eventsByOrdine.has(key)) eventsByOrdine.set(key, []);
    eventsByOrdine.get(key)!.push(wf);
  }

  function stepStatus(ordine: number) {
    const events = eventsByOrdine.get(ordine);
    if (!events || events.length === 0) return '';
    const last = events[events.length - 1];
    return getStatusClass(last.operatoreId, last.stato);
  }

  function getActiveWorkflowForStep(ordine: number) {
    return eventsByOrdine.get(ordine)?.find(wf => wf.operatoreId !== null && wf.stato === 0) ?? null;
  }

  function statoLabel(wf: Workflow) {
    if (wf.operatoreId === null) return 'In attesa';
    if (wf.stato === 1) return 'Completata';
    return 'In lavorazione';
  }

  return (
    <>
      <div className="timeline">
        {steps.map((step) => {
          const status = stepStatus(step.ordine);
          const events = eventsByOrdine.get(step.ordine) ?? [];
          const reached = events.length > 0;
          const last = events[events.length - 1];
          // Pagamento: preso dall'ultimo evento che ne ha uno
          const pagamento = events.find(wf => wf.pagamentoAtteso)?.pagamentoAtteso ?? null;

          return (
            <div key={step.id} className={`timeline-item ${status} ${!reached ? 'opacity-50' : ''}`}>
              {/* Step header */}
              <div className="d-flex justify-content-between align-items-start mb-1">
                <strong>{step.ordine}. {step.descrizione}</strong>
                {reached && last && (
                  <small className="text-muted">
                    {new Date(last.dataVariazione).toLocaleDateString('it-IT')}
                  </small>
                )}
              </div>

              {reached && last && (
                <div className="mb-1">
                  <span className={`badge ${status === 'completed' ? 'bg-success' :
                    status === 'rejected' ? 'bg-danger' :
                      'bg-warning'
                    }`}>
                    {statoLabel(last)}
                  </span>
                </div>
              )}

              {/* Pagamento info */}
              {pagamento && (
                <div className="mt-2 p-2 border border-primary rounded small">
                  <div className="d-flex align-items-center gap-2 mb-1">
                    <span className="fw-semibold">Pagamento PagoPA</span>
                    <span className={`badge ${STATO_PAGAMENTO_BADGE[pagamento.stato ?? ''] ?? 'bg-secondary'}`}>
                      {STATO_PAGAMENTO_LABEL[pagamento.stato ?? ''] ?? pagamento.stato ?? '—'}
                    </span>
                  </div>
                  {pagamento.iuv && (
                    <div><span className="text-muted">IUV:</span> {pagamento.iuv}</div>
                  )}
                  {pagamento.numeroDocumento && (
                    <div><span className="text-muted">N° Documento:</span> {pagamento.numeroDocumento}</div>
                  )}
                  <div>
                    <span className="text-muted">Importo:</span>{' '}
                    <strong>€ {pagamento.importoTotale.toFixed(2)}</strong>
                  </div>
                  {pagamento.causale && (
                    <div><span className="text-muted">Causale:</span> {pagamento.causale}</div>
                  )}
                  {(pagamento.pagante) && (
                    <div>
                      <span className="text-muted">Debitore:</span>{' '}
                      {pagamento.pagante}
                      {pagamento.paganteCodiceFiscale ? ` (${pagamento.paganteCodiceFiscale})` : ''}
                    </div>
                  )}
                  <div className="d-flex gap-2 mt-1 flex-wrap">
                    {pagamento.iuv && pagamento.stato !== 'CON' && (
                      <a
                        href={`/api/pagamenti/bollettino/${pagamento.iuv}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn-sm btn-outline-primary py-0"
                      >
                        Scarica bollettino
                      </a>
                    )}
                    {pagamento.iuv && pagamento.stato === 'CON' && (
                      <Button
                        variant="outline-primary"
                        size="sm"
                        onClick={() => pagamento.iuv && handleShowPaymentInfo(pagamento.iuv)}
                        loading={paymentInfoLoading}
                      >
                        Info pagamento
                      </Button>
                    )}
                  </div>
                </div>
              )}

              {/* Generate Payment Button */}
              {!pagamento && reached && last && last.operatoreId !== null && last.stato === 0 && step.pagamento && (
                <div className="mt-2">
                  <Button
                    variant="outline-primary"
                    size="sm"
                    onClick={() => openPaymentModal(last.id, step)}
                  >
                    Genera pagamento atteso
                  </Button>
                </div>
              )}

              {/* Events (notes and retrocessions) */}
              {events.map((wf) => {
                const isRetrocession = wf.note?.startsWith('[Retrocessione');

                if (isRetrocession) {
                  const text = (wf.note ?? '').replace(/^\[Retrocessione[^\]]*\]\s*/, '');
                  return (
                    <div key={wf.id} className="mt-1 small text-warning">
                      ↩ {text || 'Retrocesso allo step precedente'}
                      <span className="text-muted ms-2">{formatDateTime(wf.dataVariazione)}</span>
                    </div>
                  );
                }

                if (!wf.note) return null;

                return (
                  <p key={wf.id} className="mt-2 mb-0 small text-muted">{wf.note}</p>
                );
              })}

              {/* Operator label from first event */}
              {events[0]?.operatore && (
                <small className="text-muted d-block mt-1">
                  {events[0].operatore.cognome} {events[0].operatore.nome}
                </small>
              )}
            </div>
          );
        })}
      </div>

      {/* Payment Generation Modal */}
      <Modal
        isOpen={showPaymentModal}
        onClose={() => setShowPaymentModal(false)}
        size="md"
      >
        <ModalHeader onClose={() => setShowPaymentModal(false)}>
          Genera Pagamento Atteso
          {selectedStep && (
            <small className="d-block text-muted fw-normal">
              Step: {selectedStep.descrizione}
            </small>
          )}
        </ModalHeader>
        <ModalBody>
          {selectedStep?.pagamentoConfig && (
            <div className="p-3 border border-primary rounded">
              <h6 className="mb-2 text-primary">Pagamento PagoPA</h6>

              {/* Tributo */}
              {selectedStep.pagamentoConfig.codiceTributo && (
                <p className="small mb-2">
                  <strong>Tributo:</strong> {selectedStep.pagamentoConfig.codiceTributo}
                  {selectedStep.pagamentoConfig.descrizioneTributo ? ` — ${selectedStep.pagamentoConfig.descrizioneTributo}` : ''}
                </p>
              )}

              {/* Importo */}
              {selectedStep.pagamentoConfig.importoVariabile ? (
                <div className="mb-2">
                  <Input
                    type="number"
                    label="Importo (€) *"
                    step="0.01"
                    min={0}
                    value={pagamentoImporto}
                    onChange={(e) => {
                      setPagamentoImporto(e.target.value);
                      setFormErrors((prev) => {
                        const next = { ...prev };
                        delete next.importo;
                        return next;
                      });
                    }}
                    placeholder="0.00"
                    error={formErrors.importo}
                  />
                </div>
              ) : (
                <p className="small mb-2">
                  <strong>Importo:</strong> € {selectedStep.pagamentoConfig.importo?.toFixed(2) ?? '—'}
                </p>
              )}

              {/* Causale */}
              {selectedStep.pagamentoConfig.causaleVariabile ? (
                <div className="mb-2">
                  <Input
                    type="text"
                    label="Causale *"
                    value={pagamentoCausale}
                    onChange={(e) => {
                      setPagamentoCausale(e.target.value);
                      setFormErrors((prev) => {
                        const next = { ...prev };
                        delete next.causale;
                        return next;
                      });
                    }}
                    placeholder="Inserisci la causale..."
                    maxLength={50}
                    error={formErrors.causale}
                  />
                </div>
              ) : (
                <p className="small mb-2">
                  <strong>Causale:</strong> {selectedStep.pagamentoConfig.causale ?? '—'}
                </p>
              )}

              {/* Dati debitore */}
              <div className="mt-3 pt-3 border-top">
                <p className="small fw-semibold mb-2">Dati debitore</p>
                <div className="row g-2">
                  <div className="col-12">
                    <Input
                      type="text"
                      label="Codice Fiscale / P.IVA *"
                      value={pagamentoCf}
                      onChange={(e) => {
                        setPagamentoCf(e.target.value);
                        setFormErrors((prev) => {
                          const next = { ...prev };
                          delete next.codiceFiscale;
                          return next;
                        });
                      }}
                      error={formErrors.codiceFiscale}
                    />
                  </div>
                  <div className="col-12">
                    <Input
                      type="text"
                      label="Nominativo/Ragione sociale"
                      value={pagamentoNome}
                      onChange={(e) => {
                        setPagamentoNome(e.target.value);
                        setFormErrors((prev) => {
                          const next = { ...prev };
                          delete next.nome;
                          return next;
                        });
                      }}
                      error={formErrors.nome}
                    />
                  </div>
                  <div className="col-12">
                    <Input
                      type="email"
                      label="Email"
                      value={pagamentoEmail}
                      onChange={(e) => {
                        setPagamentoEmail(e.target.value);
                        setFormErrors((prev) => {
                          const next = { ...prev };
                          delete next.email;
                          return next;
                        });
                      }}
                      error={formErrors.email}
                    />
                  </div>
                </div>
              </div>

              <p className="small text-muted mt-2 mb-0">
                Verrà generato un bollettino PagoPA e inserito nella timeline.
              </p>
            </div>
          )}
        </ModalBody>
        <ModalFooter>
          <Button
            variant="secondary"
            onClick={() => setShowPaymentModal(false)}
            disabled={loading}
          >
            Annulla
          </Button>
          <Button
            variant="success"
            onClick={handleGeneratePayment}
            loading={loading}
          >
            Genera Pagamento
          </Button>
        </ModalFooter>
      </Modal>

      <Modal
        isOpen={showPaymentInfoModal}
        onClose={() => setShowPaymentInfoModal(false)}
        size="sm"
      >
        <ModalHeader onClose={() => setShowPaymentInfoModal(false)}>
          Informazioni pagamento
        </ModalHeader>
        <ModalBody>
          {paymentDetail ? (
            <div className="small">
              <div><strong>IUV:</strong> {paymentDetail.iuv}</div>
              <div><strong>Stato:</strong> {paymentDetail.statoPagamento}</div>
              {paymentDetail.importo && <div><strong>Importo:</strong> € {paymentDetail.importo}</div>}
              {paymentDetail.numeroAvviso && <div><strong>Numero avviso:</strong> {paymentDetail.numeroAvviso}</div>}
              {paymentDetail.dataOperazione && <div><strong>Data operazione:</strong> {new Date(paymentDetail.dataOperazione).toLocaleString('it-IT')}</div>}
            </div>
          ) : (
            <p className="text-muted">Nessuna informazione disponibile.</p>
          )}
        </ModalBody>
        <ModalFooter>
          <Button
            variant="secondary"
            onClick={() => setShowPaymentInfoModal(false)}
          >
            Chiudi
          </Button>
        </ModalFooter>
      </Modal>
    </>
  );
}
