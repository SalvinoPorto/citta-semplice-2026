'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button, Modal, ModalHeader, ModalBody, ModalFooter, Textarea, Input, Select } from '@/components/ui';
import {
  advanceWorkflow,
  regressWorkflow,
  rejectIstanza,
  reopenIstanza,
  addNote,
  sendComunicazione,
  concludeIstanza,
  takeCharge,
  assignAttributo,
  generatePayment,
  rollbackFase,
  type AllegatoComunicazione,
} from './actions';
import { ASSIGNEDTO } from '@/lib/models/assigned-to';

interface PagamentoConfig {
  importo: number | null;
  importoVariabile: boolean;
  causale: string | null;
  causaleVariabile: boolean;
  obbligatorio: boolean;
  codiceTributo: string | null;
  descrizioneTributo: string | null;
}

interface CurrentStep {
  id: number;
  descrizione: string;
  ordine: number;
  protocollo: boolean;
  tipoProtocollo: string | null;
  unitaOrganizzativa: string | null;
  pagamento: boolean;
  pagamentoConfig: PagamentoConfig | null;
}

interface FaseCorrente {
  nome: string;
  ordine: number;
}

interface FasePrecedente {
  nome: string;
  ufficio: { nome: string; email: string | null } | null;
}

interface IstanzaActionsProps {
  istanza: {
    id: number;
    conclusa: boolean;
    respinta: boolean;
    protoNumero: string | null;
    protoData: Date | null;
    attributoId: number | null;
  };
  utente: {
    email: string | null;
    nome: string;
    cognome: string;
    codiceFiscale: string;
  };
  assignedTo: number;
  currentStep: CurrentStep | null;
  currentPayment: {
    id: number;
    stato: string | null;
  } | null;
  stepOrdine: number;
  isLastStep: boolean;
  canRollbackFase?: boolean;
  faseCorrente?: FaseCorrente | null;
  fasePrecedente?: FasePrecedente | null;
  attributoType?: {
    tipoAttributo: string;
    attributi: { id: number; valore: string }[];
  } | null;
}

