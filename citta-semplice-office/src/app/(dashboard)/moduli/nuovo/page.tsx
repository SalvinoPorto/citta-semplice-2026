import { ModuloForm } from '../modulo-form';

export default async function NuovoModuloPage() {
  return (
    <div>
      <div className="page-header">
        <h1>Nuovo Modulo</h1>
        <p>Crea un nuovo template form</p>
      </div>

      <ModuloForm isNew />
    </div>
  );
}
