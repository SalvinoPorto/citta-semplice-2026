'use client';

import { useState, useTransition, useCallback } from 'react';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Card, CardBody, Button, Input, Select, Alert, Textarea } from '@/components/ui';
import Editor from '@/components/ui/editor';
import { createServizio, updateServizio, deleteServizio } from './actions';
import { servizioSchema, type ServizioFormData } from '@/lib/validations/servizio';
import { FormBuilder, type FormSchema } from '@/components/form-builder';
import Link from 'next/link';

interface Area {
  id: number;
  titolo: string;
}

interface UfficioRef {
  id: number;
  nome: string;
}

interface UnitaOrganizzativa {
  id: string;
  nome: string;
}

interface TributoRef {
  id: number;
  codice: string;
  descrizione: string | null;
}

interface ServizioData {
  id: number;
  titolo: string;
  sottoTitolo: string;
  descrizione: string;
  comeFare: string;
  cosaServe: string;
  altreInfo: string;
  contatti: string;
  slug: string;
  icona: string;
  ordine: number;
  attivo: boolean;
  areaId: number;
  ufficioId: number | null;
  dataInizio: string;
  dataFine: string;
  unicoInvio: boolean;
  unicoInvioPerUtente: boolean;
  campiUnicoInvio: string;
  numeroMaxIstanze: number | null;
  msgSopraSoglia: string;
  msgExtraServizio: string;
  campiInEvidenza: string;
  campiDaEsportare: string;
  // prevedeDocumentoFinale: boolean;
  // templateDocumentoFinale: string;
  // nomeDocumentoFinale: string;
  moduloTipo: 'HTML' | 'PDF';
  attributi: string;
  postFormValidation: boolean;
  postFormValidationAPI: string;
  postFormValidationFields: string;
  steps: ServizioFormData['steps'];
}

interface ServizioFormProps {
  servizio?: ServizioData;
  aree: Area[];
  uffici: UfficioRef[];
  unitaOrganizzative: UnitaOrganizzativa[];
  tributi: TributoRef[];
  isNew?: boolean;
}

