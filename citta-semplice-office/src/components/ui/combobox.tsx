'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import clsx from 'clsx';

export interface ComboboxOption {
  value: string;
  label: string;
}

export interface ComboboxProps {
  value: string;
  onChange: (value: string) => void;
  options: ComboboxOption[];
  label?: string;
  id?: string;
  placeholder?: string;
  helpText?: string;
  error?: string;
  disabled?: boolean;
  required?: boolean;
  loading?: boolean;
  /** Elenco non caricabile (API non raggiungibile): il valore salvato resta comunque valido */
  unavailable?: boolean;
  /** Consente di digitare un valore non presente in elenco (utile con elenco non disponibile) */
  allowCustomValue?: boolean;
  emptyMessage?: string;
  maxVisible?: number;
}

/**
 * Autocomplete su elenco remoto che non perde mai il valore già memorizzato.
 * Una <select> azzera il valore quando l'option corrispondente non esiste
 * (elenco vuoto perché l'API è giù): qui il valore vive solo nello stato del
 * form e l'elenco è soltanto un aiuto alla scelta.
 */
export function Combobox({
  value,
  onChange,
  options,
  label,
  id,
  placeholder = 'Cerca o digita un codice…',
  helpText,
  error,
  disabled,
  required,
  loading = false,
  unavailable = false,
  allowCustomValue = true,
  emptyMessage = 'Nessun risultato',
  maxVisible = 50,
}: ComboboxProps) {
  const autoId = useId();
  const inputId = id || `combobox-${autoId}`;
  const listId = `${inputId}-list`;

  const wrapperRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState<string | null>(null); // null = non in editing
  const [highlight, setHighlight] = useState(0);

  const selected = useMemo(() => options.find((o) => o.value === value), [options, value]);
  // Valore configurato ma assente dall'elenco: mostra il codice grezzo, non il vuoto
  const displayValue = query ?? (selected ? selected.label : value);

  const filtered = useMemo(() => {
    const q = (query ?? '').trim().toLowerCase();
    const list = q
      ? options.filter((o) => o.label.toLowerCase().includes(q) || o.value.toLowerCase().includes(q))
      : options;
    return list.slice(0, maxVisible);
  }, [options, query, maxVisible]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      if (!wrapperRef.current?.contains(e.target as Node)) close();
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [open]);

  function close() {
    setOpen(false);
    setQuery(null);
  }

  function commit(option: ComboboxOption) {
    onChange(option.value);
    setOpen(false);
    setQuery(null);
  }

  function commitTypedValue() {
    if (query === null) return;
    const typed = query.trim();
    if (typed === '') {
      onChange('');
      return;
    }
    const exact = options.find(
      (o) => o.value.toLowerCase() === typed.toLowerCase() || o.label.toLowerCase() === typed.toLowerCase(),
    );
    if (exact) {
      onChange(exact.value);
    } else if (allowCustomValue) {
      onChange(typed);
    }
    // senza allowCustomValue il valore precedente resta invariato
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!open) {
        setOpen(true);
        setHighlight(0);
        return;
      }
      const delta = e.key === 'ArrowDown' ? 1 : -1;
      setHighlight((h) => {
        if (filtered.length === 0) return 0;
        return (h + delta + filtered.length) % filtered.length;
      });
      return;
    }
    if (e.key === 'Enter') {
      if (open && filtered[highlight]) {
        e.preventDefault();
        commit(filtered[highlight]);
      } else if (open) {
        e.preventDefault();
        commitTypedValue();
        close();
      }
      return;
    }
    if (e.key === 'Escape' && open) {
      e.preventDefault();
      close();
    }
  }

  return (
    <div className="mb-0" ref={wrapperRef}>
      {label && (
        <label htmlFor={inputId} className="form-label">
          {label}
          {required && <span className="text-danger ms-1">*</span>}
        </label>
      )}

      <div className="position-relative">
        <div className="d-flex">
          <input
            id={inputId}
            type="text"
            role="combobox"
            aria-expanded={open}
            aria-controls={listId}
            aria-autocomplete="list"
            autoComplete="off"
            className={clsx('form-control', error && 'is-invalid')}
            value={displayValue}
            placeholder={loading ? 'Caricamento…' : placeholder}
            disabled={disabled}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
              setHighlight(0);
            }}
            onFocus={() => setOpen(true)}
            onBlur={() => {
              commitTypedValue();
              setQuery(null);
            }}
            onKeyDown={onKeyDown}
          />
          {value && !disabled && (
            <button
              type="button"
              className="btn btn-outline-secondary ms-1"
              title="Rimuovi selezione"
              onClick={() => {
                onChange('');
                setQuery(null);
              }}
            >
              ×
            </button>
          )}
        </div>

        {open && !disabled && (
          <ul
            id={listId}
            role="listbox"
            className="list-group position-absolute w-100 shadow-sm overflow-auto"
            style={{ zIndex: 1000, maxHeight: '15rem' }}
          >
            {loading && <li className="list-group-item text-muted small">Caricamento…</li>}
            {!loading && filtered.length === 0 && (
              <li className="list-group-item text-muted small">
                {unavailable ? 'Elenco non disponibile' : emptyMessage}
              </li>
            )}
            {!loading &&
              filtered.map((option, i) => (
                <li key={option.value} className="p-0">
                  <button
                    type="button"
                    role="option"
                    aria-selected={option.value === value}
                    className={clsx(
                      'list-group-item list-group-item-action w-100 text-start small',
                      i === highlight && 'active',
                    )}
                    // mousedown: precede il blur dell'input
                    onMouseDown={(e) => e.preventDefault()}
                    onMouseEnter={() => setHighlight(i)}
                    onClick={() => commit(option)}
                  >
                    {option.label}
                    {option.label !== option.value && (
                      <span className={clsx('ms-2', i === highlight ? 'text-white-50' : 'text-muted')}>
                        {option.value}
                      </span>
                    )}
                  </button>
                </li>
              ))}
          </ul>
        )}
      </div>

      {error && <div className="invalid-feedback d-block">{error}</div>}
      {!error && unavailable && value && (
        <small className="form-text text-warning">
          Elenco non disponibile: valore memorizzato <code>{value}</code> conservato.
        </small>
      )}
      {!error && unavailable && !value && (
        <small className="form-text text-warning">
          Elenco non disponibile: inserire il codice manualmente o riprovare più tardi.
        </small>
      )}
      {!error && !unavailable && selected === undefined && value && (
        <small className="form-text text-warning">
          Codice <code>{value}</code> non presente nell&apos;elenco corrente.
        </small>
      )}
      {!error && helpText && <small className="form-text text-muted">{helpText}</small>}
    </div>
  );
}
