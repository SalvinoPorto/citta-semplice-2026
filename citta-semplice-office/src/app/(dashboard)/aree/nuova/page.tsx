import { AreaForm } from '../area-form';

export default async function NuovaAreaPage() {
  
  return (
    <div>
      <div className="page-header">
        <h1>Nuova Area</h1>
        <p>Crea una nuova area servizi</p>
      </div>

      <AreaForm isNew />
    </div>
  );
}
