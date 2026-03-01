'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Button, Modal, ModalHeader, ModalBody, ModalFooter, Badge } from '@/components/ui';
import { getIstanzeUtente, IstanzaUtenteItem } from './actions';
import Link from 'next/link';

interface AltreIstanzeModalProps {
  codiceFiscale: string;
  nome: string;
  cognome: string;
  istanzaCorrenteId: number;
}

export function AltreIstanzeModal({
  codiceFiscale,
  nome,
  cognome,
  istanzaCorrenteId,
}: AltreIstanzeModalProps) {
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [istanze, setIstanze] = useState<IstanzaUtenteItem[]>([]);

  const handleOpen = async () => {
    setShowModal(true);
    if (istanze.length === 0) {
      setLoading(true);
      try {
        const result = await getIstanzeUtente(codiceFiscale);
        if (result.success) {
          setIstanze(result.data);
        } else {
          toast.error(result.message || 'Errore nel recupero delle istanze');
        }
      } catch {
        toast.error('Si è verificato un errore');
      } finally {
        setLoading(false);
      }
    }
  };

  const getStatusBadge = (item: IstanzaUtenteItem) => {
    if (item.conclusa) return <Badge variant="success">Conclusa</Badge>;
    if (item.respinta) return <Badge variant="danger">Respinta</Badge>;
    return <Badge variant="warning">In lavorazione</Badge>;
  };

  return (
    <>
      <Button variant="outline-primary" size="sm" onClick={handleOpen}>
        Altre istanze
      </Button>

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} size="xl" scrollable>
        <ModalHeader onClose={() => setShowModal(false)}>
          Istanze presentate da {cognome} {nome}
        </ModalHeader>
        <ModalBody>
          {loading ? (
            <div className="text-center py-4">
              <div className="spinner-border" role="status">
                <span className="visually-hidden">Caricamento...</span>
              </div>
            </div>
          ) : istanze.length === 0 ? (
            <p className="text-muted">Nessuna istanza trovata</p>
          ) : (
            <div className="table-responsive">
              <table className="table table-sm table-hover">
                <thead>
                  <tr>
                    <th>Protocollo</th>
                    <th>Richiesta</th>
                    <th>Data invio</th>
                    <th>Fase</th>
                    <th>Esito</th>
                    <th>Ultima var.</th>
                    <th>Stato</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {istanze.map((ist) => (
                    <tr
                      key={ist.id}
                      className={ist.id === istanzaCorrenteId ? 'table-active fw-bold' : ''}
                    >
                      <td>
                        <small>{ist.protoNumero || '-'}</small>
                      </td>
                      <td>
                        <small>{ist.modulo}</small>
                      </td>
                      <td>
                        <small>
                          {new Date(ist.dataInvio).toLocaleDateString('it-IT')}
                        </small>
                      </td>
                      <td>
                        <small>{ist.step}</small>
                      </td>
                      <td>
                        <small>{ist.status}</small>
                      </td>
                      <td>
                        <small>
                          {ist.dataVariazione
                            ? new Date(ist.dataVariazione).toLocaleDateString('it-IT')
                            : '-'}
                        </small>
                      </td>
                      <td>{getStatusBadge(ist)}</td>
                      <td>
                        {ist.id !== istanzaCorrenteId && (
                          <Link
                            href={`/istanze/${ist.id}`}
                            className="btn btn-sm btn-outline-primary"
                            target="_blank"
                          >
                            Apri
                          </Link>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </ModalBody>
        <ModalFooter>
          <Button variant="secondary" onClick={() => setShowModal(false)}>
            Chiudi
          </Button>
        </ModalFooter>
      </Modal>
    </>
  );
}
