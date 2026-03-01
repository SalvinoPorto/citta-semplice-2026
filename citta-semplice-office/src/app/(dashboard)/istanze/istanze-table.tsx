'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Badge, Select } from '@/components/ui';
import { THeadGroup, THead, TFilterHeadGroup, TFilterHead, Paginatore } from '@/components/shared';
import { Order, Filter } from '@/lib/models/table';

interface Istanza {
  id: number;
  protoNumero: string | null;
  datiInEvidenza: string | null;
  dataInvio: Date;
  conclusa: boolean;
  respinta: boolean;
  municipalita: string | null;
  utente: {
    nome: string;
    cognome: string;
    codiceFiscale: string;
  };
  modulo: {
    id: number;
    name: string;
    servizio: {
      titolo: string;
      area: {
        titolo: string;
      };
    };
  };
  attributo: {
    valore: string;
  } | null;
}

interface Modulo {
  id: number;
  name: string;
}

interface IstanzeTableProps {
  istanze: Istanza[];
  moduli: Modulo[];
  total: number;
  page: number;
  totalPages: number;
  currentTipo: string;
  currentModulo?: string;
  currentAnno?: string;
}

const PRIMO_ANNO = 2020;
const anni = Array.from(
  { length: new Date().getFullYear() - PRIMO_ANNO + 1 },
  (_, i) => PRIMO_ANNO + i
).reverse();

export function IstanzeTable({
  istanze,
  moduli,
  total,
  page,
  totalPages,
  currentModulo,
  currentAnno,
}: IstanzeTableProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const updateParams = (params: Record<string, string | undefined>) => {
    const newParams = new URLSearchParams(searchParams.toString());
    Object.entries(params).forEach(([key, value]) => {
      if (value) {
        newParams.set(key, value);
      } else {
        newParams.delete(key);
      }
    });
    if (!params.page) {
      newParams.delete('page');
    }
    router.push(`/istanze?${newParams.toString()}`);
  };

  const handleSort = (order: Order) => {
    updateParams({
      sort: order.field || undefined,
      dir: order.direction === 1 ? 'asc' : order.direction === -1 ? 'desc' : undefined,
    });
  };

  const handleFilter = (filters: Filter[]) => {
    const params: Record<string, string | undefined> = {
      protocollo: undefined,
      cognome: undefined,
    };
    filters.forEach((f) => {
      params[f.key] = f.value || undefined;
    });
    updateParams(params);
  };

  const getStatusBadge = (istanza: Istanza) => {
    if (istanza.conclusa) {
      return <Badge variant="success">Conclusa</Badge>;
    }
    if (istanza.respinta) {
      return <Badge variant="danger">Respinta</Badge>;
    }
    return <Badge variant="warning">In Lavorazione</Badge>;
  };

  return (
    <div>
      {/* Filtri globali */}
      <div className="row g-3 mb-3">
        <div className="col-12 col-md-4">
          <Select
            options={[
              { value: '', label: 'Tutti i moduli' },
              ...moduli.map((m) => ({ value: m.id, label: m.name })),
            ]}
            value={currentModulo || ''}
            onChange={(e) => updateParams({ modulo: e.target.value || undefined })}
          />
        </div>
        <div className="col-12 col-md-2">
          <Select
            options={[
              { value: '', label: 'Tutti gli anni' },
              ...anni.map((a) => ({ value: a, label: String(a) })),
            ]}
            value={currentAnno || ''}
            onChange={(e) => updateParams({ anno: e.target.value || undefined })}
          />
        </div>
      </div>

      {/* Tabella */}
      <div className="table-responsive">
        <table className="table table-bordered table-striped table-hover">
          <THeadGroup onChange={handleSort}>
            <THead field="id" width="5%">ID</THead>
            <THead field="protoNumero" width="10%">Protocollo</THead>
            <THead field="cognome" width="20%">Utente</THead>
            <THead field="modulo" width="15%">Modulo</THead>
            <THead field="" width="15%">Dati in Evidenzaaa</THead>
            <THead field="dataInvio" width="10%">Data Invio</THead>
            <THead field="" width="10%">Stato</THead>
            <THead field="" width="5%">&nbsp;</THead>
          </THeadGroup>
          <TFilterHeadGroup onFilter={handleFilter}>
            <TFilterHead />
            <TFilterHead field="protocollo" placeholder="Cerca protocollo..." />
            <TFilterHead field="cognome" placeholder="Cerca cognome/CF..." />
            <TFilterHead />
            <TFilterHead />
            <TFilterHead />
            <TFilterHead />
            <TFilterHead />
          </TFilterHeadGroup>
          <tbody>
            {istanze.length === 0 ? (
              <tr>
                <td colSpan={8} className="text-center py-4 text-muted">
                  Nessuna istanza trovata
                </td>
              </tr>
            ) : (
              istanze.map((istanza) => (
                <tr key={istanza.id}>
                  <td>
                    <Link href={`/istanze/${istanza.id}`} className="fw-bold">
                      #{istanza.id}
                    </Link>
                  </td>
                  <td>{istanza.protoNumero || '-'}</td>
                  <td>
                    <div>
                      <strong>
                        {istanza.utente.cognome} {istanza.utente.nome}
                      </strong>
                    </div>
                    <small className="text-muted">{istanza.utente.codiceFiscale}</small>
                  </td>
                  <td>
                    <div>{istanza.modulo.name}</div>
                    <small className="text-muted">
                      {istanza.modulo.servizio.area.titolo} / {istanza.modulo.servizio.titolo}
                    </small>
                  </td>
                  <td>
                    <small>{istanza.datiInEvidenza || '-'}</small>
                  </td>
                  <td>{new Date(istanza.dataInvio).toLocaleDateString('it-IT')}</td>
                  <td>{getStatusBadge(istanza)}</td>
                  <td>
                    <Link
                      href={`/istanze/${istanza.id}`}
                      className="btn btn-sm btn-outline-primary"
                    >
                      Dettaglio
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Paginazione */}
      {totalPages > 1 && (
        <div className="d-flex justify-content-between align-items-center mt-4">
          <div className="text-muted">
            Pagina {page} di {totalPages} ({total} risultati)
          </div>
          <nav aria-label="Navigazione pagine">
            <Paginatore
              page={page}
              pages={totalPages}
              onChange={(p) => updateParams({ page: String(p) })}
            />
          </nav>
        </div>
      )}
    </div>
  );
}
