'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Card, CardBody, Button, Input, Select } from '@/components/ui';
import Editor from '@/components/ui/editor';
import { createServizio, updateServizio, deleteServizio } from './actions';
import { servizioSchema, type ServizioFormData } from '@/lib/validations/servizio';
import { AllegatiRichiestiEditor } from './allegati-richiesti-editor';
import { FormBuilder, type FormSchema } from '@/components/form-builder';

interface Area {
  id: number;
  nome: string;
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
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
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
      attributi: '',
      postFormValidation: false,
      postFormValidationAPI: '',
      postFormValidationFields: '',
      steps: [
        {
          descrizione: 'Presentazione Istanza',
          ordine: 1,
          attivo: true,
          pagamento: false,
          allegati: false,
          allegatiOp: false,
          allegatiRequired: false,
          allegatiOpRequired: false,
          protocollo: true,
          tipoProtocollo: 'E' as const,
          unitaOrganizzativa: '',
          numerazioneInterna: false,
          pagamentoCodiceTributoId: null,
          pagamentoImporto: null,
          pagamentoImportoVariabile: false,
          pagamentoCausale: '',
          pagamentoCausaleVariabile: false,
          pagamentoObbligatorio: false,
          pagamentoTipologia: '',
          allegatiRichiestiList: [],
        },
        {
          descrizione: 'Chiusura Pratica',
          ordine: 2,
          attivo: true,
          pagamento: false,
          allegati: false,
          allegatiOp: false,
          allegatiRequired: false,
          allegatiOpRequired: false,
          protocollo: false,
          tipoProtocollo: undefined,
          unitaOrganizzativa: '',
          numerazioneInterna: false,
          pagamentoCodiceTributoId: null,
          pagamentoImporto: null,
          pagamentoImportoVariabile: false,
          pagamentoCausale: '',
          pagamentoCausaleVariabile: false,
          pagamentoObbligatorio: false,
          pagamentoTipologia: '',
          allegatiRichiestiList: [],
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

  const { fields, remove, move, insert } = useFieldArray({
    control,
    name: 'steps',
  });

  const STEP_VUOTO = {
    descrizione: '',
    ordine: 0,
    attivo: true,
    pagamento: false,
    allegati: false,
    allegatiOp: false,
    allegatiRequired: false,
    allegatiOpRequired: false,
    protocollo: false,
    tipoProtocollo: undefined as 'E' | 'U' | undefined,
    unitaOrganizzativa: '',
    numerazioneInterna: false,
    pagamentoCodiceTributoId: null as number | null,
    pagamentoImporto: null as number | null,
    pagamentoImportoVariabile: false,
    pagamentoCausale: '',
    pagamentoCausaleVariabile: false,
    pagamentoObbligatorio: false,
    pagamentoTipologia: '',
    allegatiRichiestiList: [] as NonNullable<ServizioFormData['steps'][number]['allegatiRichiestiList']>,
  };

  // Insert new intermediate step before the last (fixed) step
  const addStep = () => {
    const insertAt = Math.max(1, fields.length - 1);
    insert(insertAt, { ...STEP_VUOTO });
  };

  // Middle steps can only move within [1, fields.length-2]
  const moveStep = (index: number, direction: 'up' | 'down') => {
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex <= 0 || newIndex >= fields.length - 1) return;
    move(index, newIndex);
  };

  // Mappa i campi ai tab per mostrare dove si trovano gli errori
  const tabFields: Record<string, string[]> = {
    informazioni: ['titolo', 'sottoTitolo', 'descrizione', 'comeFare', 'cosaServe', 'altreInfo', 'contatti', 'slug', 'icona', 'ordine', 'attivo', 'areaId'],
    configurazione: ['ufficioId', 'dataInizio', 'dataFine', 'unicoInvio', 'unicoInvioPerUtente', 'campiUnicoInvio', 'numeroMaxIstanze', 'msgSopraSoglia', 'msgExtraServizio', 'campiInEvidenza', 'campiDaEsportare'],
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
      steps: 'Workflow',
    };
    const messages = Object.keys(errs)
      .map((k) => labels[k] || k)
      .join(', ');
    toast.error(`Correggi i seguenti campi: ${messages}`);
  };

  const onSubmit = async (data: ServizioFormData) => {
    setLoading(true);
    try {
      const result = isNew
        ? await createServizio(data)
        : await updateServizio(servizio!.id, data);
      if (result.success) {
        toast.success(result.message, { duration: 1500 });
        setTimeout(() => router.push('/amministrazione/servizi'), 1500);
      } else {
        toast.error(result.message);
      }
    } catch {
      toast.error('Si è verificato un errore');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!servizio) return;
    if (!confirm('Sei sicuro di voler eliminare questo servizio?')) return;
    setDeleteLoading(true);
    try {
      const result = await deleteServizio(servizio.id);
      if (result.success) {
        toast.success(result.message, { duration: 1500 });
        setTimeout(() => router.push('/amministrazione/servizi'), 1500);
      } else {
        toast.error(result.message);
      }
    } catch {
      toast.error('Si è verificato un errore');
    } finally {
      setDeleteLoading(false);
    }
  };

