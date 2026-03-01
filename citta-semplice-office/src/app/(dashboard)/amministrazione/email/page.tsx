import Link from 'next/link';
import { requireAdmin } from '@/lib/auth/session';
import { getEmailConfig } from './actions';
import { EmailConfigForm } from './email-config-form';

export default async function EmailConfigPage() {
  await requireAdmin();
  const { data } = await getEmailConfig();

  return (
    <div>
      <div className="page-header">
        <div className="d-flex align-items-center gap-2 mb-2">
          <Link href="/amministrazione" className="btn btn-link p-0">
            ← Torna all&apos;amministrazione
          </Link>
        </div>
        <h1>Configurazione Email</h1>
        <p>Configura il sistema di invio email per le notifiche e comunicazioni.</p>
      </div>

      <EmailConfigForm initialData={data} />
    </div>
  );
}
