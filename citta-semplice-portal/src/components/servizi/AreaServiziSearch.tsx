'use client';

import React from 'react';
import { useEffect, useState } from 'react';
import Link from 'next/link';

type Servizio = {
  id: number;
  titolo: string;
  sottoTitolo: string | null;
  descrizione: string | null;
  slug: string | null;
};

interface Props {
  areaSlug: string;
  servizi: Servizio[];
}

export function AreaServiziSearch({ areaSlug, servizi }: Props) {
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');

  useEffect(() => {
    const timeout = setTimeout(() => setQuery(search.trim().toLowerCase()), 300);
    return () => clearTimeout(timeout);
  }, [search]);

  const risultati = query
    ? servizi.filter((s) =>
        [s.titolo, s.sottoTitolo].some((campo) =>
          campo?.toLowerCase().includes(query)
        )
      )
      : servizi;
     
    return (
      <>
      <div className="cmp-input-search mb-4">
        <div className="form-group mb-0">
          <div className="input-group">
            <label htmlFor="search-servizi" className="visually-hidden">
              Cerca una parola chiave
            </label>
            <input
              type="search"
              className="form-control"
              placeholder="Cerca una parola chiave"
              id="search-servizi"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <span className="input-group-text" aria-hidden="true">
              <svg className="icon icon-sm icon-primary">
                <use href="/bootstrap-italia/dist/svg/sprites.svg#it-search" />
              </svg>
            </span>
          </div>
          <p className="mt-2 mt-lg-3 mb-4" aria-live="polite">
            <strong>{risultati.length} </strong>servizi trovati in ordine alfabetico
          </p>
        </div>
      </div>

      {risultati.map((servizio) => (
        <div key={servizio.id} className="cmp-card-latest-messages mb-3 mb-30">
          <div className="card shadow-sm px-4 pt-4 pb-4 rounded">
            <div className="card-header border-0 p-0" />
            <div className="card-body p-0 my-2">
              <h3 className="green-title-big t-primary mb-8">
                <Link
                  href={`/${areaSlug}/${servizio.slug ?? servizio.id}`}
                  className="text-decoration-none"
                  data-element="service-link"
                >
                  {servizio.titolo}
                </Link>
              </h3>
              {servizio.sottoTitolo && (
                <p className="text-paragraph">{servizio.sottoTitolo}</p>
              )}
            </div>
          </div>
        </div>
      ))}

      {risultati.length === 0 && (
        <div className="alert alert-info" role="alert">
          Nessun servizio trovato per &laquo;{query}&raquo;.
        </div>
      )}
    </>
  );
}
