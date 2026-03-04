// Role constants
export const ROLES = {
  ADMIN: 'AMMINISTRATORE',
  OPERATORE: 'OPERATORE',
  GESTORE: 'GESTORE_MODULI',
} as const;

export type RoleName = (typeof ROLES)[keyof typeof ROLES];

// Permission constants
export const PERMISSIONS = {
  // Istanze
  ISTANZE_VIEW: 'istanze:view',
  ISTANZE_MANAGE: 'istanze:manage',

  // Moduli
  MODULI_VIEW: 'moduli:view',
  MODULI_MANAGE: 'moduli:manage',

  // Operatori
  OPERATORI_VIEW: 'operatori:view',
  OPERATORI_MANAGE: 'operatori:manage',

  // Organizzazione
  ENTI_VIEW: 'enti:view',
  ENTI_MANAGE: 'enti:manage',
  AREE_VIEW: 'aree:view',
  AREE_MANAGE: 'aree:manage',
  SERVIZI_VIEW: 'servizi:view',
  SERVIZI_MANAGE: 'servizi:manage',
  UFFICI_VIEW: 'uffici:view',
  UFFICI_MANAGE: 'uffici:manage',

  // Amministrazione
  ADMIN_ACCESS: 'admin:access',
  RUOLI_MANAGE: 'ruoli:manage',
  TRIBUTI_MANAGE: 'tributi:manage',
  EMAIL_CONFIG: 'email:config',

  // Statistiche e Ricerche
  STATISTICHE_VIEW: 'statistiche:view',
  RICERCHE_VIEW: 'ricerche:view',
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

// Role-based permissions
export const ROLE_PERMISSIONS: Record<RoleName, Permission[]> = {
  [ROLES.ADMIN]: Object.values(PERMISSIONS), // Admin has all permissions
  [ROLES.GESTORE]: [
    PERMISSIONS.ISTANZE_VIEW,
    PERMISSIONS.ISTANZE_MANAGE,
    PERMISSIONS.MODULI_VIEW,
    PERMISSIONS.MODULI_MANAGE,
  ],
  [ROLES.OPERATORE]: [
    PERMISSIONS.ISTANZE_VIEW,
    PERMISSIONS.ISTANZE_MANAGE,
    PERMISSIONS.MODULI_VIEW,
    PERMISSIONS.STATISTICHE_VIEW,
  ],
};

// Helper functions
export function hasRole(userRoles: string[], role: RoleName): boolean {
  return userRoles.includes(role);
}

export function hasAnyRole(userRoles: string[], roles: RoleName[]): boolean {
  return roles.some((role) => userRoles.includes(role));
}

export function isAdmin(userRoles: string[]): boolean {
  return hasRole(userRoles, ROLES.ADMIN);
}

export function hasPermission(userRoles: string[], permission: Permission): boolean {
  // Admin has all permissions
  if (isAdmin(userRoles)) {
    return true;
  }

  // Check if any of the user's roles has the permission
  return userRoles.some((roleName) => {
    const permissions = ROLE_PERMISSIONS[roleName as RoleName];
    return permissions?.includes(permission);
  });
}

export function getPermissions(userRoles: string[]): Permission[] {
  const permissions = new Set<Permission>();

  userRoles.forEach((roleName) => {
    const rolePermissions = ROLE_PERMISSIONS[roleName as RoleName];
    if (rolePermissions) {
      rolePermissions.forEach((p) => permissions.add(p));
    }
  });

  return Array.from(permissions);
}
