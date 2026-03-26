'use client';

import { useState, useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Card, CardBody, Button, Input, Textarea, Alert } from '@/components/ui';
import { createUfficio, updateUfficio, deleteUfficio } from './actions';
import { ufficioSchema, type UfficioFormData } from '@/lib/validations/ufficio';
import Link from 'next/link';

interface UfficioData {
  id: number;
  nome: string;
  descrizione: string;
  email: string;
  telefono: string;
  indirizzo: string;
  attivo: boolean;
}

interface UfficioFormProps {
  ufficio?: UfficioData;
  isNew?: boolean;
}

export function UfficioForm({ ufficio, isNew }: UfficioFormProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<UfficioFormData>({
    resolver: zodResolver(ufficioSchema),
    defaultValues: ufficio || {
      nome: '',
      descrizione: '',
      email: '',
      telefono: '',
      indirizzo: '',
      attivo: true,
    },
  });

  const onSubmit = (data: UfficioFormData) => {
    setError(null);
    startTransition(async () => {
      try {
        if (isNew) {
          await createUfficio(data);
        } else if (ufficio) {
          await updateUfficio(ufficio.id, data);
        }
      } catch (e) {
        setError('Si è verificato un errore');
      }
    });
  };

  const handleDelete = () => {
    if (!ufficio) return;
    startTransition(async () => {
      const result = await deleteUfficio(ufficio.id);
      if (result?.error) {
        setError(result.error);
        setShowDeleteConfirm(false);
      }
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
              <h5 className="mb-4">Informazioni Ufficio</h5>

              <div className="mb-3">
                <Input
                  type="text"
                  label="Nome Ufficio *"
                  {...register('nome')}
                  error={errors.nome?.message}
                />
              </div>

              <div className="mb-3">
                <Textarea
                  label="Descrizione"
                  {...register('descrizione')}
                  rows={3}
                />
              </div>

              <div className="row">
                <div className="col-md-6 mb-3">
                  <Input
                    label="Email"
                    type="email"
                    {...register('email')}
                    error={errors.email?.message}
                  />
                </div>
                <div className="col-md-6 mb-3">
                  <Input
                    type="text"
                    label="Telefono"
                    {...register('telefono')}
                  />
                </div>
              </div>

              <div className="mb-3">
                <Input
                  type="text"
                  label="Indirizzo"
                  {...register('indirizzo')}
                />
              </div>

              <div className="form-check mb-3">
                <input
                  type="checkbox"
                  className="form-check-input"
                  id="attivo"
                  {...register('attivo')}
                />
                <label className="form-check-label" htmlFor="attivo">
                  Ufficio attivo
                </label>
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
                  {isNew ? 'Crea Ufficio' : 'Salva Modifiche'}
                </Button>

                <Link href="/amministrazione/uffici" className="btn btn-outline-secondary">
                  Annulla
                </Link>

                {!isNew && ufficio && (
                  <>
                    <hr />
                    {!showDeleteConfirm ? (
                      <Button
                        type="button"
                        variant="outline-danger"
                        onClick={() => setShowDeleteConfirm(true)}
                      >
                        Elimina Ufficio
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
