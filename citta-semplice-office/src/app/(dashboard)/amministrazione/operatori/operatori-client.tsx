'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { Card, CardBody, Badge } from '@/components/ui';
import { THeadGroup, THead, Paginatore, TFilterHead, TFilterHeadGroup } from '@/components/shared';
import type { Order, Filter } from '@/lib/models/table';

interface Ruolo { id: number; nome: string; }
interface Ufficio { id: number; nome: string; }
interface OperatoreRow {
  id: number;
  nome: string;
  cognome: string;
  userName: string;
  email: string | null;
  attivo: boolean;
  ruoli: { ruoloId: number; ruolo: Ruolo }[];
  ufficio: Ufficio | null;
}

const PAGE_SIZE = 15;

export function OperatoriClient({ operatori }: { operatori: OperatoreRow[] }) {
  const [order, setOrder] = useState<Order>({ field: 'cognome', direction: 1 });
  const [filters, setFilters] = useState<Filter[]>([]);
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    let rows = [...operatori];

    for (const f of filters) {
      const v = String(f.value).toLowerCase();
      if (!v) continue;
      if (f.key === 'cerca') {
        rows = rows.filter(r =>
          r.cognome.toLowerCase().includes(v) ||
          r.nome.toLowerCase().includes(v) ||
          r.userName.toLowerCase().includes(v) ||
          (r.email ?? '').toLowerCase().includes(v)
        );
      }
    }

    if (order.field && order.direction !== 0) {
      rows.sort((a, b) => {
        let av = '', bv = '';
        if (order.field === 'cognome') { av = `${a.cognome} ${a.nome}`; bv = `${b.cognome} ${b.nome}`; }
        else if (order.field === 'email') { av = a.email ?? ''; bv = b.email ?? ''; }
        else if (order.field === 'ufficio') { av = a.ufficio?.nome ?? ''; bv = b.ufficio?.nome ?? ''; }
        else if (order.field === 'attivo') { av = a.attivo ? '1' : '0'; bv = b.attivo ? '1' : '0'; }
        return av.localeCompare(bv) * order.direction;
      });
    }

    return rows;
  }, [operatori, filters, order]);

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pages);
  const rows = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const handleOrder = (o: Order) => { setOrder(o); setPage(1); };
  const handleFilter = (f: Filter[]) => { setFilters(f); setPage(1); };

  return (
    <Card>
      <CardBody>
        <div className="table-responsive">
          <table className="table table-hover">
            <THeadGroup onChange={handleOrder} initialField="cognome" initialDirection={1}>
              <THead field="cognome">Nome</THead>
              <THead field="email">Email</THead>
              <THead field="">Ruoli</THead>
              <THead field="ufficio">Ufficio</THead>
              <THead field="attivo">Stato</THead>
              <THead field=""></THead>
            </THeadGroup>
            <TFilterHeadGroup onFilter={handleFilter}>
              <TFilterHead field="cerca" placeholder="Cerca..." />
              <TFilterHead />
              <TFilterHead />
              <TFilterHead />
              <TFilterHead />
              <TFilterHead />
            </TFilterHeadGroup>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-4 text-muted">
                    Nessun operatore trovato
                  </td>
                </tr>
              ) : (
                rows.map((operatore) => (
                  <tr key={operatore.id}>
                    <td>
                      <Link href={`/amministrazione/operatori/${operatore.id}`} className="fw-bold">
                        {operatore.cognome} {operatore.nome}
                      </Link>
                      <div className="small text-muted">{operatore.userName}</div>
                    </td>
                    <td>{operatore.email}</td>
                    <td>
                      <div className="d-flex gap-1 flex-wrap">
                        {operatore.ruoli.map((r) => (
                          <Badge key={r.ruoloId} variant="secondary">{r.ruolo.nome}</Badge>
                        ))}
                      </div>
                    </td>
                    <td>{operatore.ufficio?.nome ?? <span className="text-muted">—</span>}</td>
                    <td>
                      {operatore.attivo
                        ? <Badge variant="success">Attivo</Badge>
                        : <Badge variant="danger">Disattivo</Badge>}
                    </td>
                    <td>
                      <Link href={`/amministrazione/operatori/${operatore.id}`} className="btn btn-sm btn-outline-primary">
                        Modifica
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {pages > 1 && (
          <div className="d-flex justify-content-center mt-3">
            <Paginatore page={currentPage} pages={pages} onChange={setPage} />
          </div>
        )}
      </CardBody>
    </Card>
  );
}
