'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useEffect } from 'react';

interface Campo {
  name: string;
  label: string;
  type: 'text' | 'textarea' | 'select' | 'date' | 'number' | 'email' | 'tel' | 'checkbox';
  required?: boolean;
  options?: string[];
  placeholder?: string;
}

interface Servizio {
  moduloTipo: string;
  attributi?: string | null;
  moduloCorpo?: string | null;
}

interface Props {
  servizio: Servizio;
  dati: Record<string, unknown>;
  onChangeDati: (dati: Record<string, unknown>) => void;
}

function parseCampi(attributi: string | null | undefined): Campo[] {
  if (!attributi) return [];
  try {
    const parsed = JSON.parse(attributi);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function buildSchema(campi: Campo[]) {
  const shape: Record<string, z.ZodTypeAny> = {};
  for (const campo of campi) {
    if (campo.type === 'checkbox') {
      shape[campo.name] = campo.required
        ? z.boolean().refine((v) => v, { message: 'Campo obbligatorio' })
        : z.boolean().optional();
    } else {
      shape[campo.name] = campo.required
        ? z.string().min(1, 'Campo obbligatorio')
        : z.string().optional();
    }
  }
  return z.object(shape);
}

export function ModuloStep({ servizio, dati, onChangeDati }: Props) {
  const campi = parseCampi(servizio.attributi);
  const schema = buildSchema(campi);

  const {
    register,
    watch,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: dati as Record<string, string | boolean>,
    mode: 'onChange',
  });

  const values = watch();
  useEffect(() => {
    onChangeDati(values);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(values)]);

  if (servizio.moduloTipo === 'PDF') {
    return (
      <div className="container">
        <div className="alert alert-info">
          Questo servizio richiede la compilazione di un modulo PDF. Scarica il modulo, compilalo
          e allegalo nella sezione allegati.
        </div>
      </div>
    );
  }

  if (campi.length === 0 && servizio.moduloCorpo) {
    return (
      <div className="container">
        <div dangerouslySetInnerHTML={{ __html: servizio.moduloCorpo }} />
      </div>
    );
  }

  if (campi.length === 0) {
    return (
      <div className="container">
        <div className="alert alert-info">
          Nessun campo aggiuntivo richiesto per questo servizio.
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <h2 className="mb-4">Compila il modulo</h2>
      <div className="row">
        {campi.map((campo) => (
          <div key={campo.name} className="col-12 col-md-6 mb-3">
            <div className="form-group">
              {campo.type === 'checkbox' ? (
                <div className="form-check">
                  <input
                    type="checkbox"
                    className="form-check-input"
                    id={campo.name}
                    {...register(campo.name)}
                  />
                  <label className="form-check-label" htmlFor={campo.name}>
                    {campo.label}
                    {campo.required && <span className="text-danger ms-1">*</span>}
                  </label>
                </div>
              ) : campo.type === 'textarea' ? (
                <>
                  <label htmlFor={campo.name} className="form-label">
                    {campo.label}
                    {campo.required && <span className="text-danger ms-1">*</span>}
                  </label>
                  <textarea
                    id={campo.name}
                    className={`form-control${errors[campo.name] ? ' is-invalid' : ''}`}
                    placeholder={campo.placeholder}
                    rows={4}
                    {...register(campo.name)}
                  />
                </>
              ) : campo.type === 'select' ? (
                <>
                  <label htmlFor={campo.name} className="form-label">
                    {campo.label}
                    {campo.required && <span className="text-danger ms-1">*</span>}
                  </label>
                  <select
                    id={campo.name}
                    className={`form-select${errors[campo.name] ? ' is-invalid' : ''}`}
                    {...register(campo.name)}
                  >
                    <option value="">Seleziona...</option>
                    {campo.options?.map((opt) => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                </>
              ) : (
                <>
                  <label htmlFor={campo.name} className="form-label">
                    {campo.label}
                    {campo.required && <span className="text-danger ms-1">*</span>}
                  </label>
                  <input
                    type={campo.type}
                    id={campo.name}
                    className={`form-control${errors[campo.name] ? ' is-invalid' : ''}`}
                    placeholder={campo.placeholder}
                    {...register(campo.name)}
                  />
                </>
              )}
              {errors[campo.name] && (
                <div className="invalid-feedback">
                  {String(errors[campo.name]?.message ?? 'Campo non valido')}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
