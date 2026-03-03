'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { Card, CardBody, Badge, Button, Input, Select } from '@/components/ui';
import { THeadGroup, THead, Paginatore, TFilterHead, TFilterHeadGroup } from '@/components/shared';
import { Order, Filter } from '@/lib/models/table';

interface Istanza {
  id: number;
  protoNumero: string | null;
  dataInvio: Date;
  conclusa: boolean;
  respinta: boolean;
  datiInEvidenza: string | null;
  utente: {
    nome: string;
    cognome: string;
    codiceFiscale: string;
    email: string | null;
  };
  servizio: {
    titolo: string;
    campiInEvidenza: string | null;
  };
  workflows: {
    step: { descrizione: string; ordine: number } | null;
    status: { stato: string } | null;
    operatore: { id: number; nome: string; cognome: string } | null;
  }[];
}

interface Servizio {
  id: number;
  titolo: string;
  campiInEvidenza: string | null;
}

interface Counts {
  nuove: number;
  inLavorazionePropria: number;
  inLavorazioneAltri: number;
  respinte: number;
  concluse: number;
  totale: number;
}

interface FormFilters {
  protocollo: string;
  codiceFiscale: string;
  modulo: string;
  anno: string;
  cerca: string;
}

interface SearchState {
  tab: string;
  page: number;
  pageSize: number;
  sort: { field: string; direction: number };
  formFilters: FormFilters;
  columnFilters: Filter[];
}

const DEFAULT_FORM_FILTERS: FormFilters = {
  protocollo: '',
  codiceFiscale: '',
  modulo: '',
  anno: '',
  cerca: '',
};

const DEFAULT_SEARCH_STATE: SearchState = {
  tab: 'nuove',
  page: 1,
  pageSize: 20,
  sort: { field: 'dataInvio', direction: -1 },
  formFilters: DEFAULT_FORM_FILTERS,
  columnFilters: [],
};

const DEFAULT_COUNTS: Counts = {
  nuove: 0,
  inLavorazionePropria: 0,
  inLavorazioneAltri: 0,
  respinte: 0,
  concluse: 0,
  totale: 0,
};

const SESSION_KEY = 'istanze-search-state';

const PRIMO_ANNO = 2020;
const anni = Array.from(
  { length: new Date().getFullYear() - PRIMO_ANNO + 1 },
  (_, i) => PRIMO_ANNO + i
).reverse();

interface IstanzeClientProps {
  servizi: Servizio[];
  operatoreId: number;
}

