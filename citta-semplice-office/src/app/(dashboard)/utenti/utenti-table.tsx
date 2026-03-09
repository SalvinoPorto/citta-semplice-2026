'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Card, CardBody } from '@/components/ui';
import { THeadGroup, THead, TFilterHead, TFilterHeadGroup, Paginatore } from '@/components/shared';
import type { Order, Filter } from '@/lib/models/table';
import type { UtentiRequest } from '@/lib/models/requests';

const PAGE_SIZE = 10;

interface Utente {
  id: number;
  cognome: string;
  nome: string;
  codiceFiscale: string;
  email: string | null;
  telefono: string | null;
  citta: string | null;
  provincia: string | null;
  _count: { istanze: number };
}

export function UtentiTable() {
  const router = useRouter();
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';

  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(0);
  const [total, setTotal] = useState(0);
  const [filters, setFilters] = useState<Filter[]>([]);
  const [order, setOrder] = useState<Order>({ field: 'cognome', direction: 1 });
  const [utenti, setUtenti] = useState<Utente[]>([]);

  const prevFiltersRef = useRef<string>('');

  useEffect(() => {
    const filtersKey = JSON.stringify(filters) + order.field + order.direction;
    if (filtersKey !== prevFiltersRef.current) {
      prevFiltersRef.current = filtersKey;
      if (page !== 1) {
        setPage(1);
        return;
      }
    }

    fetch(`${basePath}/api/utenti/paged`, {
      method: 'POST',
      body: JSON.stringify({
        page,
        rows: PAGE_SIZE,
        filters,
        order,
      } as UtentiRequest),
      headers: { 'Content-Type': 'application/json' },
    })
      .then((r) => {
        if (r.status === 401) {
          router.push('/login');
          return null;
        }
        if (!r.ok) throw new Error('Errore HTTP: ' + r.status);
        return r.json();
      })
      .then((data) => {
        if (!data) return;
        setUtenti(data.content);
        setPages(data.totalPages);
        setTotal(data.total);
      })
      .catch(console.error);
  }, [page, filters, order, basePath, router]);

  return (
    <Card>
      <CardBody>
        <div className="table-responsive">
          <table className="table table-hover table-bordered">
            <THeadGroup onChange={setOrder}>
              <THead field="cognome">Cognome e Nome</THead>
              <THead field="cf" width="16%">Codice Fiscale</THead>
              <THead field="email">Email</THead>
              <THead field="" width="12%">Telefono</THead>
              <THead field="" width="10%">Città</THead>
              <THead field="istanze" width="8%">Istanze</THead>
              <THead field="" width="8%"></THead>
            </THeadGroup>
            <TFilterHeadGroup onFilter={setFilters}>
              <TFilterHead field="cognome" placeholder="Filtra cognome/nome" />
              <TFilterHead field="codiceFiscale" placeholder="Filtra CF" />
              <TFilterHead field="email" placeholder="Filtra email" />
              <TFilterHead />
              <TFilterHead />
              <TFilterHead />
              <TFilterHead />
            </TFilterHeadGroup>
            <tbody>
              {utenti.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-4 text-muted">
                    Nessun utente trovato
                  </td>
                </tr>
              ) : (
                utenti.map((utente) => (
                  <tr key={utente.id}>
                    <td>
                      <Link href={`/utenti/${utente.id}`} className="fw-bold">
                        {utente.cognome} {utente.nome}
                      </Link>
                    </td>
                    <td>
                      <code className="small">{utente.codiceFiscale}</code>
                    </td>
                    <td>{utente.email || <span className="text-muted">—</span>}</td>
                    <td>{utente.telefono || <span className="text-muted">—</span>}</td>
                    <td>
                      {utente.citta
                        ? `${utente.citta}${utente.provincia ? ` (${utente.provincia})` : ''}`
                        : <span className="text-muted">—</span>}
                    </td>
                    <td className="text-center">{utente._count.istanze}</td>
                    <td>
                      <Link
                        href={`/utenti/${utente.id}`}
                        className="btn btn-sm btn-outline-primary"
                      >
                        Modifica
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          <div className="d-flex justify-content-between align-items-center mt-2">
            <span className="text-muted small">
              {total} {total === 1 ? 'utente' : 'utenti'} totali
            </span>
            <nav>
              <Paginatore page={page} pages={pages} onChange={setPage} />
            </nav>
          </div>
        </div>
      </CardBody>
    </Card>
  );
}
