'use client';

import { useMemo, useState, useTransition } from 'react';
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

interface Ufficio {
  id: number;
  nome: string;
}

export interface ServizioOption {
  id: number;
  titolo: string;
  areaNome: string | null;
  /** uffici che lavorano il servizio (fasi + ufficio del servizio) */
  ufficioIds: number[];
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
  ufficioId?: number | null;
  servizioIds?: number[];
}

interface OperatoreFormProps {
  operatore?: OperatoreData;
  ruoli: Ruolo[];
  uffici: Ufficio[];
  servizi: ServizioOption[];
  isNew?: boolean;
}

export function OperatoreForm({ operatore, ruoli, uffici, servizi, isNew }: OperatoreFormProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [cercaServizio, setCercaServizio] = useState('');
  const [soloUfficio, setSoloUfficio] = useState(true);

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
      ufficioId: null,
      servizioIds: [],
    },
  });

  const selectedRuoli = watch('ruoliIds') || [];
  const selectedServizi = watch('servizioIds') || [];
  const ufficioSelezionato = watch('ufficioId') ?? null;

  const toggleRuolo = (id: number) => {
    const current = watch('ruoliIds') || [];
    if (current.includes(id)) {
      setValue('ruoliIds', current.filter((v) => v !== id));
    } else {
      setValue('ruoliIds', [...current, id]);
    }
  };

  const toggleServizio = (id: number) => {
    const current = watch('servizioIds') || [];
    setValue(
      'servizioIds',
      current.includes(id) ? current.filter((v) => v !== id) : [...current, id]
    );
  };

  // Servizi mostrati: filtrati per ufficio dell'operatore (opzionale) e per testo.
  // I servizi già selezionati restano sempre visibili, anche fuori filtro.
  const serviziVisibili = useMemo(() => {
    const q = cercaServizio.trim().toLowerCase();
    return servizi.filter((s) => {
      if (selectedServizi.includes(s.id)) return true;
      if (soloUfficio && ufficioSelezionato !== null && !s.ufficioIds.includes(ufficioSelezionato)) {
        return false;
      }
      if (q && !s.titolo.toLowerCase().includes(q) && !(s.areaNome ?? '').toLowerCase().includes(q)) {
        return false;
      }
      return true;
    });
  }, [servizi, selectedServizi, soloUfficio, ufficioSelezionato, cercaServizio]);

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
      } catch(e) {
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
                <div className="col-md-6 mb-3">
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
              <h5 className="mb-4">Ufficio di Appartenenza</h5>
              <select
                className="form-select"
                {...register('ufficioId', { setValueAs: (v) => v === '' ? null : parseInt(v, 10) })}
              >
                <option value="">— Nessun ufficio —</option>
                {uffici.map((u) => (
                  <option key={u.id} value={u.id}>{u.nome}</option>
                ))}
              </select>
              <div className="form-text">
                L&apos;operatore vedrà le istanze assegnate all&apos;ufficio selezionato.
              </div>
            </CardBody>
          </Card>

          <Card className="mb-4">
            <CardBody>
              <div className="d-flex justify-content-between align-items-start mb-3">
                <div>
                  <h5 className="mb-1">Servizi visibili</h5>
                  <div className="form-text mt-0">
                    Nessun servizio selezionato = <strong>tutti</strong> i servizi dell&apos;ufficio.
                    Selezionandone uno o più, l&apos;operatore vedrà solo le istanze di quei servizi.
                  </div>
                </div>
                <span className="badge bg-primary align-self-center">
                  {selectedServizi.length === 0 ? 'Tutti' : `${selectedServizi.length} selezionati`}
                </span>
              </div>

              <div className="d-flex flex-wrap gap-3 align-items-center mb-3">
                <input
                  type="search"
                  className="form-control"
                  style={{ maxWidth: '20rem' }}
                  placeholder="Cerca servizio..."
                  value={cercaServizio}
                  onChange={(e) => setCercaServizio(e.target.value)}
                />
                {ufficioSelezionato !== null && (
                  <div className="form-check mb-0">
                    <input
                      type="checkbox"
                      className="form-check-input"
                      id="solo-ufficio"
                      checked={soloUfficio}
                      onChange={(e) => setSoloUfficio(e.target.checked)}
                    />
                    <label className="form-check-label" htmlFor="solo-ufficio">
                      Solo servizi dell&apos;ufficio selezionato
                    </label>
                  </div>
                )}
                {selectedServizi.length > 0 && (
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-secondary"
                    onClick={() => setValue('servizioIds', [])}
                  >
                    Deseleziona tutti
                  </button>
                )}
              </div>

              <div style={{ maxHeight: '18rem', overflowY: 'auto' }}>
                {serviziVisibili.length === 0 ? (
                  <p className="text-muted mb-0">Nessun servizio trovato</p>
                ) : (
                  serviziVisibili.map((s) => (
                    <div key={s.id} className="form-check">
                      <input
                        type="checkbox"
                        className="form-check-input"
                        id={`servizio-${s.id}`}
                        checked={selectedServizi.includes(s.id)}
                        onChange={() => toggleServizio(s.id)}
                      />
                      <label className="form-check-label" htmlFor={`servizio-${s.id}`}>
                        {s.titolo}
                        {s.areaNome && <span className="small text-muted"> · {s.areaNome}</span>}
                      </label>
                    </div>
                  ))
                )}
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
                        onChange={() => toggleRuolo(ruolo.id)}
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
        </div>

        <div className="col-lg-4">
          <Card className="sticky-top" style={{ top: '1rem' }}>
            <CardBody>
              <h5 className="mb-4">Azioni</h5>

              <div className="d-grid gap-2">
                <Button type="submit" variant="primary" loading={isPending}>
                  {isNew ? 'Crea Operatore' : 'Salva Modifiche'}
                </Button>

                <Link href="/amministrazione/operatori" className="btn btn-outline-secondary">
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
