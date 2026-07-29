import { OperatoreForm } from '../operatore-form';
import { getOperatoreFormData } from '../form-data';
import Link from 'next/link';

export default async function NuovoOperatorePage() {
  const { ruoli, uffici, servizi } = await getOperatoreFormData();

  return (
    <div>
      <Link href="/amministrazione/operatori" className="btn btn-link p-0 mb-2">
        ← Torna a Operatori
      </Link>
      <div className="page-header">
        <h1>Nuovo Operatore</h1>
        <p>Crea un nuovo operatore del sistema</p>
      </div>

      <OperatoreForm
        ruoli={ruoli}
        uffici={uffici}
        servizi={servizi}
        isNew={true}
      />
    </div>
  );
}
