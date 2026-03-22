'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';

type Servizio = {
  id: number;
  titolo: string;
  slug: string | null;
  area: { id: number; nome: string; slug: string | null };
};

const PAGE_SIZE = 10;

export function ServiziSearch() {
  const [search, setSearch] = useState('');
  const [servizi, setServizi] = useState<Servizio[]>([]);
  const [total, setTotal] = useState(0);
  const [limit, setLimit] = useState(PAGE_SIZE);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchServizi = useCallback(async (q: string, lim: number) => {
    setLoading(true);
    const params = new URLSearchParams({ limit: String(lim) });
    if (q.trim()) params.set('search', q.trim());
    const res = await fetch(`/api/servizi?${params}`);
    const data = await res.json();
    setServizi(data.servizi);
    setTotal(data.total);
    setLoading(false);
  }, []);

  // Initial load
  useEffect(() => {
    fetchServizi('', PAGE_SIZE);
  }, [fetchServizi]);

  const handleSearch = (value: string) => {
    setSearch(value);
    setLimit(PAGE_SIZE);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetchServizi(value, PAGE_SIZE);
    }, 400);
  };

  const handleLoadMore = () => {
    const newLimit = limit + PAGE_SIZE;
    setLimit(newLimit);
    fetchServizi(search, newLimit);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (debounceRef.current) clearTimeout(debounceRef.current);
    fetchServizi(search, PAGE_SIZE);
    setLimit(PAGE_SIZE);
  };

  return (
    <div>
      {/* Search form */}
      <form onSubmit={handleSubmit} className="mb-3">
        <div className="input-group">
          <input
            type="text"
            className="form-control"
            placeholder="Cerca una parola chiave"
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
          />
          <button type="submit" className="btn btn-primary px-4">
            Inizia
          </button>
        </div>
      </form>

      {/* Count */}
      {!loading && (
        <p className="small text-muted mb-3">
          <strong>{total}</strong> servizi trovati in ordine alfabetico
        </p>
      )}

      {/* List */}
      <div>
        {servizi.map((s) => (
          <div key={s.id} className="border-bottom py-2">
            <div className="small text-uppercase text-muted mb-1" style={{ fontSize: '0.7rem', letterSpacing: '0.05em' }}>
              {s.area.nome}
            </div>
            <Link
              href={`/${s.area.slug ?? s.area.id}/${s.slug ?? s.id}`}
              className="fw-semibold text-decoration-none"
            >
              {s.titolo}
            </Link>
          </div>
        ))}
      </div>

      {/* Load more */}
      {servizi.length < total && (
        <div className="mt-4 text-center">
          <button
            className="btn btn-outline-primary"
            onClick={handleLoadMore}
            disabled={loading}
          >
            {loading ? 'Caricamento...' : 'Carica altri risultati'}
          </button>
        </div>
      )}
    </div>
  );
}
