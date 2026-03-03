'use client';

import { useState, useTransition } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Card, CardBody, Button, Input, Textarea, Select, Alert } from '@/components/ui';
import { createServizio, updateServizio, deleteServizio } from './actions';
import { servizioSchema, type ServizioFormData } from '@/lib/validations/servizio';
import Link from 'next/link';

interface Area {
  id: number;
  titolo: string;
}

interface ModuloRef {
  id: number;
  name: string;
  tipo: string;
}

interface UfficioRef {
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
  moduloId: number | null;
  ufficioId: number | null;
  dataInizio: string;
  dataFine: string;
  unicoInvio: boolean;
  unicoInvioPerUtente: boolean;
  campiUnicoInvio: string;
  numeroMaxIstanze: number | null;
  avvisoSoglia: number | null;
  msgExtraServizio: string;
  campiInEvidenza: string;
  campiDaEsportare: string;
  prevedeDocumentoFinale: boolean;
  templateDocumentoFinale: string;
  nomeDocumentoFinale: string;
  steps: StepData[];
}

interface ServizioFormProps {
  servizio?: ServizioData;
  aree: Area[];
  moduli: ModuloRef[];
  uffici: UfficioRef[];
  isNew?: boolean;
}

export function ServizioForm({ servizio, aree, moduli, uffici, isNew }: ServizioFormProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [activeTab, setActiveTab] = useState<'informazioni' | 'configurazione' | 'workflow' | 'avanzate'>('informazioni');

  const {
    register,
    control,
    handleSubmit,
    watch,
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
      moduloId: null,
      ufficioId: null,
      dataInizio: '',
      dataFine: '',
      unicoInvio: false,
      unicoInvioPerUtente: false,
      campiUnicoInvio: '',
      numeroMaxIstanze: null,
      avvisoSoglia: null,
      msgExtraServizio: '',
      campiInEvidenza: '',
      campiDaEsportare: '',
      prevedeDocumentoFinale: false,
      templateDocumentoFinale: '',
      nomeDocumentoFinale: '',
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
      unitaOrganizzativa: '',
    });
  };

  const moveStep = (index: number, direction: 'up' | 'down') => {
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex >= 0 && newIndex < fields.length) {
      move(index, newIndex);
    }
  };

  const onSubmit = (data: ServizioFormData) => {
    setError(null);
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

  const prevedeDoc = watch('prevedeDocumentoFinale');

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
                className={`nav-link ${activeTab === 'informazioni' ? 'active' : ''}`}
                onClick={() => setActiveTab('informazioni')}
              >
                Informazioni
              </button>
            </li>
            <li className="nav-item">
              <button
                type="button"
                className={`nav-link ${activeTab === 'configurazione' ? 'active' : ''}`}
                onClick={() => setActiveTab('configurazione')}
              >
                Configurazione
              </button>
            </li>
            <li className="nav-item">
              <button
                type="button"
                className={`nav-link ${activeTab === 'workflow' ? 'active' : ''}`}
                onClick={() => setActiveTab('workflow')}
              >
                Workflow ({fields.length})
              </button>
            </li>
            <li className="nav-item">
              <button
                type="button"
                className={`nav-link ${activeTab === 'avanzate' ? 'active' : ''}`}
                onClick={() => setActiveTab('avanzate')}
              >
                Avanzate
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
                      label="Titolo *"
                      {...register('titolo')}
                      error={errors.titolo?.message}
                    />
                  </div>
                  <div className="col-md-4 mb-3">
                    <Input label="Slug (URL)" {...register('slug')} />
                  </div>
                </div>

                <div className="mb-3">
                  <Input label="Sotto Titolo" {...register('sottoTitolo')} />
                </div>

                <div className="mb-3">
                  <Textarea label="Descrizione" {...register('descrizione')} rows={3} />
                </div>

                <div className="mb-3">
                  <Textarea label="Come fare" {...register('comeFare')} rows={3} />
                </div>

                <div className="mb-3">
                  <Textarea label="Cosa serve" {...register('cosaServe')} rows={3} />
                </div>

                <div className="mb-3">
                  <Textarea label="Altre informazioni" {...register('altreInfo')} rows={2} />
                </div>

                <div className="mb-3">
                  <Input label="Contatti" {...register('contatti')} />
                </div>

                <div className="row">
                  <div className="col-md-6 mb-3">
                    <Input label="Icona (classe CSS o URL)" {...register('icona')} />
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
                  <h5 className="mb-4">Modulo e Ufficio</h5>

                  <div className="row">
                    <div className="col-md-8 mb-3">
                      <Select
                        label="Modulo (template form)"
                        {...register('moduloId', {
                          setValueAs: (v) => (v === '' ? null : parseInt(v, 10)),
                        })}
                      >
                        <option value="">Nessun modulo</option>
                        {moduli.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.name} [{m.tipo}]
                          </option>
                        ))}
                      </Select>
                      <small className="text-muted">
                        Il form che l&apos;utente compila per inviare l&apos;istanza
                      </small>
                    </div>
                    <div className="col-md-4 mb-3">
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
                      <Input label="Messaggio Extra" {...register('msgExtraServizio')} />
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

                  {prevedeDoc && (
                    <>
                      <div className="mb-3">
                        <Input
                          label="Nome documento finale"
                          {...register('nomeDocumentoFinale')}
                        />
                      </div>
                      <div className="mb-3">
                        <Textarea
                          label="Template documento finale (HTML)"
                          {...register('templateDocumentoFinale')}
                          rows={6}
                        />
                      </div>
                    </>
                  )}
                </CardBody>
              </Card>
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
                  <p className="text-muted text-center py-3">
                    Nessuno step definito. Aggiungi almeno uno step per gestire il workflow.
                  </p>
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

          {/* Tab: Avanzate */}
          {activeTab === 'avanzate' && (
            <Card className="mb-4">
              <CardBody>
                <h5 className="mb-4">Impostazioni Avanzate</h5>
                <p className="text-muted">
                  Le impostazioni avanzate si trovano nella scheda <strong>Configurazione</strong>.
                </p>
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