  // const prevedeDoc = watch('prevedeDocumentoFinale');
  const watchedSteps = watch('steps');

  return (
    <form onSubmit={handleSubmit(onSubmit, onError)}>

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
                className={`nav-link ${activeTab === 'modulo' ? 'active' : ''}`}
                onClick={() => setActiveTab('modulo')}
              >
                Modulo
                {tabHasErrors('modulo') && <span className="ms-1 badge bg-danger" style={{ fontSize: '0.6rem' }}>!</span>}
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
                className={`nav-link ${activeTab === 'configurazione' ? 'active' : ''}`}
                onClick={() => setActiveTab('configurazione')}
              >
                Configurazione
                {tabHasErrors('configurazione') && <span className="ms-1 badge bg-danger" style={{ fontSize: '0.6rem' }}>!</span>}
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
                        {area.nome}
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

          {/* Tab: Modulo */}
          {activeTab === 'modulo' && (
            <Card className="mb-4">
              <CardBody>
                <div className="mb-3">
                  <label className="form-label fw-semibold">Form Builder</label>
                  <FormBuilder
                    initialSchema={initialFormSchema}
                    onChange={handleFormSchemaChange}
                  />
                </div>

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

                {fields.map((field, index) => {
                  const isFirst = index === 0;
                  const isLast = index === fields.length - 1;
                  const isMiddle = !isFirst && !isLast;

                  const stepData = watchedSteps?.[index];
                  const hasPagamento = stepData?.pagamento;
                  const hasAllegati = stepData?.allegati;
                  const importoVariabile = stepData?.pagamentoImportoVariabile;
                  const causaleVariabile = stepData?.pagamentoCausaleVariabile;

                  // Protocollo mode for first/last steps: 'nessuno' | 'esterno' | 'interno'
                  type ProtoMode = 'nessuno' | 'esterno' | 'interno';
                  const protoMode: ProtoMode = stepData?.numerazioneInterna
                    ? 'interno'
                    : stepData?.protocollo
                      ? 'esterno'
                      : 'nessuno';

                  const setProtoMode = (mode: ProtoMode) => {
                    setValue(`steps.${index}.protocollo`, mode === 'esterno');
                    setValue(`steps.${index}.numerazioneInterna`, mode === 'interno');
                    if (mode === 'esterno') {
                      setValue(`steps.${index}.tipoProtocollo`, isFirst ? 'E' : 'U');
                    } else {
                      setValue(`steps.${index}.tipoProtocollo`, undefined);
                    }
                  };

                  return (
                    <div
                      key={field.id}
                      className={`border rounded p-3 mb-3 ${isFirst || isLast ? 'border-primary bg-primary bg-opacity-10' : ''}`}
                    >
                      {/* Step header */}
                      <div className="d-flex justify-content-between align-items-start mb-3">
                        <div className="d-flex align-items-center gap-2">
                          <h6 className="mb-0">
                            Step {index + 1}
                            {isFirst && ' — Presentazione Istanza'}
                            {isLast && ' — Chiusura Pratica'}
                          </h6>
                          {(isFirst || isLast) && (
                            <span className="badge text-bg-primary" style={{ fontSize: '0.65rem' }}>
                              Fisso
                            </span>
                          )}
                        </div>
                        {isMiddle && (
                          <div className="d-flex gap-1">
                            <button
                              type="button"
                              className="btn btn-sm btn-outline-secondary"
                              onClick={() => moveStep(index, 'up')}
                              disabled={index === 1}
                              title="Sposta su"
                            >
                              ↑
                            </button>
                            <button
                              type="button"
                              className="btn btn-sm btn-outline-secondary"
                              onClick={() => moveStep(index, 'down')}
                              disabled={index === fields.length - 2}
                              title="Sposta giù"
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
                        )}
                      </div>

                      {/* Descrizione: readonly per primo e ultimo, editabile per gli intermedi */}
                      {isMiddle ? (
                        <div className="mb-3">
                          <Input
                            type="text"
                            label="Descrizione step *"
                            {...register(`steps.${index}.descrizione`)}
                            error={errors.steps?.[index]?.descrizione?.message}
                          />
                        </div>
                      ) : (
                        <input type="hidden" {...register(`steps.${index}.descrizione`)} />
                      )}

                      <div className="form-check mb-3">
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

                      {/* ── Protocollo: primo e ultimo usano radio a 3 opzioni ── */}
                      {(isFirst || isLast) && (
                        <div className="mb-3">
                          <label className="form-label small fw-semibold">Protocollazione</label>
                          <div className="d-flex flex-column gap-1 ms-1">
                            <div className="form-check">
                              <input
                                type="radio"
                                className="form-check-input"
                                id={`step-${index}-proto-nessuno`}
                                checked={protoMode === 'nessuno'}
                                onChange={() => setProtoMode('nessuno')}
                              />
                              <label className="form-check-label small" htmlFor={`step-${index}-proto-nessuno`}>
                                Nessuna protocollazione
                              </label>
                            </div>
                            <div className="form-check">
                              <input
                                type="radio"
                                className="form-check-input"
                                id={`step-${index}-proto-esterno`}
                                checked={protoMode === 'esterno'}
                                onChange={() => setProtoMode('esterno')}
                              />
                              <label className="form-check-label small" htmlFor={`step-${index}-proto-esterno`}>
                                Protocollazione esterna ({isFirst ? 'Entrata' : 'Uscita'}) — API protocollo
                              </label>
                            </div>
                            <div className="form-check">
                              <input
                                type="radio"
                                className="form-check-input"
                                id={`step-${index}-proto-interno`}
                                checked={protoMode === 'interno'}
                                onChange={() => setProtoMode('interno')}
                              />
                              <label className="form-check-label small" htmlFor={`step-${index}-proto-interno`}>
                                Numerazione progressiva interna (prefisso <code>PE_</code>)
                              </label>
                            </div>
                          </div>
                          {protoMode === 'esterno' && (
                            <div className="ms-4 mt-2">
                              <Select label="Unità Organizzativa" {...register(`steps.${index}.unitaOrganizzativa`)}>
                                <option value="">Nessuna selezione</option>
                                {unitaOrganizzative.map((uo) => (
                                  <option key={uo.id} value={uo.id}>
                                    {uo.nome}
                                  </option>
                                ))}
                              </Select>
                            </div>
                          )}
                          {protoMode === 'interno' && (
                            <p className="ms-4 mt-1 mb-0 text-muted small">
                              Verrà assegnato un numero progressivo interno con prefisso <code>PE_</code>.
                              Questo vale anche come protocollo di emergenza quando l&apos;API esterna non è disponibile.
                            </p>
                          )}
                        </div>
                      )}

                      {/* ── Protocollo: step intermedi (comportamento corrente) ── */}
                      {isMiddle && (
                        <>
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

                          {stepData?.protocollo && (
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
                        </>
                      )}

                      {/* ── Allegati dal richiedente: primo e step intermedi ── */}
                      {(isFirst || isMiddle) && (
                        <>
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
                            <div className="ms-4 mb-3">
                              <Controller
                                control={control}
                                name={`steps.${index}.allegatiRichiestiList`}
                                render={({ field: { value, onChange } }) => (
                                  <AllegatiRichiestiEditor
                                    value={value ?? []}
                                    onChange={onChange}
                                    prefix={`step-${index}-allegato`}
                                  />
                                )}
                              />
                            </div>
                          )}
                        </>
                      )}

                      {/* ── Allegati operatore: ultimo e step intermedi ── */}
                      {(isLast || isMiddle) && (
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
                      )}

                      {/* ── Pagamento: solo step intermedi ── */}
                      {isMiddle && (
                        <>
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
                                <label className="form-check-label" htmlFor={`step-${index}-pagamento-obbligatorio`}>
                                  Pagamento obbligatorio per avanzare al passo successivo
                                </label>
                              </div>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  );
                })}
              </CardBody>
            </Card>
          )}


        </div>

        <div className="col-lg-3">
          <Card className="sticky-top" style={{ top: '1rem' }}>
            <CardBody>
              <h5 className="mb-4">Azioni</h5>

              <div className="d-grid gap-2">
                <Button type="submit" variant="primary" loading={loading} disabled={deleteLoading}>
                  {isNew ? 'Crea Servizio' : 'Salva Modifiche'}
                </Button>

                <Button
                  type="button"
                  variant="outline-secondary"
                  onClick={() => router.push('/amministrazione/servizi')}
                  disabled={loading || deleteLoading}
                >
                  Annulla
                </Button>

                {!isNew && servizio && (
                  <>
                    <hr />
                    <Button
                      type="button"
                      variant="outline-danger"
                      onClick={handleDelete}
                      loading={deleteLoading}
                      disabled={loading}
                    >
                      Elimina Servizio
                    </Button>
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
