'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { THeadGroup, THead, TFilterHeadGroup, TFilterHead, Paginatore } from '@/components/shared';
import type { Filter, Order } from '@/lib/models/table';
import { getIstanzePage, type IstanzaRow, type IstanzePageResult } from '@/lib/actions/le-mie-istanze';

type Props = { utenteId: number };

/* function getStatoBadge(row: IstanzaRow) {
  if (row.conclusa) return { label: 'Conclusa', cls: 'bg-success' };
  if (row.respinta) return { label: 'Respinta', cls: 'bg-danger' };
  return { label: 'In lavorazione', cls: 'bg-primary' };
} */

function getStatoBadge(row: IstanzaRow) {
  if (row.conclusa) return { label: 'Conclusa', cls: 'bg-success' };
  if (row.respinta) return { label: 'Respinta', cls: 'bg-danger' };
  if (row.stato === -1) return { label: 'In attesa', cls: 'bg-secondary' };
  if (row.stato === 0) return { label: 'In lavorazione', cls: 'bg-primary' };
  return { label: 'Completata', cls: 'bg-success' };
}

export function IstanzeTable({ utenteId }: Props) {
  const [page, setPage] = useState(1);
  const [order, setOrder] = useState<Order>({ field: '', direction: 0 });
  const [filters, setFilters] = useState<Filter[]>([]);
  const [result, setResult] = useState<IstanzePageResult>({ data: [], total: 0, pages: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    getIstanzePage(utenteId, page, order, filters)
      .then(setResult)
      .finally(() => setLoading(false));
  }, [utenteId, page, order, filters]);

  const handleSort = useCallback((o: Order) => {
    setPage(1);
    setOrder(o);
  }, []);

  const handleFilter = useCallback((f: Filter[]) => {
    setPage(1);
    setFilters(f);
  }, []);

  if (!loading && result.total === 0 && filters.length === 0) {
    return (
      <div className="card p-5 text-center">
        <svg className="icon icon-xl text-muted mx-auto mb-3" aria-hidden="true">
          <use href="/bootstrap-italia/dist/svg/sprites.svg#it-inbox" />
        </svg>
        <h2 className="h5 text-muted">Nessuna istanza trovata</h2>
        <p className="text-muted mb-4">Non hai ancora inviato nessuna richiesta.</p>
        <Link href="/servizi" className="btn btn-primary mx-auto" style={{ width: 'fit-content' }}>
          Esplora i servizi
        </Link>
      </div>
    );
  }

  return (
    <>
      <div className="table-responsive" style={{ opacity: loading ? 0.6 : 1, transition: 'opacity 0.2s' }}>
        <table className="table table-hover">
          <THeadGroup onChange={handleSort} initialField="dataInvio" initialDirection={-1}>
            <THead field="servizio" width="40%">Servizio</THead>
            <THead field="dataInvio" width="10%">Data invio</THead>
            <THead field="protoNumero" width="10%">Protocollo</THead>
            <THead field="" width="25%">Fase attuale</THead>
            <THead field="" width="15%">Stato</THead>
          </THeadGroup>
          <TFilterHeadGroup onFilter={handleFilter}>
            <TFilterHead field="servizio" placeholder="Cerca servizio..." />
            <TFilterHead field="" />
            <TFilterHead field="protoNumero" placeholder="N° protocollo..." />
            <TFilterHead field="" />
            <TFilterHead field="" />
          </TFilterHeadGroup>
          <tbody>
            {result.data.length === 0 && !loading ? (
              <tr>
                <td colSpan={6} className="text-center text-muted py-4">
                  Nessun risultato trovato.
                </td>
              </tr>
            ) : (
              result.data.map((istanza) => {
                const stato = getStatoBadge(istanza);
                return (
                  <tr key={istanza.id}>
                    <td>
                      <Link href={`/le-mie-istanze/${istanza.id}`} className="text-decoration-none">
                        {istanza.servizioTitolo}
                      </Link>
                    </td>
                    <td>
                      {istanza.dataInvio
                        ? format(new Date(istanza.dataInvio), 'dd/MM/yyyy HH:mm', { locale: it })
                        : '—'}
                    </td>
                    <td>
                      {istanza.protoNumero ? (
                        <span>
                          {istanza.protoNumero}
                          {istanza.protoData && (
                            <small className="text-muted d-block">
                              {format(new Date(istanza.protoData), 'dd/MM/yyyy', { locale: it })}
                            </small>
                          )}
                        </span>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                    <td>
                      {istanza.faseAttuale ?? <span className="text-muted">—</span>}
                    </td>
                    <td>
                      <span className={`badge ${stato.cls}`}>{stato.label}</span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {result.pages > 1 && (
        <div className="mt-3 d-flex justify-content-between align-items-center">
          <small className="text-muted">
            {result.total} istanze totali
          </small>
          <Paginatore page={page} pages={result.pages} onChange={setPage} />
        </div>
      )}
    </>
  );
}
