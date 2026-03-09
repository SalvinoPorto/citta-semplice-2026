'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { Card, CardBody, Badge, Button, Input, Select } from '@/components/ui';
import { THeadGroup, THead, Paginatore, TFilterHead, TFilterHeadGroup } from '@/components/shared';
import type { Order, Filter } from '@/lib/models/table';

const PAGE_SIZE = 10;
const PRIMO_ANNO = 2020;
const anni = Array.from(
  { length: new Date().getFullYear() - PRIMO_ANNO + 1 },
  (_, i) => PRIMO_ANNO + i
).reverse();

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

const DEFAULT_FORM_FILTERS: FormFilters = {
  protocollo: '',
  codiceFiscale: '',
  modulo: '',
  anno: '',
  cerca: '',
};

const DEFAULT_COUNTS: Counts = {
  nuove: 0,
  inLavorazionePropria: 0,
  inLavorazioneAltri: 0,
  respinte: 0,
  concluse: 0,
  totale: 0,
};

interface IstanzeClientProps {
  servizi: Servizio[];
  operatoreId: number;
}

export function IstanzeClient({ servizi, operatoreId }: IstanzeClientProps) {
  const [tab, setTab] = useState('nuove');
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<Order>({ field: 'dataInvio', direction: -1 });
  const [columnFilters, setColumnFilters] = useState<Filter[]>([]);
  const [formFilters, setFormFilters] = useState<FormFilters>(DEFAULT_FORM_FILTERS);
  const [draftFilters, setDraftFilters] = useState<FormFilters>(DEFAULT_FORM_FILTERS);

  const [istanze, setIstanze] = useState<Istanza[]>([]);
  const [total, setTotal] = useState(0);
  const [counts, setCounts] = useState<Counts>(DEFAULT_COUNTS);
  const [loading, setLoading] = useState(false);
  const [filterResetKey, setFilterResetKey] = useState(0);

  const prevFiltersRef = useRef<string>('');

  useEffect(() => {
    const filtersKey =
      JSON.stringify(columnFilters) + JSON.stringify(formFilters) + sort.field + sort.direction + tab;

    if (filtersKey !== prevFiltersRef.current) {
      prevFiltersRef.current = filtersKey;
      if (page !== 1) {
        setPage(1);
        return;
      }
    }

    setLoading(true);
    fetch('/api/istanze/paged', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tab, page, pageSize: PAGE_SIZE, sort, formFilters, columnFilters }),
    })
      .then((r) => {
        if (!r.ok) throw new Error('Errore HTTP: ' + r.status);
        return r.json();
      })
      .then((json) => {
        setIstanze(json.data);
        setTotal(json.total);
        setCounts(json.counts);
      })
      .catch(() => toast.error('Errore nel caricamento delle istanze'))
      .finally(() => setLoading(false));
  }, [tab, page, sort, columnFilters, formFilters]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setFormFilters(draftFilters);
  };

  const handleReset = () => {
    setTab('nuove');
    setSort({ field: 'dataInvio', direction: -1 });
    setFormFilters(DEFAULT_FORM_FILTERS);
    setDraftFilters(DEFAULT_FORM_FILTERS);
    setColumnFilters([]);
    setFilterResetKey((k) => k + 1);
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

  const formatEvidenza = (evidenza: string | null) => {
    if (!evidenza) return '-';
    return evidenza.replace(/\|/g, '<br />');
  };

  const totalPages = Math.ceil(total / PAGE_SIZE) || 1;

  const tabs = [
    { id: 'nuove', label: 'Nuove', count: counts.nuove, variant: 'primary' },
    { id: 'mie', label: 'In Lavorazione (Mie)', count: counts.inLavorazionePropria, variant: 'warning' },
    { id: 'altri', label: 'In Lavorazione (Altri)', count: counts.inLavorazioneAltri, variant: 'info' },
    { id: 'respinte', label: 'Respinte', count: counts.respinte, variant: 'danger' },
    { id: 'concluse', label: 'Concluse', count: counts.concluse, variant: 'success' },
    { id: 'tutte', label: 'Tutte', count: counts.totale, variant: 'secondary' },
  ];

  return (
    <>
      {/* Tabs */}
      <ul className="nav nav-tabs mb-4">
        {tabs.map((t) => (
          <li key={t.id} className="nav-item">
            <button
              type="button"
              className={`nav-link ${tab === t.id ? 'active' : ''}`}
              onClick={() => setTab(t.id)}
            >
              {t.label}{' '}
              <Badge variant={tab === t.id ? (t.variant as 'primary' | 'secondary' | 'success' | 'danger' | 'warning' | 'info') : 'secondary'}>
                {t.count}
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
                  type="text"
                  label="Numero Protocollo"
                  value={draftFilters.protocollo}
                  onChange={(e) => setDraftFilters({ ...draftFilters, protocollo: e.target.value })}
                  placeholder="2024/00001"
                />
              </div>
              <div className="col-md-3">
                <Input
                  type="text"
                  label="Codice Fiscale"
                  value={draftFilters.codiceFiscale}
                  onChange={(e) => setDraftFilters({ ...draftFilters, codiceFiscale: e.target.value.toUpperCase() })}
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
                  type="text"
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

          {!loading && istanze.length === 0 ? (
            <div className="text-center py-5 text-muted">
              <p className="mb-0">Nessuna istanza trovata</p>
            </div>
          ) : (
            <>
              <div className="table-responsive">
                <table className="table table-bordered table-striped table-hover">
                  <THeadGroup
                    onChange={(o) => setSort(o)}
                    initialField={sort.field}
                    initialDirection={sort.direction}
                  >
                    <THead field="protoNumero" width="12%">Protocollo</THead>
                    <THead field="dataInvio" width="9%">Data Invio</THead>
                    <THead field="cognome" width="18%">Utente</THead>
                    <THead field="servizio" width="12%">Servizio</THead>
                    <THead field="datiInEvidenza" width="15%">Dati in Evidenza</THead>
                    <THead field="" width="10%">Stato</THead>
                    <THead field="" width="5%">&nbsp;</THead>
                  </THeadGroup>
                  <TFilterHeadGroup key={filterResetKey} onFilter={(f) => setColumnFilters(f)}>
                    <TFilterHead field="protoNumero" placeholder="Cerca protocollo" />
                    <TFilterHead field="dataInvio" placeholder="Cerca per data" />
                    <TFilterHead field="cognome" placeholder="Cerca utente" />
                    <TFilterHead field="servizio" placeholder="Cerca servizio" />
                    <TFilterHead field="datiInEvidenza" placeholder="Cerca per dato" />
                    <TFilterHead />
                    <TFilterHead />
                  </TFilterHeadGroup>
                  <tbody>
                    {istanze.map((istanza) => (
                      <tr key={istanza.id}>
                        <td>
                          {istanza.protoNumero || <span className="text-muted">-</span>}
                        </td>
                        <td>{new Date(istanza.dataInvio).toLocaleDateString('it-IT')}</td>
                        <td>
                          <div>
                            {istanza.utente.cognome} {istanza.utente.nome}
                          </div>
                          <small className="text-muted">{istanza.utente.codiceFiscale}</small>
                        </td>
                        <td>
                          <small>{istanza.servizio.titolo}</small>
                        </td>
                        <td>
                          <small
                            className="text-muted"
                            dangerouslySetInnerHTML={{ __html: formatEvidenza(istanza.datiInEvidenza) }}
                          />
                        </td>
                        <td>{getStatusBadge(istanza)}</td>
                        <td>
                          <Link href={`/istanze/${istanza.id}`} className="btn btn-sm btn-outline-primary">
                            Gestisci
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {totalPages > 1 && (
                <nav className="mt-4 d-flex justify-content-center">
                  <Paginatore page={page} pages={totalPages} onChange={(p) => setPage(p)} />
                </nav>
              )}
            </>
          )}
        </CardBody>
      </Card>
    </>
  );
}
