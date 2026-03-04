'use client';

import { useState, useTransition, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Card, CardBody, Button, Input, Textarea, Select, Alert } from '@/components/ui';
import { FormBuilder, type FormSchema } from '@/components/form-builder';
import { createModulo, updateModulo, deleteModulo } from './actions';
import { moduloSchema, type ModuloFormData } from '@/lib/validations/modulo';
import Link from 'next/link';

interface ModuloData {
  id: number;
  name: string;
  slug: string;
  description: string;
  tipo: 'HTML' | 'PDF';
  nomeFile: string;
  attributes: string;
  corpo: string;
  attivo: boolean;
}

interface ModuloFormProps {
  modulo?: ModuloData;
  isNew?: boolean;
}

export function ModuloForm({ modulo, isNew }: ModuloFormProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [activeTab, setActiveTab] = useState<'base' | 'formBuilder'>('base');

  const initialFormSchema: FormSchema | undefined = modulo?.attributes
    ? (() => {
      try {
        return JSON.parse(modulo.attributes);
      } catch {
        return undefined;
      }
    })()
    : undefined;

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<ModuloFormData>({
    resolver: zodResolver(moduloSchema),
    defaultValues: modulo || {
      name: '',
      slug: '',
      description: '',
      tipo: 'HTML',
      nomeFile: '',
      attributes: '',
      corpo: '',
      attivo: true,
    },
  });

  const handleFormSchemaChange = useCallback(
    (schema: FormSchema) => {
      setValue('attributes', JSON.stringify(schema));
    },
    [setValue]
  );

  const generateSlug = (name: string) =>
    name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (isNew) setValue('slug', generateSlug(e.target.value));
  };

  const onSubmit = (data: ModuloFormData) => {
    setError(null);
    startTransition(async () => {
      try {
        let result;
        if (isNew) {
          result = await createModulo(data);
        } else if (modulo) {
          result = await updateModulo(modulo.id, data);
        }
        if (result?.error) setError(result.error);
      } catch {
        setError('Si è verificato un errore');
      }
    });
  };

  const handleDelete = () => {
    if (!modulo) return;
    startTransition(async () => {
      const result = await deleteModulo(modulo.id);
      if (result?.error) {
        setError(result.error);
        setShowDeleteConfirm(false);
      }
    });
  };

  const tipo = watch('tipo');

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      {error && (
        <Alert variant="danger" className="mb-4">
          {error}
        </Alert>
      )}

      <div className="row">
        <div className="col-lg-9">
          <ul className="nav nav-tabs mb-4">
            <li className="nav-item">
              <button
                type="button"
                className={`nav-link ${activeTab === 'base' ? 'active' : ''}`}
                onClick={() => setActiveTab('base')}
              >
                Informazioni
              </button>
            </li>
            {tipo === 'HTML' && (
              <li className="nav-item">
                <button
                  type="button"
                  className={`nav-link ${activeTab === 'formBuilder' ? 'active' : ''}`}
                  onClick={() => setActiveTab('formBuilder')}
                >
                  Form Builder
                </button>
              </li>
            )}
          </ul>

          {activeTab === 'base' && (
            <Card className="mb-4">
              <CardBody>
                <h5 className="mb-4">Informazioni Modulo</h5>

                <div className="row">
                  <div className="col-md-8 mb-3">
                    <Input
                      type="text"
                      label="Nome Modulo *"
                      {...register('name', { onChange: handleNameChange })}
                      error={errors.name?.message}
                    />
                  </div>
                  <div className="col-md-4 mb-3">
                    <Select label="Tipo *" {...register('tipo')}>
                      <option value="HTML">HTML (Form Builder)</option>
                      <option value="PDF">PDF</option>
                    </Select>
                  </div>
                </div>

                <div className="mb-3">
                  <Input
                    type="text"
                    label="Slug (URL) *"
                    {...register('slug')}
                    error={errors.slug?.message}
                  />
                  <small className="text-muted">Identificativo univoco per l&apos;URL</small>
                </div>

                <div className="mb-3">
                  <Textarea label="Descrizione" {...register('description')} rows={3} />
                </div>

                {tipo === 'PDF' && (
                  <div className="mb-3">
                    <Input type="text" label="Nome File PDF" {...register('nomeFile')} />
                  </div>
                )}

                <div className="form-check mb-3">
                  <input
                    type="checkbox"
                    className="form-check-input"
                    id="attivo"
                    {...register('attivo')}
                  />
                  <label className="form-check-label" htmlFor="attivo">
                    Modulo attivo
                  </label>
                </div>
              </CardBody>
            </Card>
          )}

          {activeTab === 'formBuilder' && tipo === 'HTML' && (
            <Card className="mb-4">
              <CardBody>
                <FormBuilder
                  initialSchema={initialFormSchema}
                  onChange={handleFormSchemaChange}
                />
              </CardBody>
            </Card>
          )}
        </div>

        <div className="col-lg-3">
          <Card className="sticky-top" style={{ top: '1rem' }}>
            <CardBody>
              <h5 className="mb-4">Azioni</h5>

              <div className="d-grid gap-2">
                <Button type="submit" variant="primary" loading={isPending}>
                  {isNew ? 'Crea Modulo' : 'Salva Modifiche'}
                </Button>

                <Link href="/moduli" className="btn btn-outline-secondary">
                  Annulla
                </Link>

                {!isNew && modulo && (
                  <>
                    <hr />
                    {!showDeleteConfirm ? (
                      <Button
                        type="button"
                        variant="outline-danger"
                        onClick={() => setShowDeleteConfirm(true)}
                      >
                        Elimina Modulo
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
