'use client';

import { useState, useTransition, useCallback } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Card, CardBody, Button, Input, Textarea, Select, Alert } from '@/components/ui';
import { FormBuilder, type FormSchema } from '@/components/form-builder';
import { createModulo, updateModulo, deleteModulo } from './actions';
import { moduloSchema, type ModuloFormData } from '@/lib/validations/modulo';
import Link from 'next/link';

interface Servizio {
  id: number;
  titolo: string;
  area: {
    titolo: string;
  };
}

interface Ufficio {
  id: number;
  nome: string;
}

interface StepData {
  id?: number;
  descrizione: string;
  ordine: number;
  attivo: boolean;
  pagamento: boolean;
  allegati: boolean;
  allegatiOp: boolean;
  allegatiRequired: boolean;
  allegatiOpRequired: boolean;
  protocollo: boolean;
  unitaOrganizzativa?: string;
}

interface ModuloData {
  id: number;
  name: string;
  slug: string;
  description: string;
  tipo: 'HTML' | 'PDF';
  nomeFile: string;
  attributes: string;
  corpo: string;
  dataInizio: string;
  dataFine: string;
  attivo: boolean;
  campiInEvidenza: string;
  campiDaEsportare: string;
  unicoInvio: boolean;
  unicoInvioPerUtente: boolean;
  campiUnicoInvio: string;
  numeroMaxIstanze: number | null;
  avvisoSoglia: number | null;
  msgExtraModulo: string;
  prevedeDocumentoFinale: boolean;
  templateDocumentoFinale: string;
  nomeDocumentoFinale: string;
  servizioId: number;
  ufficioId: number | null;
  steps: StepData[];
}

interface ModuloFormProps {
  modulo?: ModuloData;
  servizi: Servizio[];
  uffici: Ufficio[];
  isNew?: boolean;
}

