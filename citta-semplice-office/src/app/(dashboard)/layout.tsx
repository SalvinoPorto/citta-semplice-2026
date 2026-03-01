import { MainLayout } from '@/components/layout';
import { requireAuth } from '@/lib/auth/session';
import { UserProvider, UserData } from '@/lib/auth/user-context';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const sessionUser = await requireAuth();

  const user: UserData = {
    id: sessionUser.id,
    email: sessionUser.email || '',
    name: sessionUser.name || '',
    nome: sessionUser.nome,
    cognome: sessionUser.cognome,
    ruoli: sessionUser.ruoli,
    entiIds: sessionUser.entiIds,
  };

  return (
    <UserProvider user={user}>
      <MainLayout user={user}>{children}</MainLayout>
    </UserProvider>
  );
}
