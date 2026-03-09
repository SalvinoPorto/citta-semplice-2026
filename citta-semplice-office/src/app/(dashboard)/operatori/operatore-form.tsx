'use client';

import { useState, useTransition } from 'react';
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
              <h5 className="mb-4">Servizi Assegnati</h5>
              <div className="row">
                {servizi.map((servizio) => (
                  <div key={servizio.id} className="col-md-6 mb-2">
                    <div className="form-check">
                      <input
                        type="checkbox"
                        className="form-check-input"
                        id={`servizio-${servizio.id}`}
                        checked={selectedServizi.includes(servizio.id)}
                        onChange={() => toggleSelection('serviziIds', servizio.id)}
                      />
                      <label className="form-check-label" htmlFor={`servizio-${servizio.id}`}>
                        {servizio.titolo}
                      </label>
                    </div>
                  </div>
                ))}
              </div>
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
