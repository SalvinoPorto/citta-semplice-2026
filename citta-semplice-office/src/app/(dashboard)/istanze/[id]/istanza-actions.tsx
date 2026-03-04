'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button, Modal, ModalHeader, ModalBody, ModalFooter, Textarea, Input, Select } from '@/components/ui';
import {
  advanceWorkflow,
  rejectIstanza,
  reopenIstanza,
  assignProtocollo,
  addNote,
  sendCommunication,
  concludeIstanza,
  takeCharge,
  assignAttributo,
} from './actions';

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
  };
  notifiche: { id: number; descrizione: string }[];
  isAssignedToMe: boolean;
  attributoType?: {
    tipoAttributo: string;
    attributi: { id: number; valore: string }[];
  } | null;
}

export function IstanzaActions({ istanza, utente, notifiche, isAssignedToMe, attributoType }: IstanzaActionsProps) {
  const router = useRouter();
  const [showAdvanceModal, setShowAdvanceModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showProtocolloModal, setShowProtocolloModal] = useState(false);
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [showCommunicationModal, setShowCommunicationModal] = useState(false);
  const [showConcludeModal, setShowConcludeModal] = useState(false);
  const [showAttributoModal, setShowAttributoModal] = useState(false);

  const [note, setNote] = useState('');
  const [motivo, setMotivo] = useState('');
  const [protoNumero, setProtoNumero] = useState(istanza.protoNumero || '');
  const [protoData, setProtoData] = useState(
    istanza.protoData ? new Date(istanza.protoData).toISOString().split('T')[0] : ''
  );
  const [noteText, setNoteText] = useState('');
  const [communicationSubject, setCommunicationSubject] = useState('');
  const [communicationMessage, setCommunicationMessage] = useState('');
  const [selectedNotifica, setSelectedNotifica] = useState('');
  const [concludeNote, setConcludeNote] = useState('');
  const [selectedAttributoId, setSelectedAttributoId] = useState(
    istanza.attributoId ? String(istanza.attributoId) : ''
  );
  const [loading, setLoading] = useState(false);

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
    setLoading(true);
    try {
      const result = await advanceWorkflow(istanza.id, note);
      if (result.success) {
        toast.success(result.message || 'Workflow avanzato con successo');
        setShowAdvanceModal(false);
        setNote('');
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

  const handleAssignProtocollo = async () => {
    if (!protoNumero.trim()) {
      toast.error('Inserire il numero di protocollo');
      return;
    }
    if (!protoData) {
      toast.error('Inserire la data del protocollo');
      return;
    }
    setLoading(true);
    try {
      const result = await assignProtocollo(istanza.id, protoNumero.trim(), new Date(protoData));
      if (result.success) {
        toast.success('Protocollo assegnato');
        setShowProtocolloModal(false);
        router.refresh();
      } else {
        toast.error(result.message || 'Errore durante l\'assegnazione del protocollo');
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

  const handleSendCommunication = async () => {
    if (!communicationSubject.trim() || !communicationMessage.trim()) {
      toast.error('Inserire oggetto e messaggio');
      return;
    }
    setLoading(true);
    try {
      const result = await sendCommunication(
        istanza.id,
        communicationSubject.trim(),
        communicationMessage.trim(),
        selectedNotifica ? parseInt(selectedNotifica) : undefined
      );
      if (result.success) {
        toast.success('Comunicazione inviata');
        setShowCommunicationModal(false);
        setCommunicationSubject('');
        setCommunicationMessage('');
        setSelectedNotifica('');
        router.refresh();
      } else {
        toast.error(result.message || 'Errore durante l\'invio');
      }
    } catch {
      toast.error('Si è verificato un errore');
    } finally {
      setLoading(false);
    }
  };

  const handleConclude = async () => {
    setLoading(true);
    try {
      const result = await concludeIstanza(istanza.id, concludeNote.trim());
      if (result.success) {
        toast.success('Istanza conclusa');
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
        {!isAssignedToMe && (
          <Button
            variant="primary"
            onClick={handleTakeCharge}
            loading={loading}
          >
            Prendi in Carico
          </Button>
        )}
        <Button
          variant="success"
          onClick={() => setShowAdvanceModal(true)}
        >
          Avanza Step
        </Button>
        <Button
          variant="info"
          onClick={() => setShowCommunicationModal(true)}
        >
          Invia Comunicazione
        </Button>
        <Button
          variant="outline-primary"
          onClick={() => setShowProtocolloModal(true)}
        >
          Protocollo
        </Button>
        <Button
          variant="outline-secondary"
          onClick={() => setShowNoteModal(true)}
        >
          Nota
        </Button>
        <Button
          variant="warning"
          onClick={() => setShowConcludeModal(true)}
        >
          Concludi
        </Button>
        <Button
          variant="danger"
          onClick={() => setShowRejectModal(true)}
        >
          Respingi
        </Button>
        {attributoType && (
          <Button
            variant="outline-secondary"
            onClick={() => setShowAttributoModal(true)}
          >
            {attributoType.tipoAttributo}
          </Button>
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
        </ModalHeader>
        <ModalBody>
          <p>Confermi di voler avanzare allo step successivo?</p>
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
            label="Motivo del rifiuto"
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
            <div className="alert alert-warning">
              L&apos;utente non ha un indirizzo email configurato. La comunicazione verrà registrata ma non sarà possibile inviarla via email.
            </div>
          ) : (
            <p className="text-muted mb-3">
              La comunicazione verrà inviata a: <strong>{utente.email}</strong>
            </p>
          )}

          {notifiche.length > 0 && (
            <div className="mb-3">
              <Select
                label="Template Comunicazione (opzionale)"
                value={selectedNotifica}
                onChange={(e) => setSelectedNotifica(e.target.value)}
              >
                <option value="">-- Seleziona un template --</option>
                {notifiche.map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.descrizione}
                  </option>
                ))}
              </Select>
            </div>
          )}

          <div className="mb-3">
            <Input
              type="text"
              label="Oggetto"
              value={communicationSubject}
              onChange={(e) => setCommunicationSubject(e.target.value)}
              placeholder="Oggetto della comunicazione"
              required
            />
          </div>
          <div className="mb-3">
            <Textarea
              label="Messaggio"
              value={communicationMessage}
              onChange={(e) => setCommunicationMessage(e.target.value)}
              rows={6}
              placeholder="Scrivi il messaggio..."
              required
            />
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
            onClick={handleSendCommunication}
            loading={loading}
          >
            Invia
          </Button>
        </ModalFooter>
      </Modal>

      {/* Protocollo Modal */}
      <Modal
        isOpen={showProtocolloModal}
        onClose={() => setShowProtocolloModal(false)}
        size="md"
      >
        <ModalHeader onClose={() => setShowProtocolloModal(false)}>
          Assegna Protocollo
        </ModalHeader>
        <ModalBody>
          <div className="mb-3">
            <Input
              type="text"
              label="Numero Protocollo"
              value={protoNumero}
              onChange={(e) => setProtoNumero(e.target.value)}
              placeholder="2024/00001"
              required
            />
          </div>
          <div className="mb-3">
            <Input
              type="date"
              label="Data Protocollo"
              value={protoData}
              onChange={(e) => setProtoData(e.target.value)}
              required
            />
          </div>
        </ModalBody>
        <ModalFooter>
          <Button
            variant="secondary"
            onClick={() => setShowProtocolloModal(false)}
            disabled={loading}
          >
            Annulla
          </Button>
          <Button
            variant="primary"
            onClick={handleAssignProtocollo}
            loading={loading}
          >
            Assegna
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
          <p>Confermi di voler concludere l&apos;istanza?</p>
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
            onClick={() => setShowConcludeModal(false)}
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
