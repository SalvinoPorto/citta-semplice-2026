'use client';

import { useState, useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Card, CardBody, Button, Input, Textarea, Alert } from '@/components/ui';
import { createEnte, updateEnte, deleteEnte } from './actions';
import { enteSchema, type EnteFormData } from '@/lib/validations/ente';
import Link from 'next/link';

interface EnteData {
  id: number;
  nome: string;
  descrizione: string;
  indirizzo: string;
  telefono: string;
  email: string;
  pec: string;
  logo: string;
  attivo: boolean;
}

interface EnteFormProps {
  ente?: EnteData;
  isNew?: boolean;
}

export function EnteForm({ ente, isNew }: EnteFormProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<EnteFormData>({
    resolver: zodResolver(enteSchema),
    defaultValues: ente || {
      nome: '',
      descrizione: '',
      codiceFiscale: '',
      indirizzo: '',
      telefono: '',
      email: '',
      pec: '',
      logo: '',
      attivo: true,
    },
  });

  const onSubmit = (data: EnteFormData) => {
    setError(null);
    startTransition(async () => {
      try {
        if (isNew) {
          await createEnte(data);
        } else if (ente) {
          await updateEnte(ente.id, data);
        }
      } catch (e) {
        setError('Si è verificato un errore');
      }
    });
  };

  const handleDelete = () => {
    if (!ente) return;
    startTransition(async () => {
      const result = await deleteEnte(ente.id);
      /* if (result?.error) {
        setError(result.error);
        setShowDeleteConfirm(false);
      } */
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
              <h5 className="mb-4">Informazioni Ente</h5>

              <div className="mb-3">
                <Input
                  type="text"
                  label="Nome Ente *"
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
                    type="text"
                    label="Codice Fiscale / P.IVA"
                    {...register('codiceFiscale')}
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
                    label="PEC"
                    type="email"
                    {...register('pec')}
                    error={errors.pec?.message}
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
                  Ente attivo
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
                  {isNew ? 'Crea Ente' : 'Salva Modifiche'}
                </Button>

                <Link href="/enti" className="btn btn-outline-secondary">
                  Annulla
                </Link>

                {!isNew && ente && (
                  <>
                    <hr />
                    {!showDeleteConfirm ? (
                      <Button
                        type="button"
                        variant="outline-danger"
                        onClick={() => setShowDeleteConfirm(true)}
                      >
                        Elimina Ente
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
