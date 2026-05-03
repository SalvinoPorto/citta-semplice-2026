'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Badge, Card, CardBody } from '@/components/ui';
import { THeadGroup, THead, TFilterHead, TFilterHeadGroup, Paginatore } from '@/components/shared';
import { CloneServizioButton } from './clone-button';
import type { Order, Filter } from '@/lib/models/table';
import { ServiziRequest } from '@/lib/models/requests';
import { useRouter } from 'next/navigation';
import { Area } from '../../../../../generated/prisma/client';
//import { Area } from '@prisma/client';

const PAGE_SIZE = 10;

interface Servizio {
  id: number;
  titolo: string;
  descrizione: string | null;
  attivo: boolean;
  area: { nome: string };
  _count: { steps: number };
}

interface Props {
  areaId: number;
  aree: Area[];
}

export function ServiziTable({ areaId, aree }: Props) {
  const router = useRouter();
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(0);
  const [filters, setFilters] = useState<Filter[]>([]);
  const [order, setOrder] = useState<Order>({ field: 'titolo', direction: 1 });
  const [servizi, setServizi] = useState<Servizio[]>([]);
  const [soloAttivi, setSoloAttivi] = useState(true);

  const prevFiltersRef = useRef<string>('');

  useEffect(() => {
    // Reset a pagina 1 quando cambiano i filtri o l'ordinamento
    const filtersKey = JSON.stringify(filters) + order.field + order.direction + soloAttivi;
    if (filtersKey !== prevFiltersRef.current) {
      prevFiltersRef.current = filtersKey;
      if (page !== 1) {
        setPage(1);
        return;
      }
    }

    fetch(`${basePath}/api/servizi/paged`, {
      method: 'POST',
      body: JSON.stringify({
        area: areaId || undefined,
        page,
        rows: PAGE_SIZE,
        filters,
        order,
        soloAttivi,
      } as ServiziRequest),
      headers: { 'Content-Type': 'application/json' },
    })
      .then((r) => {
        if (r.status === 401) {
          router.push(`/login`);
          return null;
        }
        if (!r.ok) throw new Error('Errore HTTP: ' + r.status);
        return r.json();
      })
      .then((data) => {
        if (!data) return;
        setServizi(data.content);
        setPages(data.totalPages);
      })
      .catch((err) => {
        console.error(err);
      });
  }, [areaId, page, filters, order, soloAttivi, basePath]);

  return (
    <>
      {/* Filter by Area */}
      <div className="mb-4">
        <div className="d-flex flex-wrap gap-2">
          <Link
            href="/amministrazione/servizi"
            className={`btn btn-sm ${!areaId ? 'btn-primary' : 'btn-outline-primary'}`}
          >
            Tutti
          </Link>
          {aree.map((area) => (
            <Link
              key={area.id}
              href={`/amministrazione/servizi?area=${area.id}`}
              className={`btn btn-sm ${areaId === area.id ? 'btn-primary' : 'btn-outline-primary'}`}
            >
              {area.nome}
            </Link>
          ))}
        </div>
      </div>

      <div className="mb-3 d-flex align-items-center gap-2">
        <div className="form-check form-switch mb-0">
          <input
            className="form-check-input"
            type="checkbox"
            role="switch"
            id="soloAttivi"
            checked={soloAttivi}
            onChange={(e) => setSoloAttivi(e.target.checked)}
          />
          <label className="form-check-label" htmlFor="soloAttivi">
            Solo servizi attivi
          </label>
        </div>
        {!soloAttivi && (
          <span className="badge bg-warning">Visualizzazione: tutti i servizi</span>
        )}
      </div>

      <Card>
        <CardBody>
          <div className="table-responsive">
            <table className="table table-hover table-bordered">
              <THeadGroup onChange={(e) => setOrder(e)}>
                <THead field="titolo">Titolo</THead>
                <THead field="area">Area</THead>
                <THead field="steps" width="8%">Steps</THead>
                <THead field="" width="10%">Stato</THead>
                <THead field="" width="12%"></THead>
              </THeadGroup>
              <TFilterHeadGroup onFilter={(e) => setFilters(e)}>
                <TFilterHead field="titolo" placeholder="Filtra titolo" />
                <TFilterHead field="area" placeholder="Filtra area" />
                <TFilterHead />
                <TFilterHead />
                <TFilterHead />
              </TFilterHeadGroup>
              <tbody>
                {servizi.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-4 text-muted">
                      Nessun servizio presente
                    </td>
                  </tr>
                ) : (
                  servizi.map((servizio) => (
                    <tr key={servizio.id}>
                      <td>
                        <Link href={`/amministrazione/servizi/${servizio.id}`} className="fw-bold">
                          {servizio.titolo}
                        </Link>
                        {servizio.descrizione && (
                          <div className="small text-muted">
                            {servizio.descrizione.substring(0, 60)}
                            {servizio.descrizione.length > 60 && '...'}
                          </div>
                        )}
                      </td>
                      <td>{servizio.area.nome}</td>
                      <td>{servizio._count.steps}</td>
                      <td>
                        {servizio.attivo ? (
                          <Badge variant="success">Attivo</Badge>
                        ) : (
                          <Badge variant="danger">Disattivo</Badge>
                        )}
                      </td>
                      <td>
                        <div className="d-flex gap-1">
                          <Link
                            href={`/amministrazione/servizi/${servizio.id}`}
                            className="btn btn-sm btn-outline-primary"
                          >
                            Modifica
                          </Link>
                          <CloneServizioButton id={servizio.id} titolo={servizio.titolo} />
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
            <nav>
              <Paginatore page={page} pages={pages} onChange={(e) => setPage(e)} />
            </nav>
          </div>
        </CardBody>
      </Card>
    </>
  );
}
