'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { signIn } from 'next-auth/react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const schema = z.object({
  codiceFiscale: z.string().min(16, 'Inserisci il codice fiscale').max(16),
  password: z.string().min(1, 'Inserisci la password'),
});

type FormData = z.infer<typeof schema>;

export function LoginForm() {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get('callbackUrl') ?? '/le-mie-istanze';
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data: FormData) => {
    setLoading(true);
    setError(null);
    const result = await signIn('credentials', {
      codiceFiscale: data.codiceFiscale.toUpperCase(),
      password: data.password,
      redirect: false,
    });
    setLoading(false);
    if (result?.error) {
      setError('Codice fiscale o password non corretti.');
    } else {
      window.location.href = callbackUrl;
    }
  };

  return (
    <div className="card shadow-sm">
      <div className="card-body p-4">
        <h2 className="h5 mb-4 text-center">Accedi al portale</h2>

        {error && (
          <div className="alert alert-danger" role="alert">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <div className="form-group mb-3">
            <label htmlFor="codiceFiscale" className="form-label">
              Codice Fiscale
            </label>
            <input
              type="text"
              id="codiceFiscale"
              className={`form-control${errors.codiceFiscale ? ' is-invalid' : ''}`}
              placeholder="RSSMRA80A01F205S"
              autoCapitalize="characters"
              {...register('codiceFiscale')}
            />
            {errors.codiceFiscale && (
              <div className="invalid-feedback">{errors.codiceFiscale.message}</div>
            )}
          </div>

          <div className="form-group mb-4">
            <label htmlFor="password" className="form-label">
              Password
            </label>
            <input
              type="password"
              id="password"
              className={`form-control${errors.password ? ' is-invalid' : ''}`}
              {...register('password')}
            />
            {errors.password && (
              <div className="invalid-feedback">{errors.password.message}</div>
            )}
          </div>

          <button
            type="submit"
            className="btn btn-primary w-100"
            disabled={loading}
          >
            {loading ? (
              <>
                <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true" />
                Accesso in corso...
              </>
            ) : (
              'Accedi'
            )}
          </button>
        </form>

        <hr className="my-4" />

        <div className="text-center">
          <p className="small text-muted mb-2">Oppure accedi con identità digitale</p>
          <button type="button" className="btn btn-outline-secondary w-100" disabled>
            <span className="fw-bold">SPID</span> / <span className="fw-bold">CIE</span>
            <span className="ms-1 small">(prossimamente)</span>
          </button>
        </div>
      </div>
    </div>
  );
}
