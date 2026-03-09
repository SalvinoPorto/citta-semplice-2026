'use client';

import { createContext, useContext, ReactNode } from 'react';
import { isAdmin, hasPermission, hasRole, Permission, RoleName } from './roles';

export interface UserData {
  id: string;
  email: string;
  name: string;
  nome: string;
  cognome: string;
  ruoli: string[];
}

interface UserContextValue {
  user: UserData | null;
  isAdmin: boolean;
  hasPermission: (permission: Permission) => boolean;
  hasRole: (role: RoleName) => boolean;
}

const UserContext = createContext<UserContextValue>({
  user: null,
  isAdmin: false,
  hasPermission: () => false,
  hasRole: () => false,
});

interface UserProviderProps {
  children: ReactNode;
  user: UserData | null;
}

export function UserProvider({ children, user }: UserProviderProps) {
  const value: UserContextValue = {
    user,
    isAdmin: user ? isAdmin(user.ruoli) : false,
    hasPermission: (permission: Permission) =>
      user ? hasPermission(user.ruoli, permission) : false,
    hasRole: (role: RoleName) => (user ? hasRole(user.ruoli, role) : false),
  };

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
}

export function useUser() {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
}
