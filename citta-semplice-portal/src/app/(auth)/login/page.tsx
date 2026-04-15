import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { SsoHandoff } from './sso-handoff';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Accedi - Città Semplice',
};

interface Props {
  searchParams: Promise<{ callbackUrl?: string; ssoToken?: string; error?: string }>;
}

export default async function LoginPage({ searchParams }: Props) {
  const params = await searchParams;
  const callbackUrl = params.callbackUrl ?? '/le-mie-istanze';

  // SSO callback: complete next-auth session creation client-side
  if (params.ssoToken) {
    return (
      <Suspense>
        <SsoHandoff ssoToken={params.ssoToken} callbackUrl={callbackUrl} />
      </Suspense>
    );
  }

  // SSO error: show a message with a retry link
  if (params.error) {
    const messages: Record<string, string> = {
      sso_init: 'Impossibile avviare il servizio di autenticazione. Riprova più tardi.',
      sso_invalid: 'Risposta non valida dal servizio di autenticazione.',
      sso_auth: 'Autenticazione non riuscita. Riprova.',
      sso_user: 'Impossibile leggere i dati utente dal servizio di autenticazione.',
      sso_db: 'Errore interno. Riprova più tardi.',
    };
    const message = messages[params.error] ?? 'Si è verificato un errore durante il login.';

    return (
      <div className="min-vh-100 d-flex align-items-center justify-content-center bg-light">
        <div className="container">
          <div className="row justify-content-center">
            <div className="col-md-8 col-lg-5">
              <div className="card shadow-sm">
                <div className="card-body p-4 text-center">
                  <p className="text-danger mb-4">{message}</p>
                  <a
                    href={`/api/auth/sso/logon?callbackUrl=${encodeURIComponent(callbackUrl)}`}
                    className="btn btn-primary"
                  >
                    Riprova con SPID / CIE
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Default: redirect directly to SSO
  redirect(`/api/auth/sso/logon?callbackUrl=${encodeURIComponent(callbackUrl)}`);
}
