'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Card, CardBody, CardTitle, Button, Input, Select, Badge } from '@/components/ui';

interface Modulo {
  id: number;
  name: string;
}

interface RicercheClientProps {
  moduli: Modulo[];
}

interface SearchResult {
  id: number;
  utente: string;
  codiceFiscale?: string;
  servizio: string;
  data: string;
  stato: string;
  protocollo?: string;
  importoFormatted?: string;
  iuv?: string;
}

export function RicercheClient({ moduli }: RicercheClientProps) {
  const [searchType, setSearchType] = useState('istanze');
  const [filters, setFilters] = useState({
    codiceFiscale: '',
    protocollo: '',
    dataInizio: '',
    dataFine: '',
    servizioId: '',
    stato: '',
    cognome: '',
    email: '',
    iuv: '',
  });
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [hasSearched, setHasSearched] = useState(false);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setHasSearched(true);

    try {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value) params.set(key, value);
      });

      const response = await fetch(`/api/search/${searchType}?${params}`);
      if (response.ok) {
        const data = await response.json();
        setResults(data.results || []);
        setTotal(data.total || 0);
      }
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = () => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value) params.set(key, value);
    });

    window.open(`/api/export/${searchType}?${params}`, '_blank');
  };

  const resetFilters = () => {
    setFilters({
      codiceFiscale: '',
      protocollo: '',
      dataInizio: '',
      dataFine: '',
      servizioId: '',
      stato: '',
      cognome: '',
      email: '',
      iuv: '',
    });
    setResults([]);
    setHasSearched(false);
    setTotal(0);
  };

  const renderFilters = () => {
    switch (searchType) {
      case 'istanze':
        return (
          <>
            <div className="mb-3">
              <Input
                type="text"
                label="Codice Fiscale"
                value={filters.codiceFiscale}
                onChange={(e) =>
                  setFilters({ ...filters, codiceFiscale: e.target.value.toUpperCase() })
                }
                placeholder="RSSMRA80A01H501..."
                maxLength={16}
              />
            </div>

            <div className="mb-3">
              <Input
                type="text"
                label="Numero Protocollo"
                value={filters.protocollo}
                onChange={(e) =>
                  setFilters({ ...filters, protocollo: e.target.value })
                }
                placeholder="2024/..."
              />
            </div>

            <div className="mb-3">
              <Select
                label="Servizio"
                value={filters.servizioId}
                onChange={(e) =>
                  setFilters({ ...filters, servizioId: e.target.value })
                }
              >
                <option value="">Tutti i servizi</option>
                {moduli.map((modulo) => (
                  <option key={modulo.id} value={modulo.id}>
                    {modulo.name}
                  </option>
                ))}
              </Select>
            </div>

            <div className="row">
              <div className="col-6 mb-3">
                <Input
                  type="date"
                  label="Data Inizio"
                  value={filters.dataInizio}
                  onChange={(e) =>
                    setFilters({ ...filters, dataInizio: e.target.value })
                  }
                />
              </div>
              <div className="col-6 mb-3">
                <Input
                  type="date"
                  label="Data Fine"
                  value={filters.dataFine}
                  onChange={(e) =>
                    setFilters({ ...filters, dataFine: e.target.value })
                  }
                />
              </div>
            </div>

            <div className="mb-3">
              <Select
                label="Stato"
                value={filters.stato}
                onChange={(e) =>
                  setFilters({ ...filters, stato: e.target.value })
                }
              >
                <option value="">Tutti</option>
                <option value="aperta">In Lavorazione</option>
                <option value="conclusa">Conclusa</option>
                <option value="respinta">Respinta</option>
              </Select>
            </div>
          </>
        );

      case 'utenti':
        return (
          <>
            <div className="mb-3">
              <Input
                type="text"
                label="Codice Fiscale"
                value={filters.codiceFiscale}
                onChange={(e) =>
                  setFilters({ ...filters, codiceFiscale: e.target.value.toUpperCase() })
                }
                placeholder="RSSMRA80A01H501..."
                maxLength={16}
              />
            </div>

            <div className="mb-3">
              <Input
                label="Cognome"
                value={filters.cognome}
                onChange={(e) =>
                  setFilters({ ...filters, cognome: e.target.value })
                }
              />
            </div>

            <div className="mb-3">
              <Input
                label="Email"
                type="email"
                value={filters.email}
                onChange={(e) =>
                  setFilters({ ...filters, email: e.target.value })
                }
              />
            </div>
          </>
        );

      case 'pagamenti':
        return (
          <>
            <div className="mb-3">
              <Input
                type="text"
                label="IUV"
                value={filters.iuv}
                onChange={(e) =>
                  setFilters({ ...filters, iuv: e.target.value })
                }
              />
            </div>

            <div className="mb-3">
              <Input
                type="text"
                label="Codice Fiscale"
                value={filters.codiceFiscale}
                onChange={(e) =>
                  setFilters({ ...filters, codiceFiscale: e.target.value.toUpperCase() })
                }
                placeholder="RSSMRA80A01H501..."
                maxLength={16}
              />
            </div>

            <div className="row">
              <div className="col-6 mb-3">
                <Input
                  type="date"
                  label="Data Inizio"
                  value={filters.dataInizio}
                  onChange={(e) =>
                    setFilters({ ...filters, dataInizio: e.target.value })
                  }
                />
              </div>
              <div className="col-6 mb-3">
                <Input
                  type="date"
                  label="Data Fine"
                  value={filters.dataFine}
                  onChange={(e) =>
                    setFilters({ ...filters, dataFine: e.target.value })
                  }
                />
              </div>
            </div>

            <div className="mb-3">
              <Select
                label="Stato Pagamento"
                value={filters.stato}
                onChange={(e) =>
                  setFilters({ ...filters, stato: e.target.value })
                }
              >
                <option value="">Tutti</option>
                <option value="PAGATO">Pagato</option>
                <option value="IN_ATTESA">In Attesa</option>
                <option value="FALLITO">Fallito</option>
              </Select>
            </div>
          </>
        );

      default:
        return null;
    }
  };

  const renderResultsTable = () => {
    if (searchType === 'istanze') {
      return (
        <table className="table table-sm table-hover">
          <thead>
            <tr>
              <th>ID</th>
              <th>Utente</th>
              <th>Modulo</th>
              <th>Data</th>
              <th>Protocollo</th>
              <th>Stato</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {results.map((result) => (
              <tr key={result.id}>
                <td>#{result.id}</td>
                <td>
                  <div>{result.utente}</div>
                  <small className="text-muted">{result.codiceFiscale}</small>
                </td>
                <td>{result.servizio}</td>
                <td>{result.data}</td>
                <td>{result.protocollo}</td>
                <td>
                  <Badge
                    variant={
                      result.stato === 'Conclusa'
                        ? 'success'
                        : result.stato === 'Respinta'
                          ? 'danger'
                          : 'warning'
                    }
                  >
                    {result.stato}
                  </Badge>
                </td>
                <td>
                  <Link
                    href={`/istanze/${result.id}`}
                    className="btn btn-sm btn-outline-primary"
                  >
                    Dettagli
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      );
    }

    if (searchType === 'pagamenti') {
      return (
        <table className="table table-sm table-hover">
          <thead>
            <tr>
              <th>ID</th>
              <th>IUV</th>
              <th>Utente</th>
              <th>Importo</th>
              <th>Data</th>
              <th>Stato</th>
            </tr>
          </thead>
          <tbody>
            {results.map((result) => (
              <tr key={result.id}>
                <td>#{result.id}</td>
                <td><code>{result.iuv}</code></td>
                <td>{result.utente}</td>
                <td className="fw-bold">{result.importoFormatted}</td>
                <td>{result.data}</td>
                <td>
                  <Badge
                    variant={
                      result.stato === 'PAGATO'
                        ? 'success'
                        : result.stato === 'FALLITO'
                          ? 'danger'
                          : 'warning'
                    }
                  >
                    {result.stato}
                  </Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      );
    }

    // utenti
    return (
      <table className="table table-sm table-hover">
        <thead>
          <tr>
            <th>ID</th>
            <th>Codice Fiscale</th>
            <th>Nome</th>
            <th>Email</th>
            <th>Istanze</th>
          </tr>
        </thead>
        <tbody>
          {results.map((result) => (
            <tr key={result.id}>
              <td>#{result.id}</td>
              <td><code>{result.codiceFiscale}</code></td>
              <td>{result.utente}</td>
              <td>{result.servizio !== '-' ? result.servizio : '-'}</td>
              <td>
                <Badge variant="info">{result.stato}</Badge>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  };

  return (
    <div className="row g-4">
      {/* Search Form */}
      <div className="col-12 col-lg-4">
        <Card>
          <CardBody>
            <CardTitle>Filtri di Ricerca</CardTitle>

            <form onSubmit={handleSearch}>
              <div className="mb-3">
                <Select
                  label="Tipo Ricerca"
                  value={searchType}
                  onChange={(e) => {
                    setSearchType(e.target.value);
                    resetFilters();
                  }}
                >
                  <option value="istanze">Istanze</option>
                  <option value="utenti">Utenti</option>
                  <option value="pagamenti">Pagamenti</option>
                </Select>
              </div>

              {renderFilters()}

              <div className="d-flex gap-2">
                <Button type="submit" variant="primary" loading={loading} className="flex-grow-1">
                  Cerca
                </Button>
                <Button
                  type="button"
                  variant="outline-secondary"
                  onClick={resetFilters}
                >
                  Reset
                </Button>
              </div>
            </form>
          </CardBody>
        </Card>
      </div>

      {/* Results */}
      <div className="col-12 col-lg-8">
        <Card>
          <CardBody>
            <div className="d-flex justify-content-between align-items-center mb-3">
              <CardTitle className="mb-0">
                Risultati {hasSearched && `(${total})`}
              </CardTitle>
              {results.length > 0 && (
                <Button
                  variant="outline-success"
                  size="sm"
                  onClick={handleExport}
                >
                  Esporta CSV
                </Button>
              )}
            </div>

            {loading ? (
              <div className="text-center py-5">
                <div className="spinner-border text-primary" role="status">
                  <span className="visually-hidden">Caricamento...</span>
                </div>
              </div>
            ) : !hasSearched ? (
              <div className="text-center py-5 text-muted">
                <p className="mb-0">
                  Imposta i filtri e clicca su &quot;Cerca&quot; per visualizzare i risultati
                </p>
              </div>
            ) : results.length === 0 ? (
              <div className="text-center py-5 text-muted">
                <p className="mb-0">Nessun risultato trovato</p>
              </div>
            ) : (
              <div className="table-responsive">
                {renderResultsTable()}
              </div>
            )}

            {results.length > 0 && total > results.length && (
              <div className="text-center mt-3 text-muted">
                <small>
                  Mostrati {results.length} di {total} risultati.
                  Esporta per ottenere tutti i dati.
                </small>
              </div>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
