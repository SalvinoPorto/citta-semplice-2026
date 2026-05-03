'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
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
    step: { descrizione: string; ordine: number };
    stato: number;
    operatoreId: number | null;
    operatore: { id: number; nome: string; cognome: string } | null;
  }[];
  faseCorrente: {
    id: number;
    nome: string;
    ufficio: { id: number; nome: string } | null;
  } | null;
  ufficioCorrente: { id: number; nome: string } | null;
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
  modulo: string;
  anno: string;
  cerca: string;
  ufficioId: string;
}

const DEFAULT_FORM_FILTERS: FormFilters = {
  protocollo: '',
  modulo: '',
  anno: '',
  cerca: '',
  ufficioId: '',
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
  uffici: Array<{ id: number; nome: string }>;
}

export function IstanzeClient({ servizi, uffici }: IstanzeClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const initialTab = searchParams.get('tab') || 'nuove';
  const initialSort: Order = {
    field: searchParams.get('sf') || 'dataInvio',
    direction: parseInt(searchParams.get('sd') || '-1'),
  };
  const initialFormFilters: FormFilters = {
    protocollo: searchParams.get('protocollo') || '',
    modulo: searchParams.get('modulo') || '',
    anno: searchParams.get('anno') || '',
    cerca: searchParams.get('cerca') || '',
    ufficioId: searchParams.get('ufficioId') || '',
  };

  const [tab, setTab] = useState(initialTab);
  const [page, setPage] = useState(() => parseInt(searchParams.get('page') || '1'));
  const [sort, setSort] = useState<Order>(initialSort);
  const [columnFilters, setColumnFilters] = useState<Filter[]>([]);
  const [formFilters, setFormFilters] = useState<FormFilters>(initialFormFilters);
  const [draftFilters, setDraftFilters] = useState<FormFilters>(initialFormFilters);

  const [istanze, setIstanze] = useState<Istanza[]>([]);
  const [total, setTotal] = useState(0);
  const [counts, setCounts] = useState<Counts>(DEFAULT_COUNTS);
  const [loading, setLoading] = useState(false);
  const [filterResetKey, setFilterResetKey] = useState(0);

  // Inizializzato con lo stato iniziale così al primo mount non resetta la pagina a 1
  const prevFiltersRef = useRef<string>(
    JSON.stringify([]) + JSON.stringify(initialFormFilters) + initialSort.field + initialSort.direction + initialTab
  );
  const isMounted = useRef(false);

  // Sync active filters to URL so they survive navigation to detail and back
  useEffect(() => {
    if (!isMounted.current) {
      isMounted.current = true;
      return;
    }
    const params = new URLSearchParams();
    if (tab !== 'nuove') params.set('tab', tab);
    if (page !== 1) params.set('page', String(page));
    if (sort.field !== 'dataInvio') params.set('sf', sort.field);
    if (sort.direction !== -1) params.set('sd', String(sort.direction));
    if (formFilters.protocollo) params.set('protocollo', formFilters.protocollo);
    if (formFilters.modulo) params.set('modulo', formFilters.modulo);
    if (formFilters.anno) params.set('anno', formFilters.anno);
    if (formFilters.cerca) params.set('cerca', formFilters.cerca);
    if (formFilters.ufficioId) params.set('ufficioId', formFilters.ufficioId);
    const qs = params.toString();
    router.replace(qs ? `/istanze?${qs}` : '/istanze', { scroll: false });
  }, [tab, page, sort, formFilters]); // eslint-disable-line react-hooks/exhaustive-deps

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


  const getFaseBadge = (istanza: Istanza) => {
    if (istanza.conclusa) return <Badge variant="success" className="w-100">Conclusa</Badge>;
    if (istanza.respinta) return <Badge variant="danger" className="w-100">Respinta</Badge>;
    const lastWorkflow = istanza.workflows[0];
    return <Badge variant="primary" className="w-100">{lastWorkflow?.step.descrizione}</Badge>;
  }

  const getStatusBadge = (istanza: Istanza) => {
    const lastWorkflow = istanza.workflows[0];
    if (lastWorkflow?.operatoreId === null) {
      return <Badge variant="secondary" className="w-100">In Attesa</Badge>;
    }
    if (lastWorkflow?.stato === 1) {
      return <Badge variant="success" className="w-100">Completata</Badge>;
    }
    return <Badge variant="primary" className="w-100">In Lavorazione</Badge>;
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
              <span className="me-2">{t.label}</span>
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
              <div className="col-md-2">
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
              <div className="col-md-3">
                <Input
                  type="text"
                  label="Numero Protocollo"
                  value={draftFilters.protocollo}
                  onChange={(e) => setDraftFilters({ ...draftFilters, protocollo: e.target.value })}
                  placeholder="es. 00001"
                />
              </div>
            </div>
            <div className="row g-3">
              <div className="col-md-4">
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
              <div className="col-md-4">
                <Select
                  label="Ufficio corrente"
                  value={draftFilters.ufficioId}
                  onChange={(e) => setDraftFilters({ ...draftFilters, ufficioId: e.target.value })}
                >
                  <option value="">Tutti gli uffici</option>
                  {uffici.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.nome}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="col-md-4">
                <Input
                  type="text"
                  label="Cerca per valori chiave"
                  value={draftFilters.cerca}
                  onChange={(e) => setDraftFilters({ ...draftFilters, cerca: e.target.value })}
                  placeholder="Nome, Cognome, dati..."
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
                    <THead field="dataInvio" width="10%">Data Invio</THead>
                    <THead field="cognome" width="18%">Utente</THead>
                    <THead field="servizio" width="20%">Servizio</THead>
                    <THead field="datiInEvidenza" width="15%">Dati in Evidenza</THead>
                    <THead field="" width="13%">Fase / Ufficio</THead>
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
                        <td>
                          <div>{getFaseBadge(istanza)}</div>
                          {istanza.faseCorrente?.ufficio && (
                            <small className="text-muted">{istanza.faseCorrente.ufficio.nome}</small>
                          )}
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
