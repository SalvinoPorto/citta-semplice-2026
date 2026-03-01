import { Suspense } from 'react';
import { LoginForm } from './login-form';

function LoginFallback() {
  return (
    <div className="card">
      <div className="card-body">
        <h2 className="h5 mb-4 text-center">Accedi al sistema</h2>
        <div className="text-center py-4">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Caricamento...</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="min-vh-100 d-flex align-items-center justify-content-center bg-light">
      <div className="container">
        <div className="row justify-content-center">
          <div className="col-md-6 col-lg-4">
            <div className="text-center mb-4">
              <h1 className="h3 mb-2">Citta Semplice Office</h1>
              <p className="text-muted">Backoffice Istanze Online</p>
            </div>

            <Suspense fallback={<LoginFallback />}>
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
