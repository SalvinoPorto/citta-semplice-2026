'use client';

import { useState, useTransition, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Card, CardBody, Button, Input, Alert } from '@/components/ui';
import { createOperatore, updateOperatore, deleteOperatore } from './actions';
import { operatoreSchema, operatoreCreateSchema, type OperatoreFormData } from '@/lib/validations/operatore';
import Link from 'next/link';

interface Ruolo {
  id: number;
  nome: string;
  descrizione: string | null;
}


interface Servizio {
  id: number;
  titolo: string;
  area: { nome: string } | null;
}

interface OperatoreData {
  id: number;
  email: string;
  userName: string;
  nome: string;
  cognome: string;
  telefono: string;
  attivo: boolean;
  ruoliIds: number[];
  serviziIds: number[];
}

interface OperatoreFormProps {
  operatore?: OperatoreData;
  ruoli: Ruolo[];
  servizi: Servizio[];
  isNew?: boolean;
}

export function OperatoreForm({ operatore, ruoli, servizi, isNew }: OperatoreFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [serviziSearch, setServiziSearch] = useState('');
  const [serviziPage, setServiziPage] = useState(1);
  const [soloSelezionati, setSoloSelezionati] = useState(false);
  const PAGE_SIZE = 10;

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<OperatoreFormData>({
    resolver: zodResolver(isNew ? operatoreCreateSchema : operatoreSchema),
    defaultValues: operatore || {
      email: '',
      userName: '',
      password: '',
      nome: '',
      cognome: '',
      telefono: '',
      attivo: true,
      ruoliIds: [],
      serviziIds: []
    },
  });

  const selectedRuoli = watch('ruoliIds') || [];
  const selectedServizi = watch('serviziIds') || [];

  const filteredServizi = useMemo(() => {
    const q = serviziSearch.trim().toLowerCase();
    return servizi.filter((s) => {
      const matchSearch = !q || s.titolo.toLowerCase().includes(q) || (s.area?.nome ?? '').toLowerCase().includes(q);
      const matchSelezione = !soloSelezionati || selectedServizi.includes(s.id);
      return matchSearch && matchSelezione;
    });
  }, [servizi, serviziSearch, soloSelezionati, selectedServizi]);

  const totalPages = Math.max(1, Math.ceil(filteredServizi.length / PAGE_SIZE));
  const pagedServizi = filteredServizi.slice((serviziPage - 1) * PAGE_SIZE, serviziPage * PAGE_SIZE);

  const toggleSelection = (field: 'ruoliIds' | 'serviziIds', id: number) => {
    const current = watch(field) || [];
    if (current.includes(id)) {
      setValue(field, current.filter((v) => v !== id));
    } else {
      setValue(field, [...current, id]);
    }
  };

  const onSubmit = (data: OperatoreFormData) => {
    setError(null);
    startTransition(async () => {
      try {
        let result;
        if (isNew) {
          result = await createOperatore(data as OperatoreFormData & { password: string });
        } else if (operatore) {
          result = await updateOperatore(operatore.id, data);
        }
        if (result?.error) {
          setError(result.error);
        }
      } catch (e) {
        setError('Si è verificato un errore');
      }
    });
  };

  const handleDelete = () => {
    if (!operatore) return;
    startTransition(async () => {
      await deleteOperatore(operatore.id);
    });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      {error && (
        <Alert variant="danger" className="mb-4">
          {error}
        </Alert>
      )}

      <div className="row">
        <div className="col-lg-8">
          <Card className="mb-4">
            <CardBody>
              <h5 className="mb-4">Dati Anagrafici</h5>

              <div className="row">
                <div className="col-md-6 mb-3">
                  <Input
                    type="text"
                    label="Nome *"
                    {...register('nome')}
                    error={errors.nome?.message}
                  />
                </div>
                <div className="col-md-6 mb-3">
                  <Input
                    type="text"
                    label="Cognome *"
                    {...register('cognome')}
                    error={errors.cognome?.message}
                  />
                </div>
              </div>

              <div className="row">
                <div className="col-md-6 mb-3">
                  <Input
                    label="Email *"
                    type="email"
                    {...register('email')}
                    error={errors.email?.message}
                  />
                </div>
                <div className="col-md-6 mb-3">
                  <Input
                    type="text"
                    label="Nome utente (login) *"
                    {...register('userName')}
                    error={errors.userName?.message}
                  />
                </div>
              </div>

              <div className="row">
                <div className="col-md-6 mb-3">
                  <Input
                    label={isNew ? 'Password *' : 'Password (lascia vuoto per non modificare)'}
                    type="password"
                    {...register('password')}
                    error={errors.password?.message}
                  />
                </div>
              </div>

              <div className="row">
                <div className="col-md-12 mb-3">
                  <Input
                    type="text"
                    label="Telefono"
                    {...register('telefono')}
                    error={errors.telefono?.message}
                  />
                </div>
              </div>

              <div className="form-check mb-3">
                <input
                  type="checkbox"
                  className="form-check-input"
                  id="attivo"
                  {...register('attivo')}
                />
                <label className="form-check-label" htmlFor="attivo">
                  Operatore attivo
                </label>
              </div>
            </CardBody>
          </Card>

          <Card className="mb-4">
            <CardBody>
              <h5 className="mb-4">Ruoli *</h5>
              {errors.ruoliIds && (
                <Alert variant="danger" className="mb-3">
                  {errors.ruoliIds.message}
                </Alert>
              )}
              <div className="row">
                {ruoli.map((ruolo) => (
                  <div key={ruolo.id} className="col-md-4 mb-2">
                    <div className="form-check">
                      <input
                        type="checkbox"
                        className="form-check-input"
                        id={`ruolo-${ruolo.id}`}
                        checked={selectedRuoli.includes(ruolo.id)}
                        onChange={() => toggleSelection('ruoliIds', ruolo.id)}
                      />
                      <label className="form-check-label" htmlFor={`ruolo-${ruolo.id}`}>
                        <strong>{ruolo.nome}</strong>
                        {ruolo.descrizione && (
                          <div className="small text-muted">{ruolo.descrizione}</div>
                        )}
                      </label>
                    </div>
                  </div>
                ))}
              </div>
            </CardBody>
          </Card>

          <Card className="mb-4">
            <CardBody>
              <div className="d-flex align-items-center justify-content-between mb-3">
                <h5 className="mb-0">Servizi Assegnati</h5>
                <small className="text-muted">{selectedServizi.length} selezionati</small>
              </div>

              <div className="d-flex gap-2 align-items-center mb-3">
                <input
                  type="text"
                  className="form-control form-control-sm"
                  placeholder="Cerca servizio..."
                  value={serviziSearch}
                  onChange={(e) => { setServiziSearch(e.target.value); setServiziPage(1); }}
                />
                <div className="form-check mb-0 text-nowrap">
                  <input
                    type="checkbox"
                    className="form-check-input"
                    id="solo-selezionati"
                    checked={soloSelezionati}
                    onChange={(e) => { setSoloSelezionati(e.target.checked); setServiziPage(1); }}
                  />
                  <label className="form-check-label small" htmlFor="solo-selezionati">
                    Solo selezionati
                  </label>
                </div>
              </div>

              <div className="table-responsive">
                <table className="table table-sm table-hover mb-2">
                  <tbody>
                    {pagedServizi.length === 0 ? (
                      <tr>
                        <td className="text-muted fst-italic">Nessun servizio trovato</td>
                      </tr>
                    ) : pagedServizi.map((servizio) => (
                      <tr
                        key={servizio.id}
                        onClick={() => toggleSelection('serviziIds', servizio.id)}
                        style={{ cursor: 'pointer' }}
                      >
                        <td style={{ width: 32 }}>
                          <input
                            type="checkbox"
                            className="form-check-input"
                            checked={selectedServizi.includes(servizio.id)}
                            onChange={() => toggleSelection('serviziIds', servizio.id)}
                            onClick={(e) => e.stopPropagation()}
                          />
                        </td>
                        <td>{servizio.titolo}</td>
                        <td className="text-muted small">{servizio.area?.nome ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {totalPages > 1 && (
                <div className="d-flex align-items-center justify-content-between">
                  <small className="text-muted">
                    Pagina {serviziPage} di {totalPages} ({filteredServizi.length} risultati)
                  </small>
                  <div className="d-flex gap-1">
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-secondary"
                      disabled={serviziPage === 1}
                      onClick={() => setServiziPage((p) => p - 1)}
                    >
                      ‹
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-secondary"
                      disabled={serviziPage === totalPages}
                      onClick={() => setServiziPage((p) => p + 1)}
                    >
                      ›
                    </button>
                  </div>
                </div>
              )}
            </CardBody>
          </Card>
        </div>

        <div className="col-lg-4">
          <Card className="sticky-top" style={{ top: '1rem' }}>
            <CardBody>
              <h5 className="mb-4">Azioni</h5>

              <div className="d-grid gap-2">
                <Button type="submit" variant="primary" loading={isPending}>
                  {isNew ? 'Crea Operatore' : 'Salva Modifiche'}
                </Button>

                <Link href="/operatori" className="btn btn-outline-secondary">
                  Annulla
                </Link>

                {!isNew && operatore && (
                  <>
                    <hr />
                    {!showDeleteConfirm ? (
                      <Button
                        type="button"
                        variant="outline-danger"
                        onClick={() => setShowDeleteConfirm(true)}
                      >
                        Elimina Operatore
                      </Button>
                    ) : (
                      <div className="text-center">
                        <p className="text-danger mb-2">Confermi l&apos;eliminazione?</p>
                        <div className="d-flex gap-2">
                          <Button
                            type="button"
                            variant="danger"
                            onClick={handleDelete}
                            loading={isPending}
                          >
                            Elimina
                          </Button>
                          <Button
                            type="button"
                            variant="secondary"
                            onClick={() => setShowDeleteConfirm(false)}
                          >
                            Annulla
                          </Button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </CardBody>
          </Card>
        </div>
      </div>
    </form>
  );
}
