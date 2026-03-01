'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button, Modal, ModalHeader, ModalBody, ModalFooter, Textarea } from '@/components/ui';
import { addAvviso, deleteAvviso } from './actions';

interface Avviso {
  id: number;
  avviso: string;
  dataAvviso: Date;
}

interface AvvisiManagerProps {
  istanzaId: number;
  avvisi: Avviso[];
}

export function AvvisiManager({ istanzaId, avvisi }: AvvisiManagerProps) {
  const router = useRouter();
  const [showModal, setShowModal] = useState(false);
  const [testo, setTesto] = useState('');
  const [loading, setLoading] = useState(false);

  const handleAdd = async () => {
    if (!testo.trim()) {
      toast.error("Inserire il testo dell'avviso");
      return;
    }
    setLoading(true);
    try {
      const result = await addAvviso(istanzaId, testo.trim());
      if (result.success) {
        toast.success('Avviso inserito');
        setShowModal(false);
        setTesto('');
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

  const handleDelete = async (avvisoId: number) => {
    setLoading(true);
    try {
      const result = await deleteAvviso(avvisoId, istanzaId);
      if (result.success) {
        toast.success('Avviso eliminato');
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

  return (
    <>
      <div className="d-flex justify-content-between align-items-center mb-2">
        <h6 className="text-warning mb-0">Avvisi</h6>
        <Button variant="outline-warning" size="sm" onClick={() => setShowModal(true)}>
          + Inserisci
        </Button>
      </div>

      {avvisi.length === 0 ? (
        <p className="text-muted small">Nessun avviso</p>
      ) : (
        avvisi.map((avviso) => (
          <div key={avviso.id} className="mb-2 pb-2 border-bottom">
            <div className="d-flex justify-content-between align-items-start">
              <p className="mb-1 small">{avviso.avviso}</p>
              <button
                className="btn btn-sm btn-link text-danger p-0 ms-2 flex-shrink-0"
                onClick={() => handleDelete(avviso.id)}
                disabled={loading}
                title="Elimina avviso"
              >
                ×
              </button>
            </div>
            <small className="text-muted">
              {new Date(avviso.dataAvviso).toLocaleString('it-IT')}
            </small>
          </div>
        ))
      )}

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} size="md">
        <ModalHeader onClose={() => setShowModal(false)}>
          Inserisci avviso da mostrare all&apos;utente
        </ModalHeader>
        <ModalBody>
          <Textarea
            label="Avviso"
            value={testo}
            onChange={(e) => setTesto(e.target.value)}
            rows={5}
            placeholder="Inserisci l'avviso da mostrare in home all'utente..."
          />
        </ModalBody>
        <ModalFooter>
          <Button
            variant="secondary"
            onClick={() => { setShowModal(false); setTesto(''); }}
            disabled={loading}
          >
            Annulla
          </Button>
          <Button variant="warning" onClick={handleAdd} loading={loading}>
            Conferma
          </Button>
        </ModalFooter>
      </Modal>
    </>
  );
}