export function ServizioForm({ servizio, aree, uffici, unitaOrganizzative, tributi, isNew }: ServizioFormProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [activeTab, setActiveTab] = useState<'informazioni' | 'configurazione' | 'workflow' | 'modulo'>('informazioni');

  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<ServizioFormData>({
    resolver: zodResolver(servizioSchema),
    defaultValues: servizio || {
      titolo: '',
      sottoTitolo: '',
      descrizione: '',
      comeFare: '',
      cosaServe: '',
      altreInfo: '',
      contatti: '',
      slug: '',
      icona: '',
      ordine: 0,
      attivo: true,
      areaId: aree[0]?.id || 0,
      ufficioId: null,
      dataInizio: '',
      dataFine: '',
      unicoInvio: false,
      unicoInvioPerUtente: false,
      campiUnicoInvio: '',
      numeroMaxIstanze: null,
      msgSopraSoglia: '',
      msgExtraServizio: '',
      campiInEvidenza: '',
      campiDaEsportare: '',
      // prevedeDocumentoFinale: false,
      // templateDocumentoFinale: '',
      // nomeDocumentoFinale: '',
      moduloTipo: 'HTML',
      attributi: '',
      postFormValidation: false,
      postFormValidationAPI: '',
      postFormValidationFields: '',
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
          tipoProtocollo: 'E',
          unitaOrganizzativa: '',
          pagamentoCodiceTributoId: null,
          pagamentoImporto: null,
          pagamentoImportoVariabile: false,
          pagamentoCausale: '',
          pagamentoCausaleVariabile: false,
          pagamentoObbligatorio: false,
          pagamentoTipologia: '',
        },
      ],
    },
  });

  const attributi = watch('attributi');
  const initialFormSchema: FormSchema | undefined = attributi
    ? (() => { try { return JSON.parse(attributi); } catch { return undefined; } })()
    : undefined;

  const handleFormSchemaChange = useCallback(
    (schema: FormSchema) => { setValue('attributi', JSON.stringify(schema)); },
    [setValue]
  );

  const tipoModulo = watch('moduloTipo');

  const { fields, append, remove, move } = useFieldArray({
    control,
    name: 'steps',
  });

  const addStep = () => {
    append({
      descrizione: '',
      ordine: fields.length + 1,
      attivo: true,
      pagamento: false,
      allegati: false,
      allegatiOp: false,
      allegatiRequired: false,
      allegatiOpRequired: false,
      protocollo: false,
      tipoProtocollo: undefined,
      unitaOrganizzativa: '',
      pagamentoCodiceTributoId: null,
      pagamentoImporto: null,
      pagamentoImportoVariabile: false,
      pagamentoCausale: '',
      pagamentoCausaleVariabile: false,
      pagamentoObbligatorio: false,
      pagamentoTipologia: '',
    });
  };

  const moveStep = (index: number, direction: 'up' | 'down') => {
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex >= 0 && newIndex < fields.length) {
      move(index, newIndex);
    }
  };

  // Mappa i campi ai tab per mostrare dove si trovano gli errori
  const tabFields: Record<string, string[]> = {
    informazioni: ['titolo', 'sottoTitolo', 'descrizione', 'comeFare', 'cosaServe', 'altreInfo', 'contatti', 'slug', 'icona', 'ordine', 'attivo', 'areaId'],
    configurazione: ['ufficioId', 'dataInizio', 'dataFine', 'unicoInvio', 'unicoInvioPerUtente', 'campiUnicoInvio', 'numeroMaxIstanze', 'msgSopraSoglia', 'msgExtraServizio', 'campiInEvidenza', 'campiDaEsportare', 'prevedeDocumentoFinale', 'templateDocumentoFinale', 'nomeDocumentoFinale'],
    workflow: ['steps'],
    modulo: ['moduloTipo', 'moduloAttributes', 'postFormValidation', 'postFormValidationAPI', 'postFormValidationFields'],
  };

  const tabHasErrors = (tab: string) => {
    const fields = tabFields[tab] || [];
    return fields.some((f) => {
      if (f === 'steps') return Array.isArray(errors.steps) && errors.steps.length > 0;
      return f in errors;
    });
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const onError = (errs: any) => {
    const labels: Record<string, string> = {
      titolo: 'Titolo',
      areaId: 'Area',
      'steps': 'Workflow (descrizione step mancante)',
    };
    const messages = Object.keys(errs)
      .map((k) => labels[k] || k)
      .join(', ');
    setValidationError(`Correggi i seguenti campi: ${messages}`);
  };

  const onSubmit = (data: ServizioFormData) => {
    setError(null);
    setValidationError(null);
    startTransition(async () => {
      try {
        if (isNew) {
          await createServizio(data);
        } else if (servizio) {
          await updateServizio(servizio.id, data);
        }
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : '';
        if (!msg.includes('NEXT_REDIRECT')) {
          setError('Si è verificato un errore');
        }
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

  // const prevedeDoc = watch('prevedeDocumentoFinale');
  const watchedSteps = watch('steps');

  return (
    <form onSubmit={handleSubmit(onSubmit, onError)}>
      {error && (
        <Alert variant="danger" className="mb-4">
          {error}
        </Alert>
      )}
      {validationError && (
        <Alert variant="warning" className="mb-4">
          {validationError}
        </Alert>
      )}

      <div className="row">
        <div className="col-lg-9">
          <ul className="nav nav-tabs mb-4">
            <li className="nav-item">
              <button
                type="button"
                className={`nav-link ${activeTab === 'informazioni' ? 'active' : ''}`}
                onClick={() => setActiveTab('informazioni')}
              >
                Informazioni
                {tabHasErrors('informazioni') && <span className="ms-1 badge bg-danger" style={{ fontSize: '0.6rem' }}>!</span>}
              </button>
            </li>
            <li className="nav-item">
              <button
                type="button"
                className={`nav-link ${activeTab === 'configurazione' ? 'active' : ''}`}
                onClick={() => setActiveTab('configurazione')}
              >
                Configurazione
                {tabHasErrors('configurazione') && <span className="ms-1 badge bg-danger" style={{ fontSize: '0.6rem' }}>!</span>}
              </button>
            </li>
            <li className="nav-item">
              <button
                type="button"
                className={`nav-link ${activeTab === 'workflow' ? 'active' : ''}`}
                onClick={() => setActiveTab('workflow')}
              >
                Workflow ({fields.length})
                {tabHasErrors('workflow') && <span className="ms-1 badge bg-danger" style={{ fontSize: '0.6rem' }}>!</span>}
              </button>
            </li>
            <li className="nav-item">
              <button
                type="button"
                className={`nav-link ${activeTab === 'modulo' ? 'active' : ''}`}
                onClick={() => setActiveTab('modulo')}
              >
                Modulo
                {tabHasErrors('modulo') && <span className="ms-1 badge bg-danger" style={{ fontSize: '0.6rem' }}>!</span>}
              </button>
            </li>
          </ul>

          {/* Tab: Informazioni */}
          {activeTab === 'informazioni' && (
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
                        {area.titolo}
                      </option>
                    ))}
                  </Select>
                </div>

                <div className="row">
                  <div className="col-md-8 mb-3">
                    <Input
                      type="text"
                      label="Titolo *"
                      {...register('titolo')}
                      error={errors.titolo?.message}
                    />
                  </div>
                  <div className="col-md-4 mb-3">
                    <Input type="text" label="Slug (URL)" {...register('slug')} />
                  </div>
                </div>

                <div className="mb-3">
                  <Input type="text" label="Sotto Titolo" {...register('sottoTitolo')} />
                </div>

                <div className="mb-3">
                  <label className="form-label">Descrizione</label>
                  <Controller
                    control={control}
                    name="descrizione"
                    render={({ field: { onChange, value } }) => (
                      <Editor value={value ?? ''} onChange={onChange} />
                    )}
                  />
                </div>

                <div className="mb-3">
                  <label className="form-label">Come fare</label>
                  <Controller
                    control={control}
                    name="comeFare"
                    render={({ field: { onChange, value } }) => (
                      <Editor value={value ?? ''} onChange={onChange} />
                    )}
                  />
                </div>

                <div className="mb-3">
                  <label className="form-label">Cosa serve</label>
                  <Controller
                    control={control}
                    name="cosaServe"
                    render={({ field: { onChange, value } }) => (
                      <Editor value={value ?? ''} onChange={onChange} />
                    )}
                  />
                </div>

                <div className="mb-3">
                  <label className="form-label">Altre informazioni</label>
                  <Controller
                    control={control}
                    name="altreInfo"
                    render={({ field: { onChange, value } }) => (
                      <Editor value={value ?? ''} onChange={onChange} />
                    )}
                  />
                </div>

                <div className="mb-3">
                  <label className="form-label">Contatti</label>
                  <Controller
                    control={control}
                    name="contatti"
                    render={({ field: { onChange, value } }) => (
                      <Editor value={value ?? ''} onChange={onChange} />
                    )}
                  />
                </div>

                <div className="row">
                  <div className="col-md-6 mb-3">
                    <Input type="text" label="Icona (classe CSS o URL)" {...register('icona')} />
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
          )}

          {/* Tab: Configurazione */}
          {activeTab === 'configurazione' && (
            <>
              <Card className="mb-4">
                <CardBody>
                  <h5 className="mb-4">Ufficio e Disponibilità</h5>

                  <div className="row">
                    <div className="col-md-6 mb-3">
                      <Select
                        label="Ufficio gestore"
                        {...register('ufficioId', {
                          setValueAs: (v) => (v === '' ? null : parseInt(v, 10)),
                        })}
                      >
                        <option value="">Nessun ufficio</option>
                        {uffici.map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.nome}
                          </option>
                        ))}
                      </Select>
                    </div>
                  </div>

                  <div className="row">
                    <div className="col-md-6 mb-3">
                      <Input label="Data Inizio" type="date" {...register('dataInizio')} />
                    </div>
                    <div className="col-md-6 mb-3">
                      <Input label="Data Fine" type="date" {...register('dataFine')} />
                    </div>
                  </div>
                </CardBody>
              </Card>

              <Card className="mb-4">
                <CardBody>
                  <h5 className="mb-4">Regole di Invio</h5>

                  <div className="row">
                    <div className="col-md-4 mb-3">
                      <Input
                        label="Numero Max Istanze"
                        type="number"
                        {...register('numeroMaxIstanze')}
                      />
                    </div>
                    <div className="col-md-4 mb-3">
                      <Input
                        label="Messaggio sopra soglia"
                        type="text"
                        {...register('msgSopraSoglia')}
                      />
                    </div>
                    <div className="col-md-4 mb-3">
                      <Input type="text" label="Messaggio Extra" {...register('msgExtraServizio')} />
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
                      Unico invio (una sola istanza per servizio)
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
                      type="text"
                      label="Campi per controllo unico invio (separati da virgola)"
                      {...register('campiUnicoInvio')}
                    />
                  </div>
                </CardBody>
              </Card>

              <Card className="mb-4">
                <CardBody>
                  <h5 className="mb-4">Visualizzazione Istanze</h5>

                  <div className="mb-3">
                    <Input
                      type="text"
                      label="Campi in evidenza (separati da virgola)"
                      {...register('campiInEvidenza')}
                    />
                    <small className="text-muted">Campi mostrati nella lista istanze</small>
                  </div>

                  <div className="mb-3">
                    <Input
                      type="text"
                      label="Campi da esportare (separati da virgola)"
                      {...register('campiDaEsportare')}
                    />
                    <small className="text-muted">Campi inclusi nell&apos;export CSV</small>
                  </div>
                </CardBody>
              </Card>

              {/* <Card className="mb-4">
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

                  {prevedeDoc && (
                    <>
                      <div className="mb-3">
                        <Input
                          type="text"
                          label="Nome documento finale"
                          {...register('nomeDocumentoFinale')}
                        />
                      </div>
                      <div className="mb-3">
                        <label className="form-label">Template documento finale (HTML)</label>
                        <Controller
                          control={control}
                          name="templateDocumentoFinale"
                          render={({ field: { onChange, value } }) => (
                            <Editor value={value ?? ''} onChange={onChange} />
                          )}
                        />
                      </div>
                    </>
                  )}
                </CardBody>
              </Card> */}
            </>
          )}

          {/* Tab: Workflow */}
          {activeTab === 'workflow' && (
            <Card className="mb-4">
              <CardBody>
                <div className="d-flex justify-content-between align-items-center mb-4">
                  <h5 className="mb-0">Steps Workflow</h5>
                  <Button type="button" variant="primary" onClick={addStep}>
                    Aggiungi Step
                  </Button>
                </div>

                {fields.length === 0 && (
                  <p className="text-muted text-center py-4">
                    Nessuno step configurato. Aggiungi almeno uno step per il workflow.
                  </p>
                )}

                {fields.map((field, index) => {
                  const stepData = watchedSteps?.[index];
                  const hasPagamento = stepData?.pagamento;
                  const hasProtocollo = stepData?.protocollo;
                  const hasAllegati = stepData?.allegati;
                  const hasAllegatiOp = stepData?.allegatiOp;
                  const importoVariabile = stepData?.pagamentoImportoVariabile;
                  const causaleVariabile = stepData?.pagamentoCausaleVariabile;

                  return (
                    <div key={field.id} className="border rounded p-3 mb-3">
                      <div className="d-flex justify-content-between align-items-start mb-3">
                        <h6 className="mb-0">Step {index + 1}</h6>
                        <div className="d-flex gap-1">
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-secondary"
                            onClick={() => moveStep(index, 'up')}
                            disabled={index === 0}
                          >
                            ↑
                          </button>
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-secondary"
                            onClick={() => moveStep(index, 'down')}
                            disabled={index === fields.length - 1}
                          >
                            ↓
                          </button>
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-danger"
                            onClick={() => remove(index)}
                          >
                            Rimuovi
                          </button>
                        </div>
                      </div>

                      <div className="mb-3">
                        <Input
                          type="text"
                          label="Descrizione step *"
                          {...register(`steps.${index}.descrizione`)}
                          error={errors.steps?.[index]?.descrizione?.message}
                        />
                      </div>

                      <div className="form-check mb-2">
                        <input
                          type="checkbox"
                          className="form-check-input"
                          id={`step-${index}-attivo`}
                          {...register(`steps.${index}.attivo`)}
                        />
                        <label className="form-check-label" htmlFor={`step-${index}-attivo`}>
                          Step attivo
                        </label>
                      </div>

                      {/* Protocollo */}
                      <div className="form-check mb-2">
                        <input
                          type="checkbox"
                          className="form-check-input"
                          id={`step-${index}-protocollo`}
                          {...register(`steps.${index}.protocollo`)}
                        />
                        <label className="form-check-label" htmlFor={`step-${index}-protocollo`}>
                          Richiede protocollo
                        </label>
                      </div>

                      {hasProtocollo && (
                        <div className="ms-4 mb-3 p-3 bg-light rounded">
                          <div className="row">
                            <div className="col-md-4 mb-2">
                              <label className="form-label small">Tipo protocollo</label>
                              <Controller
                                control={control}
                                name={`steps.${index}.tipoProtocollo`}
                                render={({ field: { value, onChange } }) => (
                                  <div className="d-flex gap-3">
                                    <div className="form-check">
                                      <input
                                        type="radio"
                                        className="form-check-input"
                                        id={`step-${index}-proto-e`}
                                        checked={value === 'E'}
                                        onChange={() => onChange('E')}
                                      />
                                      <label className="form-check-label small" htmlFor={`step-${index}-proto-e`}>
                                        Entrata
                                      </label>
                                    </div>
                                    <div className="form-check">
                                      <input
                                        type="radio"
                                        className="form-check-input"
                                        id={`step-${index}-proto-u`}
                                        checked={value === 'U'}
                                        onChange={() => onChange('U')}
                                      />
                                      <label className="form-check-label small" htmlFor={`step-${index}-proto-u`}>
                                        Uscita
                                      </label>
                                    </div>
                                  </div>
                                )}
                              />
                            </div>
                            <div className="col-md-8 mb-2">
                              <Select label="Unità Organizzativa" {...register(`steps.${index}.unitaOrganizzativa`)}>
                                <option value="">Nessuna selezione</option>
                                {unitaOrganizzative.map((uo) => (
                                  <option key={uo.id} value={uo.id}>
                                    {uo.nome}
                                  </option>
                                ))}
                              </Select>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Allegati utente */}
                      <div className="form-check mb-2">
                        <input
                          type="checkbox"
                          className="form-check-input"
                          id={`step-${index}-allegati`}
                          {...register(`steps.${index}.allegati`)}
                        />
                        <label className="form-check-label" htmlFor={`step-${index}-allegati`}>
                          Richiede allegati dal richiedente
                        </label>
                      </div>

                      {hasAllegati && (
                        <div className="ms-4 mb-2">
                          <div className="form-check">
                            <input
                              type="checkbox"
                              className="form-check-input"
                              id={`step-${index}-allegati-required`}
                              {...register(`steps.${index}.allegatiRequired`)}
                            />
                            <label className="form-check-label small" htmlFor={`step-${index}-allegati-required`}>
                              Allegati obbligatori
                            </label>
                          </div>
                        </div>
                      )}

                      {/* Allegati operatore */}
                      <div className="form-check mb-2">
                        <input
                          type="checkbox"
                          className="form-check-input"
                          id={`step-${index}-allegati-op`}
                          {...register(`steps.${index}.allegatiOp`)}
                        />
                        <label className="form-check-label" htmlFor={`step-${index}-allegati-op`}>
                          Prevede allegati per il richiedente (da parte dell&apos;operatore)
                        </label>
                      </div>

                      {hasAllegatiOp && (
                        <div className="ms-4 mb-2">
                          <div className="form-check">
                            <input
                              type="checkbox"
                              className="form-check-input"
                              id={`step-${index}-allegati-op-required`}
                              {...register(`steps.${index}.allegatiOpRequired`)}
                            />
                            <label className="form-check-label small" htmlFor={`step-${index}-allegati-op-required`}>
                              Allegati operatore obbligatori
                            </label>
                          </div>
                        </div>
                      )}

                      {/* Pagamento */}
                      <div className="form-check mb-2">
                        <input
                          type="checkbox"
                          className="form-check-input"
                          id={`step-${index}-pagamento`}
                          {...register(`steps.${index}.pagamento`)}
                        />
                        <label className="form-check-label" htmlFor={`step-${index}-pagamento`}>
                          Richiede pagamento (PagoPA)
                        </label>
                      </div>

                      {hasPagamento && (
                        <div className="ms-4 mb-3 p-3 bg-light rounded">
                          {/* Codice tributo */}
                          <div className="mb-3">
                            <Select
                              label="Codice Tributo"
                              {...register(`steps.${index}.pagamentoCodiceTributoId`, {
                                setValueAs: (v) => (v === '' ? null : parseInt(v, 10)),
                              })}
                            >
                              <option value="">Seleziona tributo</option>
                              {tributi.map((t) => (
                                <option key={t.id} value={t.id}>
                                  {t.codice} {t.descrizione ? `- ${t.descrizione}` : ''}
                                </option>
                              ))}
                            </Select>
                          </div>

                          {/* Importo */}
                          <div className="mb-3">
                            <label className="form-label small fw-semibold">Importo</label>
                            <Controller
                              control={control}
                              name={`steps.${index}.pagamentoImportoVariabile`}
                              render={({ field: { value, onChange } }) => (
                                <div className="d-flex gap-3 mb-2">
                                  <div className="form-check">
                                    <input
                                      type="radio"
                                      className="form-check-input"
                                      id={`step-${index}-importo-fisso`}
                                      checked={!value}
                                      onChange={() => onChange(false)}
                                    />
                                    <label className="form-check-label small" htmlFor={`step-${index}-importo-fisso`}>
                                      Importo fisso
                                    </label>
                                  </div>
                                  <div className="form-check">
                                    <input
                                      type="radio"
                                      className="form-check-input"
                                      id={`step-${index}-importo-variabile`}
                                      checked={!!value}
                                      onChange={() => onChange(true)}
                                    />
                                    <label className="form-check-label small" htmlFor={`step-${index}-importo-variabile`}>
                                      Variabile (operatore inserisce l&apos;importo)
                                    </label>
                                  </div>
                                </div>
                              )}
                            />
                            {!importoVariabile && (
                              <Input
                                type="number"
                                label="Importo (€)"
                                step="0.01"
                                min={0}
                                {...register(`steps.${index}.pagamentoImporto`, {
                                  setValueAs: (v) => (v === '' ? null : parseFloat(v)),
                                })}
                              />
                            )}
                          </div>

                          {/* Causale */}
                          <div className="mb-3">
                            <label className="form-label small fw-semibold">Causale</label>
                            <Controller
                              control={control}
                              name={`steps.${index}.pagamentoCausaleVariabile`}
                              render={({ field: { value, onChange } }) => (
                                <div className="d-flex gap-3 mb-2">
                                  <div className="form-check">
                                    <input
                                      type="radio"
                                      className="form-check-input"
                                      id={`step-${index}-causale-fissa`}
                                      checked={!value}
                                      onChange={() => onChange(false)}
                                    />
                                    <label className="form-check-label small" htmlFor={`step-${index}-causale-fissa`}>
                                      Causale fissa
                                    </label>
                                  </div>
                                  <div className="form-check">
                                    <input
                                      type="radio"
                                      className="form-check-input"
                                      id={`step-${index}-causale-variabile`}
                                      checked={!!value}
                                      onChange={() => onChange(true)}
                                    />
                                    <label className="form-check-label small" htmlFor={`step-${index}-causale-variabile`}>
                                      Variabile (operatore inserisce la causale)
                                    </label>
                                  </div>
                                </div>
                              )}
                            />
                            {!causaleVariabile && (
                              <Input
                                type="text"
                                label="Causale"
                                {...register(`steps.${index}.pagamentoCausale`)}
                              />
                            )}
                          </div>

                          <div className="form-check">
                            <input
                              type="checkbox"
                              className="form-check-input"
                              id={`step-${index}-pagamento-obbligatorio`}
                              {...register(`steps.${index}.pagamentoObbligatorio`)}
                            />
                            <label
                              className="form-check-label"
                              htmlFor={`step-${index}-pagamento-obbligatorio`}
                            >
                              Pagamento obbligatorio per avanzare al passo successivo
                            </label>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </CardBody>
            </Card>
          )}

          {/* Tab: Modulo */}
          {activeTab === 'modulo' && (
            <Card className="mb-4">
              <CardBody>
                <div className="row mb-3">
                  <div className="col-md-4">
                    <Select label="Tipo modulo *" {...register('moduloTipo')}>
                      <option value="HTML">HTML (Form Builder)</option>
                      <option value="PDF">PDF</option>
                    </Select>
                  </div>
                </div>

                {tipoModulo === 'HTML' && (
                  <div className="mb-3">
                    <label className="form-label fw-semibold">Form Builder</label>
                    <FormBuilder
                      initialSchema={initialFormSchema}
                      onChange={handleFormSchemaChange}
                    />
                  </div>
                )}

                <hr />

                <div className="form-check mb-3">
                  <input
                    type="checkbox"
                    className="form-check-input"
                    id="postFormValidation"
                    {...register('postFormValidation')}
                  />
                  <label className="form-check-label" htmlFor="postFormValidation">
                    Validazione post-invio via API esterna
                  </label>
                </div>

                {watch('postFormValidation') && (
                  <div className="row">
                    <div className="col-md-8 mb-3">
                      <Input type="text" label="URL API di validazione" {...register('postFormValidationAPI')} />
                    </div>
                    <div className="col-md-4 mb-3">
                      <Input
                        type="text"
                        label="Campi da validare (separati da virgola)"
                        {...register('postFormValidationFields')}
                      />
                    </div>
                  </div>
                )}
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
