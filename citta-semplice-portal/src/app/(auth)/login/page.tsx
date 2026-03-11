import { Suspense } from 'react';
import { LoginForm } from './login-form';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Accedi - Città Semplice',
};

export default function LoginPage() {
  return (
    <div className="min-vh-100 d-flex align-items-center justify-content-center bg-light">
      <div className="container">
        <div className="row justify-content-center">
          <div className="col-md-8 col-lg-5">
            <div className="text-center mb-4">
              <h1 className="h3 mb-2">Città Semplice</h1>
              <p className="text-muted">Portale dei Servizi Online - Comune di Catania</p>
            </div>

            <Suspense
              fallback={
                <div className="card p-4 text-center">
                  <div className="spinner-border text-primary mx-auto" role="status">
                    <span className="visually-hidden">Caricamento...</span>
                  </div>
                </div>
              }
            >
              <LoginForm />
            </Suspense>

            <p className="text-center mt-4 text-muted small">
              Comune di Catania - Istanze Online
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
