import { UfficioForm } from '../ufficio-form';

export default function NuovoUfficioPage() {
  return (
    <div>
      <div className="page-header">
        <h1>Nuovo Ufficio</h1>
        <p>Crea un nuovo ufficio</p>
      </div>

      <UfficioForm isNew />
    </div>
  );
}