export function IstanzeClient({ servizi, operatoreId }: IstanzeClientProps) {
  const [searchState, setSearchState] = useState<SearchState>(() => {
    if (typeof window === 'undefined') return DEFAULT_SEARCH_STATE;
    try {
      const saved = sessionStorage.getItem(SESSION_KEY);
      if (saved) return JSON.parse(saved) as SearchState;
    } catch {}
    return DEFAULT_SEARCH_STATE;
  });

  // Draft form filters — updated on every keystroke, applied only on form submit
  const [draftFilters, setDraftFilters] = useState<FormFilters>(searchState.formFilters);

  const [data, setData] = useState<Istanza[]>([]);
  const [total, setTotal] = useState(0);
  const [counts, setCounts] = useState<Counts>(DEFAULT_COUNTS);
  const [loading, setLoading] = useState(false);

  // Incrementing key forces TFilterHeadGroup to re-mount and clear column filter inputs on reset
  const [filterResetKey, setFilterResetKey] = useState(0);

  const abortRef = useRef<AbortController | null>(null);

  const fetchData = useCallback(async (state: SearchState) => {
    if (abortRef.current) abortRef.current.abort();
    abortRef.current = new AbortController();

    setLoading(true);
    try {
      const res = await fetch('/api/istanze/paged', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(state),
        signal: abortRef.current.signal,
      });
      if (!res.ok) throw new Error('Errore nella risposta');
      const json = await res.json();
      setData(json.data);
      setTotal(json.total);
      setCounts(json.counts);
    } catch (err: unknown) {
      if ((err as Error).name !== 'AbortError') {
        toast.error('Errore nel caricamento delle istanze');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    try {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(searchState));
    } catch {}
    fetchData(searchState);
  }, [searchState, fetchData]);

  const tabs = [
    { id: 'nuove', label: 'Nuove', count: counts.nuove, variant: 'primary' },
    { id: 'mie', label: 'In Lavorazione (Mie)', count: counts.inLavorazionePropria, variant: 'warning' },
    { id: 'altri', label: 'In Lavorazione (Altri)', count: counts.inLavorazioneAltri, variant: 'info' },
    { id: 'respinte', label: 'Respinte', count: counts.respinte, variant: 'danger' },
    { id: 'concluse', label: 'Concluse', count: counts.concluse, variant: 'success' },
    { id: 'tutte', label: 'Tutte', count: counts.totale, variant: 'secondary' },
  ];

  const handleTabChange = (tabId: string) => {
    setSearchState((prev) => ({ ...prev, tab: tabId, page: 1 }));
  };

  const handleSort = (order: Order) => {
    setSearchState((prev) => ({
      ...prev,
      sort: { field: order.field, direction: order.direction },
      page: 1,
    }));
  };

  const handleColumnFilter = (newFilters: Filter[]) => {
    setSearchState((prev) => ({ ...prev, columnFilters: newFilters, page: 1 }));
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearchState((prev) => ({ ...prev, formFilters: draftFilters, page: 1 }));
  };

  const handleReset = () => {
    try {
      sessionStorage.removeItem(SESSION_KEY);
    } catch {}
    setSearchState(DEFAULT_SEARCH_STATE);
    setDraftFilters(DEFAULT_FORM_FILTERS);
    setFilterResetKey((k) => k + 1);
  };

  const handlePageChange = (newPage: number) => {
    setSearchState((prev) => ({ ...prev, page: newPage }));
  };

  const getStatusBadge = (istanza: Istanza) => {
    if (istanza.conclusa) return <Badge variant="success">Conclusa</Badge>;
    if (istanza.respinta) return <Badge variant="danger">Respinta</Badge>;
    const lastWorkflow = istanza.workflows[0];
    if (lastWorkflow?.step) {
      return <Badge variant="warning">{lastWorkflow.step.descrizione}</Badge>;
    }
    return <Badge variant="secondary">In Attesa</Badge>;
  };

  const totalPages = Math.ceil(total / searchState.pageSize) || 1;

  return (
    <>
      {/* Tabs */}
      <ul className="nav nav-tabs mb-4">
        {tabs.map((tab) => (
          <li key={tab.id} className="nav-item">
            <button
              type="button"
              className={`nav-link ${searchState.tab === tab.id ? 'active' : ''}`}
              onClick={() => handleTabChange(tab.id)}
            >
              {tab.label}{' '}
              <Badge variant={searchState.tab === tab.id ? (tab.variant as 'primary' | 'secondary' | 'success' | 'danger' | 'warning' | 'info') : 'secondary'}>
                {tab.count}
              </Badge>
            </button>
          </li>
        ))}
      </ul>

      {/* Search & Filters */}
      <Card className="mb-4">
        <CardBody>
          <form onSubmit={handleSearch}>
            <div className="row g-3">
              <div className="col-md-3">
                <Input
                  label="Numero Protocollo"
                  value={draftFilters.protocollo}
                  onChange={(e) => setDraftFilters({ ...draftFilters, protocollo: e.target.value })}
                  placeholder="2024/00001"
                />
              </div>
              <div className="col-md-3">
                <Input
                  label="Codice Fiscale"
                  value={draftFilters.codiceFiscale}
                  onChange={(e) =>
                    setDraftFilters({ ...draftFilters, codiceFiscale: e.target.value.toUpperCase() })
                  }
                  placeholder="RSSMRA80A01..."
                  maxLength={16}
                />
              </div>
              <div className="col-md-3">
                <Select
                  label="Servizio"
                  value={draftFilters.modulo}
                  onChange={(e) => setDraftFilters({ ...draftFilters, modulo: e.target.value })}
                >
                  <option value="">Tutti i servizi</option>
                  {servizi.map((servizio) => (
                    <option key={servizio.id} value={servizio.id}>
                      {servizio.titolo}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="col-md-1">
                <Select
                  label="Anno"
                  value={draftFilters.anno}
                  onChange={(e) => setDraftFilters({ ...draftFilters, anno: e.target.value })}
                >
                  <option value="">Tutti</option>
                  {anni.map((a) => (
                    <option key={a} value={a}>
                      {a}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="col-md-2">
                <Input
                  label="Cerca"
                  value={draftFilters.cerca}
                  onChange={(e) => setDraftFilters({ ...draftFilters, cerca: e.target.value })}
                  placeholder="Nome, cognome, dati..."
                />
              </div>
            </div>
            <div className="mt-3 d-flex gap-2">
              <Button type="submit" variant="primary" loading={loading}>
                Cerca
              </Button>
              <Button type="button" variant="outline-secondary" onClick={handleReset}>
                Reset
              </Button>
            </div>
          </form>
        </CardBody>
      </Card>

      {/* Results */}
      <Card>
        <CardBody>
          <div className="d-flex justify-content-between align-items-center mb-3">
            <h5 className="mb-0">
              {total} {total === 1 ? 'istanza' : 'istanze'}
            </h5>
            {loading && (
              <div className="spinner-border spinner-border-sm text-primary" role="status">
                <span className="visually-hidden">Caricamento...</span>
              </div>
            )}
          </div>

          {!loading && data.length === 0 ? (
            <div className="text-center py-5 text-muted">
              <p className="mb-0">Nessuna istanza trovata</p>
            </div>
          ) : (
            <>
              <div className="table-responsive">
                <table className="table table-bordered table-striped table-hover">
                  <THeadGroup
                    onChange={handleSort}
                    initialField={searchState.sort.field}
                    initialDirection={searchState.sort.direction}
                  >
                    <THead field="protoNumero" width="12%">Protocollo</THead>
                    <THead field="cognome" width="18%">Utente</THead>
                    <THead field="modulo" width="12%">Modulo</THead>
                    <THead field="dataInvio" width="9%">Data Invio</THead>
                    <THead field="" width="10%">Stato</THead>
                    <THead field="operatore" width="14%">Operatore</THead>
                    <THead field="" width="15%">Dati in Evidenza</THead>
                    <THead field="" width="5%">&nbsp;</THead>
                  </THeadGroup>
                  <TFilterHeadGroup key={filterResetKey} onFilter={handleColumnFilter}>
                    <TFilterHead field="protoNumero" placeholder="Cerca protocollo" />
                    <TFilterHead field="cognome" placeholder="Cerca utente" />
                    <TFilterHead />
                    <TFilterHead field="dataInvio" placeholder="Cerca per data" />
                    <TFilterHead />
                    <TFilterHead field="operatore" placeholder="Cerca operatore" />
                    <TFilterHead field="datiInEvidenza" />
                    <TFilterHead />
                  </TFilterHeadGroup>
                  <tbody>
                    {data.map((istanza) => {
                      const lastWorkflow = istanza.workflows[0];
                      return (
                        <tr key={istanza.id}>
                          <td>
                            {istanza.protoNumero || <span className="text-muted">-</span>}
                          </td>
                          <td>
                            <div>
                              {istanza.utente.cognome} {istanza.utente.nome}
                            </div>
                            <small className="text-muted">{istanza.utente.codiceFiscale}</small>
                          </td>
                          <td>
                            <small>{istanza.servizio.titolo}</small>
                          </td>
                          <td>{new Date(istanza.dataInvio).toLocaleDateString('it-IT')}</td>
                          <td>{getStatusBadge(istanza)}</td>
                          <td>
                            {lastWorkflow?.operatore ? (
                              <small>
                                {lastWorkflow.operatore.cognome} {lastWorkflow.operatore.nome}
                                {lastWorkflow.operatore.id === operatoreId && (
                                  <Badge variant="info" className="ms-1">Tu</Badge>
                                )}
                              </small>
                            ) : (
                              <span className="text-muted">-</span>
                            )}
                          </td>
                          <td>
                            <small className="text-muted">{istanza.datiInEvidenza || '-'}</small>
                          </td>
                          <td>
                            <Link
                              href={`/istanze/${istanza.id}`}
                              className="btn btn-sm btn-outline-primary"
                            >
                              Gestisci
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {totalPages > 1 && (
                <nav className="mt-4 d-flex justify-content-center">
                  <Paginatore
                    page={searchState.page}
                    pages={totalPages}
                    onChange={handlePageChange}
                  />
                </nav>
              )}
            </>
          )}
        </CardBody>
      </Card>
    </>
  );
}
