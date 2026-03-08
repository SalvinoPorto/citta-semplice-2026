'use client';

import { useState, useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Card, CardBody, Button, Input, Textarea, Select, Alert } from '@/components/ui';
import { createArea, updateArea, deleteArea } from './actions';
import { areaSchema, type AreaFormData } from '@/lib/validations/area';
import Link from 'next/link';

interface Ente {
  id: number;
  ente: string;
}

interface AreaData {
  id: number;
  titolo: string;
  descrizione: string;
  icona: string;
  ordine: number;
  attiva: boolean;
}

interface AreaFormProps {
  area?: AreaData;
  isNew?: boolean;
}

export function AreaForm({ area, isNew }: AreaFormProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<AreaFormData>({
    resolver: zodResolver(areaSchema),
    defaultValues: area || {
      titolo: '',
      descrizione: '',
      icona: '',
      ordine: 0,
      attiva: true,
    },
  });

  const onSubmit = (data: AreaFormData) => {
    setError(null);
    startTransition(async () => {
      try {
        if (isNew) {
          await createArea(data);
        } else if (area) {
          await updateArea(area.id, data);
        }
      } catch (e) {
        setError('Si è verificato un errore');
      }
    });
  };

  const handleDelete = () => {
    if (!area) return;
    startTransition(async () => {
      const result = await deleteArea(area.id);
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
              <h5 className="mb-4">Informazioni Area</h5>

              <div className="mb-3">
                <Input
                  type="text"
                  label="Titolo *"
                  {...register('titolo')}
                  error={errors.titolo?.message}
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
                    label="Icona (classe CSS o URL)"
                    {...register('icona')}
                  />
                </div>
                <div className="col-md-6 mb-3">
                  <Input
                    label="Ordine"
                    type="number"
                    {...register('ordine', { valueAsNumber: true })}
                    min={0}
                  />
                </div>
              </div>

              <div className="form-check mb-3">
                <input
                  type="checkbox"
                  className="form-check-input"
                  id="attiva"
                  {...register('attiva')}
                />
                <label className="form-check-label" htmlFor="attiva">
                  Area attiva
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
                  {isNew ? 'Crea Area' : 'Salva Modifiche'}
                </Button>

                <Link href="/aree" className="btn btn-outline-secondary">
                  Annulla
                </Link>

                {!isNew && area && (
                  <>
                    <hr />
                    {!showDeleteConfirm ? (
                      <Button
                        type="button"
                        variant="outline-danger"
                        onClick={() => setShowDeleteConfirm(true)}
                      >
                        Elimina Area
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
