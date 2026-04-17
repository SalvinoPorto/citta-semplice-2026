'use client';

import { useEffect } from 'react';
import { signIn } from 'next-auth/react';

interface Props {
  ssoToken: string;
  callbackUrl: string;
}

export function SsoHandoff({ ssoToken, callbackUrl }: Props) {
  useEffect(() => {
    signIn('cig-sso', { ssoToken, redirect: false })
      .then((result) => {
        if (!result?.ok || result?.error) {
          window.location.href = `/login?error=sso_auth&callbackUrl=${encodeURIComponent(callbackUrl)}`;
        } else {
          window.location.href = callbackUrl;
        }
      })
      .catch(() => {
        window.location.href = `/login?error=sso_auth&callbackUrl=${encodeURIComponent(callbackUrl)}`;
      });
  }, [ssoToken, callbackUrl]);

  return (
    <div className="min-vh-100 d-flex align-items-center justify-content-center bg-light">
      <div className="card shadow-sm">
        <div className="card-body p-4 text-center">
          <div className="spinner-border text-primary mb-3" role="status">
            <span className="visually-hidden">Accesso in corso…</span>
          </div>
          <p className="text-muted">Completamento accesso SPID / CIE…</p>
        </div>
      </div>
    </div>
  );
}
