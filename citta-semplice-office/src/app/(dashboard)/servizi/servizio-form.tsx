'use client';

import { useState, useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Card, CardBody, Button, Input, Textarea, Select, Alert } from '@/components/ui';
import { createServizio, updateServizio, deleteServizio } from './actions';
import { servizioSchema, type ServizioFormData } from '@/lib/validations/servizio';
import Link from 'next/link';

interface Area {
  id: number;
  titolo: string;
  ente: {
    ente: string;
  };
}

interface ServizioData {
  id: number;
  titolo: string;
  descrizione: string;
  icona: string;
  ordine: number;
  attivo: boolean;
  areaId: number;
}

interface ServizioFormProps {
  servizio?: ServizioData;
  aree: Area[];
  isNew?: boolean;
}

export function ServizioForm({ servizio, aree, isNew }: ServizioFormProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ServizioFormData>({
    resolver: zodResolver(servizioSchema),
    defaultValues: servizio || {
      titolo: '',
      descrizione: '',
      icona: '',
      ordine: 0,
      attivo: true,
      areaId: aree[0]?.id || 0,
    },
  });

  const onSubmit = (data: ServizioFormData) => {
    setError(null);
    startTransition(async () => {
      try {
        if (isNew) {
          await createServizio(data);
        } else if (servizio) {
          await updateServizio(servizio.id, data);
        }
      } catch (e) {
        setError('Si è verificato un errore');
      }
    });
  };

  const handleDelete = () => {
    if (!servizio) return;
    startTransition(async () => {
      const result = await deleteServizio(servizio.id);
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
              <h5 className="mb-4">Informazioni Servizio</h5>

              <div className="mb-3">
                <Select
                  label="Area *"
                  {...register('areaId', { valueAsNumber: true })}
                  error={errors.areaId?.message}
                >
                  <option value="">Seleziona un&apos;area</option>
                  {aree.map((area) => (
                    <option key={area.id} value={area.id}>
                      {area.titolo} ({area.ente.ente})
                    </option>
                  ))}
                </Select>
              </div>

              <div className="mb-3">
                <Input
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
                  id="attivo"
                  {...register('attivo')}
                />
                <label className="form-check-label" htmlFor="attivo">
                  Servizio attivo
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
                  {isNew ? 'Crea Servizio' : 'Salva Modifiche'}
                </Button>

                <Link href="/servizi" className="btn btn-outline-secondary">
                  Annulla
                </Link>

                {!isNew && servizio && (
                  <>
                    <hr />
                    {!showDeleteConfirm ? (
                      <Button
                        type="button"
                        variant="outline-danger"
                        onClick={() => setShowDeleteConfirm(true)}
                      >
                        Elimina Servizio
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