export function ModuloForm({ modulo, servizi, uffici, isNew }: ModuloFormProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [activeTab, setActiveTab] = useState<'base' | 'formBuilder' | 'steps' | 'advanced'>('base');

  // Parse initial form schema
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
    control,
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
      dataInizio: new Date().toISOString().split('T')[0],
      dataFine: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      attivo: true,
      campiInEvidenza: '',
      campiDaEsportare: '',
      unicoInvio: false,
      unicoInvioPerUtente: false,
      campiUnicoInvio: '',
      numeroMaxIstanze: null,
      avvisoSoglia: null,
      msgExtraModulo: '',
      prevedeDocumentoFinale: false,
      templateDocumentoFinale: '',
      nomeDocumentoFinale: '',
      servizioId: servizi[0]?.id || 0,
      ufficioId: null,
      steps: [
        {
          descrizione: 'Ricezione',
          ordine: 1,
          attivo: true,
          pagamento: false,
          allegati: false,
          allegatiOp: false,
          allegatiRequired: false,
          allegatiOpRequired: false,
          protocollo: true,
          unitaOrganizzativa: '',
        },
      ],
    },
  });

  const { fields, append, remove, move } = useFieldArray({
    control,
    name: 'steps',
  });

  const handleFormSchemaChange = useCallback(
    (schema: FormSchema) => {
      setValue('attributes', JSON.stringify(schema));
    },
    [setValue]
  );

  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
  };

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const name = e.target.value;
    if (isNew) {
      setValue('slug', generateSlug(name));
    }
  };

  const addStep = () => {
    const newOrdine = fields.length + 1;
    append({
      descrizione: '',
      ordine: newOrdine,
      attivo: true,
      pagamento: false,
      allegati: false,
      allegatiOp: false,
      allegatiRequired: false,
      allegatiOpRequired: false,
      protocollo: false,
      unitaOrganizzativa: '',
    });
  };

  const moveStep = (index: number, direction: 'up' | 'down') => {
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex >= 0 && newIndex < fields.length) {
      move(index, newIndex);
      fields.forEach((_, i) => {
        setValue(`steps.${i}.ordine`, i + 1);
      });
    }
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
        if (result?.error) {
          setError(result.error);
        }
      } catch (e) {
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
          {/* Tabs */}
          <ul className="nav nav-tabs mb-4">
            <li className="nav-item">
              <button
                type="button"
                className={`nav-link ${activeTab === 'base' ? 'active' : ''}`}
                onClick={() => setActiveTab('base')}
              >
                Informazioni Base
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
            <li className="nav-item">
              <button
                type="button"
                className={`nav-link ${activeTab === 'steps' ? 'active' : ''}`}
                onClick={() => setActiveTab('steps')}
              >
                Steps Workflow ({fields.length})
              </button>
            </li>
            <li className="nav-item">
              <button
                type="button"
                className={`nav-link ${activeTab === 'advanced' ? 'active' : ''}`}
                onClick={() => setActiveTab('advanced')}
              >
                Impostazioni Avanzate
              </button>
            </li>
          </ul>

          {/* Tab: Base Info */}
          {activeTab === 'base' && (
            <Card className="mb-4">
              <CardBody>
                <h5 className="mb-4">Informazioni Modulo</h5>

                <div className="row">
                  <div className="col-md-8 mb-3">
                    <Input
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
                    label="Slug (URL) *"
                    {...register('slug')}
                    error={errors.slug?.message}
                  />
                  <small className="text-muted">Identificativo univoco per l&apos;URL</small>
                </div>

                <div className="mb-3">
                  <Textarea label="Descrizione" {...register('description')} rows={3} />
                </div>

                <div className="row">
                  <div className="col-md-6 mb-3">
                    <Select
                      label="Servizio *"
                      {...register('servizioId', { valueAsNumber: true })}
                      error={errors.servizioId?.message}
                    >
                      <option value="">Seleziona un servizio</option>
                      {servizi.map((servizio) => (
                        <option key={servizio.id} value={servizio.id}>
                          {servizio.titolo} ({servizio.area.titolo})
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div className="col-md-6 mb-3">
                    <Select
                      label="Ufficio"
                      {...register('ufficioId', {
                        setValueAs: (v) => (v === '' ? null : parseInt(v, 10)),
                      })}
                    >
                      <option value="">Nessun ufficio</option>
                      {uffici.map((ufficio) => (
                        <option key={ufficio.id} value={ufficio.id}>
                          {ufficio.nome}
                        </option>
                      ))}
                    </Select>
                  </div>
                </div>

                <div className="row">
                  <div className="col-md-6 mb-3">
                    <Input
                      label="Data Inizio *"
                      type="date"
                      {...register('dataInizio')}
                      error={errors.dataInizio?.message}
                    />
                  </div>
                  <div className="col-md-6 mb-3">
                    <Input
                      label="Data Fine *"
                      type="date"
                      {...register('dataFine')}
                      error={errors.dataFine?.message}
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
                    Modulo attivo
                  </label>
                </div>
              </CardBody>
            </Card>
          )}

          {/* Tab: Form Builder */}
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

          {/* Tab: Steps */}
          {activeTab === 'steps' && (
            <Card className="mb-4">
              <CardBody>
                <div className="d-flex justify-content-between align-items-center mb-4">
                  <h5 className="mb-0">Steps Workflow</h5>
                  <Button type="button" variant="primary" onClick={addStep}>
                    Aggiungi Step
                  </Button>
                </div>

                {errors.steps?.message && (
                  <Alert variant="danger" className="mb-3">
                    {errors.steps.message}
                  </Alert>
                )}

                {fields.map((field, index) => (
                  <div key={field.id} className="border rounded p-3 mb-3">
                    <div className="d-flex justify-content-between align-items-start mb-3">
                      <h6 className="mb-0">Step {index + 1}</h6>
                      <div className="d-flex gap-1">
                        <Button
                          type="button"
                          variant="outline-secondary"
                          size="sm"
                          onClick={() => moveStep(index, 'up')}
                          disabled={index === 0}
                        >
                          ↑
                        </Button>
                        <Button
                          type="button"
                          variant="outline-secondary"
                          size="sm"
                          onClick={() => moveStep(index, 'down')}
                          disabled={index === fields.length - 1}
                        >
                          ↓
                        </Button>
                        <Button
                          type="button"
                          variant="outline-danger"
                          size="sm"
                          onClick={() => remove(index)}
                          disabled={fields.length === 1}
                        >
                          ×
                        </Button>
                      </div>
                    </div>

                    <input type="hidden" {...register(`steps.${index}.ordine`)} value={index + 1} />

                    <div className="row">
                      <div className="col-md-8 mb-2">
                        <Input
                          label="Descrizione *"
                          {...register(`steps.${index}.descrizione`)}
                          error={errors.steps?.[index]?.descrizione?.message}
                        />
                      </div>
                      <div className="col-md-4 mb-2">
                        <Input
                          label="Unità Organizzativa"
                          {...register(`steps.${index}.unitaOrganizzativa`)}
                        />
                      </div>
                    </div>

                    <div className="row">
                      <div className="col-md-4">
                        <div className="form-check">
                          <input
                            type="checkbox"
                            className="form-check-input"
                            id={`step-${index}-attivo`}
                            {...register(`steps.${index}.attivo`)}
                          />
                          <label className="form-check-label" htmlFor={`step-${index}-attivo`}>
                            Attivo
                          </label>
                        </div>
                        <div className="form-check">
                          <input
                            type="checkbox"
                            className="form-check-input"
                            id={`step-${index}-protocollo`}
                            {...register(`steps.${index}.protocollo`)}
                          />
                          <label className="form-check-label" htmlFor={`step-${index}-protocollo`}>
                            Protocollo
                          </label>
                        </div>
                        <div className="form-check">
                          <input
                            type="checkbox"
                            className="form-check-input"
                            id={`step-${index}-pagamento`}
                            {...register(`steps.${index}.pagamento`)}
                          />
                          <label className="form-check-label" htmlFor={`step-${index}-pagamento`}>
                            Pagamento
                          </label>
                        </div>
                      </div>
                      <div className="col-md-4">
                        <div className="form-check">
                          <input
                            type="checkbox"
                            className="form-check-input"
                            id={`step-${index}-allegati`}
                            {...register(`steps.${index}.allegati`)}
                          />
                          <label className="form-check-label" htmlFor={`step-${index}-allegati`}>
                            Allegati Utente
                          </label>
                        </div>
                        <div className="form-check">
                          <input
                            type="checkbox"
                            className="form-check-input"
                            id={`step-${index}-allegatiRequired`}
                            {...register(`steps.${index}.allegatiRequired`)}
                          />
                          <label
                            className="form-check-label"
                            htmlFor={`step-${index}-allegatiRequired`}
                          >
                            Allegati Obbligatori
                          </label>
                        </div>
                      </div>
                      <div className="col-md-4">
                        <div className="form-check">
                          <input
                            type="checkbox"
                            className="form-check-input"
                            id={`step-${index}-allegatiOp`}
                            {...register(`steps.${index}.allegatiOp`)}
                          />
                          <label className="form-check-label" htmlFor={`step-${index}-allegatiOp`}>
                            Allegati Operatore
                          </label>
                        </div>
                        <div className="form-check">
                          <input
                            type="checkbox"
                            className="form-check-input"
                            id={`step-${index}-allegatiOpRequired`}
                            {...register(`steps.${index}.allegatiOpRequired`)}
                          />
                          <label
                            className="form-check-label"
                            htmlFor={`step-${index}-allegatiOpRequired`}
                          >
                            Allegati Op. Obbligatori
                          </label>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </CardBody>
            </Card>
          )}

          {/* Tab: Advanced */}
          {activeTab === 'advanced' && (
            <>
              <Card className="mb-4">
                <CardBody>
                  <h5 className="mb-4">Limiti e Vincoli</h5>

                  <div className="row">
                    <div className="col-md-4 mb-3">
                      <Input
                        label="Numero Max Istanze"
                        type="number"
                        {...register('numeroMaxIstanze', {
                          setValueAs: (v) => (v === '' ? null : parseInt(v, 10)),
                        })}
                        min={0}
                      />
                    </div>
                    <div className="col-md-4 mb-3">
                      <Input
                        label="Avviso Soglia"
                        type="number"
                        {...register('avvisoSoglia', {
                          setValueAs: (v) => (v === '' ? null : parseInt(v, 10)),
                        })}
                        min={0}
                      />
                    </div>
                    <div className="col-md-4 mb-3">
                      <Input label="Messaggio Extra" {...register('msgExtraModulo')} />
                    </div>
                  </div>

                  <div className="form-check mb-2">
                    <input
                      type="checkbox"
                      className="form-check-input"
                      id="unicoInvio"
                      {...register('unicoInvio')}
                    />
                    <label className="form-check-label" htmlFor="unicoInvio">
                      Unico invio (una sola istanza per modulo)
                    </label>
                  </div>

                  <div className="form-check mb-2">
                    <input
                      type="checkbox"
                      className="form-check-input"
                      id="unicoInvioPerUtente"
                      {...register('unicoInvioPerUtente')}
                    />
                    <label className="form-check-label" htmlFor="unicoInvioPerUtente">
                      Unico invio per utente
                    </label>
                  </div>

                  <div className="mb-3">
                    <Input
                      label="Campi per controllo unico invio (separati da virgola)"
                      {...register('campiUnicoInvio')}
                    />
                  </div>
                </CardBody>
              </Card>

              <Card className="mb-4">
                <CardBody>
                  <h5 className="mb-4">Campi e Esportazione</h5>

                  <div className="mb-3">
                    <Input
                      label="Campi in evidenza (separati da virgola)"
                      {...register('campiInEvidenza')}
                    />
                    <small className="text-muted">Campi mostrati nella lista istanze</small>
                  </div>

                  <div className="mb-3">
                    <Input
                      label="Campi da esportare (separati da virgola)"
                      {...register('campiDaEsportare')}
                    />
                    <small className="text-muted">Campi inclusi nell&apos;export CSV</small>
                  </div>
                </CardBody>
              </Card>

              <Card className="mb-4">
                <CardBody>
                  <h5 className="mb-4">Documento Finale</h5>

                  <div className="form-check mb-3">
                    <input
                      type="checkbox"
                      className="form-check-input"
                      id="prevedeDocumentoFinale"
                      {...register('prevedeDocumentoFinale')}
                    />
                    <label className="form-check-label" htmlFor="prevedeDocumentoFinale">
                      Prevede documento finale
                    </label>
                  </div>

                  <div className="mb-3">
                    <Input label="Nome documento finale" {...register('nomeDocumentoFinale')} />
                  </div>

                  <div className="mb-3">
                    <Textarea
                      label="Template documento finale (HTML)"
                      {...register('templateDocumentoFinale')}
                      rows={6}
                    />
                  </div>
                </CardBody>
              </Card>
            </>
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