export function IstanzaActions({
  istanza,
  utente,
  assignedTo,
  currentStep,
  currentPayment,
  stepOrdine,
  isLastStep,
  canRollbackFase = false,
  fasePrecedente = null,
  attributoType,
}: IstanzaActionsProps) {
  const router = useRouter();
  const [showAdvanceModal, setShowAdvanceModal] = useState(false);
  const [showRegressModal, setShowRegressModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [showCommunicationModal, setShowCommunicationModal] = useState(false);
  const [showConcludeModal, setShowConcludeModal] = useState(false);
  const [showAttributoModal, setShowAttributoModal] = useState(false);
  const [showRollbackFaseModal, setShowRollbackFaseModal] = useState(false);

  // Advance state
  const [note, setNote] = useState('');
  const [confirmAdvanceWithoutPayment, setConfirmAdvanceWithoutPayment] = useState(false);
  const [selectedUfficioId, setSelectedUfficioId] = useState<string>('');

  // Regress state
  const [regressNote, setRegressNote] = useState('');

  // Reject state
  const [motivo, setMotivo] = useState('');

  // Protocol state
  const [protoNumero, setProtoNumero] = useState(istanza.protoNumero || '');
  const [protoData, setProtoData] = useState(
    istanza.protoData ? new Date(istanza.protoData).toISOString().split('T')[0] : ''
  );

  // Note state
  const [noteText, setNoteText] = useState('');

  // Comunicazione state
  const [comunicazioneTesto, setComunicazioneTesto] = useState('');
  const [richiedeRisposta, setRichiedeRisposta] = useState(false);
  const [allegatiComunicazione, setAllegatiComunicazione] = useState<AllegatoComunicazione[]>([]);
  const [showAddAllegato, setShowAddAllegato] = useState(false);
  const [nuovoAllegatoNome, setNuovoAllegatoNome] = useState('');
  const [nuovoAllegatoObbligatorio, setNuovoAllegatoObbligatorio] = useState(false);

  // Conclude state
  const [concludeNote, setConcludeNote] = useState('');

  // Attributo state
  const [selectedAttributoId, setSelectedAttributoId] = useState(
    istanza.attributoId ? String(istanza.attributoId) : ''
  );

  // Rollback fase state
  const [rollbackNote, setRollbackNote] = useState('');
  const [inviaEmailRollback, setInviaEmailRollback] = useState(true);
  const [rollbackLoading, setRollbackLoading] = useState(false);

  const [loading, setLoading] = useState(false);

  const handleRollbackFase = async () => {
    if (!rollbackNote.trim()) {
      toast.error('La motivazione è obbligatoria');
      return;
    }
    setRollbackLoading(true);
    try {
      const result = await rollbackFase({
        istanzaId: istanza.id,
        note: rollbackNote,
        inviaEmail: inviaEmailRollback,
      });
      if (result.success) {
        toast.success(result.message);
        router.refresh();
      } else {
        toast.error(result.message);
      }
    } catch {
      toast.error('Errore nel rollback di fase');
    } finally {
      setRollbackLoading(false);
      setShowRollbackFaseModal(false);
    }
  };

  const isFirstStep = stepOrdine === 1;
  const paymentStep = currentStep?.pagamento ?? false;
  const paymentRequired = currentStep?.pagamentoConfig?.obbligatorio ?? false;
  const paymentConfirmed = currentPayment?.stato === 'CON';

  const handleTakeCharge = async () => {
    setLoading(true);
    try {
      const result = await takeCharge(istanza.id);
      if (result.success) {
        toast.success('Istanza presa in carico');
        router.refresh();
      } else {
        toast.error(result.message || 'Errore');
      }
    } catch {
      toast.error('Si è verificato un errore');
    } finally {
      setLoading(false);
    }
  };

  const handleAdvance = async () => {
    if (paymentStep && paymentRequired && !paymentConfirmed) {
      toast.error('Pagamento obbligatorio non confermato. Non è possibile avanzare.');
      return;
    }
    if (paymentStep && !paymentRequired && !paymentConfirmed && !confirmAdvanceWithoutPayment) {
      toast.error('Per avanzare senza pagamento confermato, selezionare la conferma esplicita.');
      return;
    }

    setLoading(true);
    try {
      const result = await advanceWorkflow({
        istanzaId: istanza.id,
        note
      });
      if (result.success) {
        toast.success(result.message || 'Workflow avanzato con successo');
        setShowAdvanceModal(false);
        setNote('');
        setConfirmAdvanceWithoutPayment(false);
        setSelectedUfficioId('');
        router.refresh();
      } else {
        toast.error(result.message || 'Errore durante l\'avanzamento');
      }
    } catch {
      toast.error('Si è verificato un errore');
    } finally {
      setLoading(false);
    }
  };

  const handleRegress = async () => {
    setLoading(true);
    try {
      const result = await regressWorkflow(istanza.id, regressNote);
      if (result.success) {
        toast.success(result.message || 'Retrocesso allo step precedente');
        setShowRegressModal(false);
        setRegressNote('');
        router.refresh();
      } else {
        toast.error(result.message || 'Errore durante la retrocessione');
      }
    } catch {
      toast.error('Si è verificato un errore');
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async () => {
    if (!motivo.trim()) {
      toast.error('Inserire un motivo per il rifiuto');
      return;
    }
    setLoading(true);
    try {
      const result = await rejectIstanza(istanza.id, motivo);
      if (result.success) {
        toast.success('Istanza respinta');
        setShowRejectModal(false);
        setMotivo('');
        router.refresh();
      } else {
        toast.error(result.message || 'Errore durante il rifiuto');
      }
    } catch {
      toast.error('Si è verificato un errore');
    } finally {
      setLoading(false);
    }
  };

  const handleReopen = async () => {
    setLoading(true);
    try {
      const result = await reopenIstanza(istanza.id);
      if (result.success) {
        toast.success('Istanza riaperta');
        router.refresh();
      } else {
        toast.error(result.message || 'Errore durante la riapertura');
      }
    } catch {
      toast.error('Si è verificato un errore');
    } finally {
      setLoading(false);
    }
  };

  const handleAddNote = async () => {
    if (!noteText.trim()) {
      toast.error('Inserire il testo della nota');
      return;
    }
    setLoading(true);
    try {
      const result = await addNote(istanza.id, noteText.trim());
      if (result.success) {
        toast.success('Nota aggiunta');
        setShowNoteModal(false);
        setNoteText('');
        router.refresh();
      } else {
        toast.error(result.message || 'Errore durante l\'aggiunta della nota');
      }
    } catch {
      toast.error('Si è verificato un errore');
    } finally {
      setLoading(false);
    }
  };

  const handleSendComunicazione = async () => {
    if (!comunicazioneTesto.trim()) {
      toast.error('Inserire il testo della comunicazione');
      return;
    }
    setLoading(true);
    try {
      const result = await sendComunicazione(
        istanza.id,
        comunicazioneTesto.trim(),
        richiedeRisposta,
        allegatiComunicazione
      );
      if (result.success) {
        toast.success(result.message || 'Comunicazione inviata');
        setShowCommunicationModal(false);
        setComunicazioneTesto('');
        setRichiedeRisposta(false);
        setAllegatiComunicazione([]);
        setShowAddAllegato(false);
        setNuovoAllegatoNome('');
        setNuovoAllegatoObbligatorio(false);
        router.refresh();
      } else {
        toast.error(result.message || "Errore durante l'invio");
      }
    } catch {
      toast.error('Si è verificato un errore');
    } finally {
      setLoading(false);
    }
  };

  const handleAddAllegato = () => {
    if (!nuovoAllegatoNome.trim()) return;
    setAllegatiComunicazione([...allegatiComunicazione, { nome: nuovoAllegatoNome.trim(), obbligatorio: nuovoAllegatoObbligatorio }]);
    setNuovoAllegatoNome('');
    setNuovoAllegatoObbligatorio(false);
    setShowAddAllegato(false);
  };

  const handleConclude = async () => {
    setLoading(true);
    try {
      const result = await concludeIstanza(istanza.id, concludeNote.trim());
      if (result.success) {
        const msg = result.protoFinaleNumero
          ? `Istanza conclusa — Protocollo: ${result.protoFinaleNumero}`
          : 'Istanza conclusa con successo';
        toast.success(msg);
        setShowConcludeModal(false);
        setConcludeNote('');
        router.refresh();
      } else {
        toast.error(result.message || 'Errore durante la conclusione');
      }
    } catch {
      toast.error('Si è verificato un errore');
    } finally {
      setLoading(false);
    }
  };

  const handleAssignAttributo = async () => {
    setLoading(true);
    try {
      const attrId = selectedAttributoId ? parseInt(selectedAttributoId) : null;
      const result = await assignAttributo(istanza.id, attrId);
      if (result.success) {
        toast.success('Assegnazione aggiornata');
        setShowAttributoModal(false);
        router.refresh();
      } else {
        toast.error(result.message || 'Errore');
      }
    } catch {
      toast.error('Si è verificato un errore');
    } finally {
      setLoading(false);
    }
  };

  if (istanza.conclusa) {
    return (
      <div className="action-buttons">
        <span className="badge bg-success fs-6">Istanza Conclusa</span>
      </div>
    );
  }

  if (istanza.respinta) {
    return (
      <div className="action-buttons">
        <Button
          variant="warning"
          onClick={handleReopen}
          loading={loading}
        >
          Riapri Istanza
        </Button>
      </div>
    );
  }

  return (
    <>
      <div className="action-buttons d-flex flex-wrap gap-2">
        {assignedTo === ASSIGNEDTO.NOONE ? (
          <Button
            variant="primary"
            onClick={handleTakeCharge}
            loading={loading}
          >
            Prendi in Carico
          </Button>
        ) : (
          <>
            {!isLastStep && (
              <Button
                variant="success"
                onClick={() => setShowAdvanceModal(true)}
              >
                Avanza Step
              </Button>
            )}
            {stepOrdine > 1 && !paymentConfirmed && (
              <Button
                variant="outline-warning"
                onClick={() => setShowRegressModal(true)}
              >
                Retrocedi
              </Button>
            )}
            <Button
              variant="info"
              onClick={() => setShowCommunicationModal(true)}
            >
              Invia Comunicazione
            </Button>
            <Button
              variant="outline-secondary"
              onClick={() => setShowNoteModal(true)}
            >
              Nota
            </Button>
            {isLastStep && (
              <Button
                variant="warning"
                onClick={() => setShowConcludeModal(true)}
              >
                Concludi
              </Button>
            )}
            {!isLastStep && (
              <Button
                variant="danger"
                onClick={() => setShowRejectModal(true)}
              >
                Respingi
              </Button>
            )}
            {canRollbackFase && (
              <Button
                variant="outline-warning"
                onClick={() => setShowRollbackFaseModal(true)}
              >
                ↩ Rimanda a fase precedente
              </Button>
            )}
            {attributoType && (
              <Button
                variant="outline-secondary"
                onClick={() => setShowAttributoModal(true)}
              >
                {attributoType.tipoAttributo}
              </Button>
            )}
          </>
        )}
      </div>

      {/* Advance Modal */}
      <Modal
        isOpen={showAdvanceModal}
        onClose={() => setShowAdvanceModal(false)}
        size="md"
      >
        <ModalHeader onClose={() => setShowAdvanceModal(false)}>
          Avanza Step
          {currentStep && (
            <small className="d-block text-muted fw-normal">
              Step corrente: {currentStep.descrizione}
            </small>
          )}
        </ModalHeader>
        <ModalBody>
          <p>Confermi di voler avanzare allo step successivo?</p>
          {paymentStep && !paymentConfirmed && (
            <div className="alert alert-warning">
              {paymentRequired
                ? 'Pagamento obbligatorio non ancora confermato: è necessario confermare il pagamento prima di avanzare.'
                : (
                  <>
                    <div>Il pagamento non è ancora confermato. Se desideri procedere comunque, spunta la conferma.</div>
                    <div className="form-check mt-2">
                      <input
                        type="checkbox"
                        id="confirmAdvanceWithoutPayment"
                        className="form-check-input"
                        checked={confirmAdvanceWithoutPayment}
                        onChange={(e) => setConfirmAdvanceWithoutPayment(e.target.checked)}
                      />
                      <label className="form-check-label" htmlFor="confirmAdvanceWithoutPayment">
                        Procedo con l&apos;avanzamento anche senza pagamento confermato
                      </label>
                    </div>
                  </>
                )
              }
            </div>
          )}
          <Textarea
            label="Note (opzionale)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            placeholder="Inserisci eventuali note..."
          />
        </ModalBody>
        <ModalFooter>
          <Button
            variant="secondary"
            onClick={() => setShowAdvanceModal(false)}
            disabled={loading}
          >
            Annulla
          </Button>
          <Button
            variant="success"
            onClick={handleAdvance}
            loading={loading}
          >
            Avanza
          </Button>
        </ModalFooter>
      </Modal>

      {/* Regress Modal */}
      <Modal
        isOpen={showRegressModal}
        onClose={() => setShowRegressModal(false)}
        size="md"
      >
        <ModalHeader onClose={() => setShowRegressModal(false)}>
          Retrocedi allo Step Precedente
        </ModalHeader>
        <ModalBody>
          <div className="alert alert-warning">
            L&apos;istanza tornerà allo step precedente. Usare questa funzione per creare un loop
            e richiedere integrazioni o correzioni.
          </div>
          <Textarea
            label="Motivo della retrocessione (opzionale)"
            value={regressNote}
            onChange={(e) => setRegressNote(e.target.value)}
            rows={3}
            placeholder="Inserisci il motivo della retrocessione..."
          />
        </ModalBody>
        <ModalFooter>
          <Button
            variant="secondary"
            onClick={() => setShowRegressModal(false)}
            disabled={loading}
          >
            Annulla
          </Button>
          <Button
            variant="warning"
            onClick={handleRegress}
            loading={loading}
          >
            Retrocedi
          </Button>
        </ModalFooter>
      </Modal>

      {/* Reject Modal */}
      <Modal
        isOpen={showRejectModal}
        onClose={() => setShowRejectModal(false)}
        size="md"
      >
        <ModalHeader onClose={() => setShowRejectModal(false)}>
          Respingi Istanza
        </ModalHeader>
        <ModalBody>
          <p className="text-danger">
            Attenzione: questa azione respingerà l&apos;istanza e invierà una notifica all&apos;utente.
          </p>
          <Textarea
            label="Motivo del rifiuto *"
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            rows={3}
            placeholder="Inserisci il motivo del rifiuto..."
            required
          />
        </ModalBody>
        <ModalFooter>
          <Button
            variant="secondary"
            onClick={() => setShowRejectModal(false)}
            disabled={loading}
          >
            Annulla
          </Button>
          <Button
            variant="danger"
            onClick={handleReject}
            loading={loading}
          >
            Respingi
          </Button>
        </ModalFooter>
      </Modal>

      {/* Communication Modal */}
      <Modal
        isOpen={showCommunicationModal}
        onClose={() => setShowCommunicationModal(false)}
        size="lg"
      >
        <ModalHeader onClose={() => setShowCommunicationModal(false)}>
          Invia Comunicazione a {utente.nome} {utente.cognome}
        </ModalHeader>
        <ModalBody>
          {!utente.email ? (
            <div className="alert alert-warning small mb-3">
              L&apos;utente non ha un indirizzo email. La comunicazione verrà registrata
              ma non sarà possibile inviarla via email.
            </div>
          ) : (
            <p className="text-muted small mb-3">
              Verrà inviata a: <strong>{utente.email}</strong>
            </p>
          )}

          <div className="mb-3">
            <Textarea
              label="Messaggio *"
              value={comunicazioneTesto}
              onChange={(e) => setComunicazioneTesto(e.target.value)}
              rows={5}
              placeholder="Scrivi il messaggio per l'utente..."
              required
            />
          </div>

          <div className="mb-3">
            <div className="form-check">
              <input
                type="checkbox"
                className="form-check-input"
                id="richiede-risposta"
                checked={richiedeRisposta}
                onChange={(e) => setRichiedeRisposta(e.target.checked)}
              />
              <label className="form-check-label" htmlFor="richiede-risposta">
                Richiedi una risposta testuale dall&apos;utente
              </label>
            </div>
          </div>

          <div className="mb-2">
            <label className="form-label small fw-semibold">Allegati richiesti</label>
            {allegatiComunicazione.length > 0 && (
              <div className="mb-2">
                {allegatiComunicazione.map((a, i) => (
                  <div key={i} className="d-flex align-items-center gap-2 mb-1">
                    <span className="flex-grow-1 small">{a.nome}</span>
                    <span className={`badge ${a.obbligatorio ? 'bg-danger' : 'bg-secondary'}`}>
                      {a.obbligatorio ? 'Obbligatorio' : 'Facoltativo'}
                    </span>
                    <button
                      type="button"
                      className="btn btn-sm btn-link text-danger p-0"
                      onClick={() => setAllegatiComunicazione(allegatiComunicazione.filter((_, j) => j !== i))}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
            {showAddAllegato ? (
              <div className="d-flex gap-2 align-items-center flex-wrap p-2 bg-light rounded">
                <input
                  className="form-control form-control-sm"
                  style={{ maxWidth: 260 }}
                  placeholder="Nome allegato..."
                  value={nuovoAllegatoNome}
                  onChange={(e) => setNuovoAllegatoNome(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddAllegato()}
                />
                <div className="form-check mb-0">
                  <input
                    type="checkbox"
                    className="form-check-input"
                    id="nuovo-allegato-obbligatorio"
                    checked={nuovoAllegatoObbligatorio}
                    onChange={(e) => setNuovoAllegatoObbligatorio(e.target.checked)}
                  />
                  <label className="form-check-label small" htmlFor="nuovo-allegato-obbligatorio">
                    Obbligatorio
                  </label>
                </div>
                <button type="button" className="btn btn-sm btn-primary" onClick={handleAddAllegato}>
                  Aggiungi
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-outline-secondary"
                  onClick={() => { setShowAddAllegato(false); setNuovoAllegatoNome(''); setNuovoAllegatoObbligatorio(false); }}
                >
                  Annulla
                </button>
              </div>
            ) : (
              <button
                type="button"
                className="btn btn-sm btn-outline-secondary"
                onClick={() => setShowAddAllegato(true)}
              >
                + Aggiungi allegato richiesto
              </button>
            )}
          </div>
        </ModalBody>
        <ModalFooter>
          <Button
            variant="secondary"
            onClick={() => setShowCommunicationModal(false)}
            disabled={loading}
          >
            Annulla
          </Button>
          <Button
            variant="info"
            onClick={handleSendComunicazione}
            loading={loading}
          >
            Invia
          </Button>
        </ModalFooter>
      </Modal>

      {/* Note Modal */}
      <Modal
        isOpen={showNoteModal}
        onClose={() => setShowNoteModal(false)}
        size="md"
      >
        <ModalHeader onClose={() => setShowNoteModal(false)}>
          Aggiungi Nota
        </ModalHeader>
        <ModalBody>
          <Textarea
            label="Nota"
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            rows={4}
            placeholder="Inserisci la nota..."
            required
          />
        </ModalBody>
        <ModalFooter>
          <Button
            variant="secondary"
            onClick={() => setShowNoteModal(false)}
            disabled={loading}
          >
            Annulla
          </Button>
          <Button
            variant="primary"
            onClick={handleAddNote}
            loading={loading}
          >
            Aggiungi
          </Button>
        </ModalFooter>
      </Modal>

      {/* Conclude Modal */}
      <Modal
        isOpen={showConcludeModal}
        onClose={() => setShowConcludeModal(false)}
        size="md"
      >
        <ModalHeader onClose={() => setShowConcludeModal(false)}>
          Concludi Istanza
        </ModalHeader>
        <ModalBody>
          <p className="mb-2">Confermi di voler concludere l&apos;istanza?</p>
          <Textarea
            label="Note conclusive (opzionale)"
            value={concludeNote}
            onChange={(e) => setConcludeNote(e.target.value)}
            rows={3}
            placeholder="Inserisci eventuali note conclusive..."
          />
        </ModalBody>
        <ModalFooter>
          <Button
            variant="secondary"
            onClick={() => {
              setShowConcludeModal(false);
            }}
            disabled={loading}
          >
            Annulla
          </Button>
          <Button
            variant="warning"
            onClick={handleConclude}
            loading={loading}
          >
            Concludi
          </Button>
        </ModalFooter>
      </Modal>

      {/* Rollback Fase Modal */}
      <Modal
        isOpen={showRollbackFaseModal}
        onClose={() => setShowRollbackFaseModal(false)}
        size="md"
      >
        <ModalHeader onClose={() => setShowRollbackFaseModal(false)}>
          Rimanda a fase precedente
        </ModalHeader>
        <ModalBody>
          <p>
            La pratica verrà rimandata a <strong>{fasePrecedente?.nome}</strong>
            {fasePrecedente?.ufficio && ` (Ufficio: ${fasePrecedente.ufficio.nome})`}.
          </p>
          <Textarea
            label="Motivazione *"
            value={rollbackNote}
            onChange={(e) => setRollbackNote(e.target.value)}
            rows={3}
            placeholder="Indica il motivo del rimando..."
            required
          />
          {fasePrecedente?.ufficio?.email && (
            <div className="form-check mt-3">
              <input
                type="checkbox"
                className="form-check-input"
                id="inviaEmailRollback"
                checked={inviaEmailRollback}
                onChange={(e) => setInviaEmailRollback(e.target.checked)}
              />
              <label className="form-check-label" htmlFor="inviaEmailRollback">
                Invia notifica email all&apos;ufficio {fasePrecedente.ufficio.nome}
              </label>
            </div>
          )}
        </ModalBody>
        <ModalFooter>
          <Button
            variant="secondary"
            onClick={() => setShowRollbackFaseModal(false)}
            disabled={rollbackLoading}
          >
            Annulla
          </Button>
          <Button
            variant="warning"
            onClick={handleRollbackFase}
            loading={rollbackLoading}
          >
            Conferma rimando
          </Button>
        </ModalFooter>
      </Modal>

      {/* Attributo Modal */}
      {attributoType && (
        <Modal
          isOpen={showAttributoModal}
          onClose={() => setShowAttributoModal(false)}
          size="md"
        >
          <ModalHeader onClose={() => setShowAttributoModal(false)}>
            Cambia {attributoType.tipoAttributo}
          </ModalHeader>
          <ModalBody>
            <Select
              label={attributoType.tipoAttributo}
              value={selectedAttributoId}
              onChange={(e) => setSelectedAttributoId(e.target.value)}
            >
              <option value="">-- Nessuno --</option>
              {attributoType.attributi.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.valore}
                </option>
              ))}
            </Select>
          </ModalBody>
          <ModalFooter>
            <Button
              variant="secondary"
              onClick={() => setShowAttributoModal(false)}
              disabled={loading}
            >
              Annulla
            </Button>
            <Button
              variant="primary"
              onClick={handleAssignAttributo}
              loading={loading}
            >
              Conferma
            </Button>
          </ModalFooter>
        </Modal>
      )}
    </>
  );
}
