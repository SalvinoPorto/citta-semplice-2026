import { auth } from './index';
import { redirect } from 'next/navigation';
import { isAdmin, hasPermission, Permission, ROLES } from './roles';

export async function getSession() {
  return await auth();
}

export async function getCurrentUser() {
  const session = await getSession();
  return session?.user;
}

export async function requireAuth() {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/login');
  }
  return user;
}

export async function requireRole(allowedRoles: string[]) {
  const user = await requireAuth();
  const hasRole = user.ruoli.some((role) => allowedRoles.includes(role));
  if (!hasRole) {
    redirect('/non-autorizzato');
  }
  return user;
}

export async function requireAdmin() {
  const user = await requireAuth();
  if (!isAdmin(user.ruoli)) {
    redirect('/non-autorizzato');
  }
  return user;
}

export async function requirePermission(permission: Permission) {
  const user = await requireAuth();
  if (!hasPermission(user.ruoli, permission)) {
    redirect('/non-autorizzato');
  }
  return user;
}

export async function checkAdmin() {
  const user = await getCurrentUser();
  return user ? isAdmin(user.ruoli) : false;
}

export async function checkPermission(permission: Permission) {
  const user = await getCurrentUser();
  return user ? hasPermission(user.ruoli, permission) : false;
}
