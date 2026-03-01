import { EnteForm } from '../ente-form';

export default function NuovoEntePage() {
  return (
    <div>
      <div className="page-header">
        <h1>Nuovo Ente</h1>
        <p>Crea una nuova organizzazione</p>
      </div>

      <EnteForm isNew />
    </div>
  );
}
