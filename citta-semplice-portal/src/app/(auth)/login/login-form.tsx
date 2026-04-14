'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { signIn } from 'next-auth/react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod/v4';

const schema = z.object({
  codiceFiscale: z.string().min(16, 'Inserisci il codice fiscale').max(16),
  password: z.string().min(1, 'Inserisci la password'),
});

type FormData = z.infer<typeof schema>;

export function LoginForm() {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get('callbackUrl') ?? '/le-mie-istanze';
  const ssoToken = searchParams.get('ssoToken');
  const errorParam = searchParams.get('error');

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [ssoLoading, setSsoLoading] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  // Auto-complete SSO login when redirected back from the CIG callback
  useEffect(() => {
    if (!ssoToken) return;
    setSsoLoading(true);
    signIn('cig-sso', { ssoToken, redirect: false }).then((result) => {
      if (result?.error) {
        setSsoLoading(false);
        setError('Autenticazione SPID/CIE non riuscita. Riprova.');
      } else {
        window.location.href = callbackUrl;
      }
    });
  }, [ssoToken, callbackUrl]);

  // Map server-side error codes to human-readable messages
  useEffect(() => {
    if (!errorParam) return;
    const messages: Record<string, string> = {
      sso_init: 'Impossibile avviare il servizio di autenticazione. Riprova più tardi.',
      sso_invalid: 'Risposta non valida dal servizio di autenticazione.',
      sso_auth: 'Autenticazione non riuscita. Riprova.',
      sso_user: 'Impossibile leggere i dati utente dal servizio di autenticazione.',
      sso_db: 'Errore interno. Riprova più tardi.',
    };
    setError(messages[errorParam] ?? 'Si è verificato un errore durante il login.');
  }, [errorParam]);

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

  // While completing the SSO handoff show a spinner over the whole form
  if (ssoLoading) {
    return (
      <div className="card shadow-sm">
        <div className="card-body p-4 text-center">
          <div className="spinner-border text-primary mb-3" role="status">
            <span className="visually-hidden">Accesso in corso…</span>
          </div>
          <p className="text-muted">Completamento accesso SPID / CIE…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="card shadow-sm">
      <div className="card-body p-4">
        <h2 className="h5 mb-4 text-center">Accedi al portale</h2>

        {error && (
          <div className="alert alert-danger" role="alert">
            {error}
          </div>
        )}

        {/* ── SPID / CIE (primary) ── */}
        <a
          href={`/api/auth/sso/logon?callbackUrl=${encodeURIComponent(callbackUrl)}`}
          className="btn btn-primary w-100 mb-3 d-flex align-items-center justify-content-center gap-2"
        >
          <span className="fw-bold">SPID</span>
          <span className="text-white-50">/</span>
          <span className="fw-bold">CIE</span>
          <span className="small fw-normal ms-1">— Accedi con identità digitale</span>
        </a>

        <hr className="my-3" />

        {/* ── Credenziali (secondary / backoffice) ── */}
        <p className="small text-muted text-center mb-3">
          Oppure accedi con credenziali locali
        </p>

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
            className="btn btn-outline-secondary w-100"
            disabled={loading}
          >
            {loading ? (
              <>
                <span
                  className="spinner-border spinner-border-sm me-2"
                  role="status"
                  aria-hidden="true"
                />
                Accesso in corso…
              </>
            ) : (
              'Accedi'
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
