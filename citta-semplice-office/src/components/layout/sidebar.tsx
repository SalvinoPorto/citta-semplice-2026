'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import clsx from 'clsx';
import { isAdmin, hasPermission, PERMISSIONS, Permission } from '@/lib/auth/roles';

interface NavItem {
  href: string;
  label: string;
  icon?: string;
  permission?: Permission;
  adminOnly?: boolean;
  section?: string;
  children?: NavItem[];
}

const navItems: NavItem[] = [
  // Sezione Principale
  { href: '/', label: 'Dashboard', icon: 'it-pa', section: 'principale' },
  { href: '/istanze', label: 'Istanze', icon: 'it-files', permission: PERMISSIONS.ISTANZE_VIEW, section: 'principale' },

  // Sezione Organizzazione (Admin)
  { href: '/enti', label: 'Enti', icon: 'it-pa', permission: PERMISSIONS.ENTI_VIEW, section: 'organizzazione' },
  { href: '/aree', label: 'Aree', icon: 'it-folder', permission: PERMISSIONS.AREE_VIEW, section: 'organizzazione' },
  { href: '/servizi', label: 'Servizi', icon: 'it-settings', permission: PERMISSIONS.SERVIZI_VIEW, section: 'organizzazione' },
  { href: '/uffici', label: 'Uffici', icon: 'it-map-marker-circle', permission: PERMISSIONS.UFFICI_VIEW, section: 'organizzazione' },

  // Sezione Utenti (Admin)
  { href: '/operatori', label: 'Operatori', icon: 'it-user', permission: PERMISSIONS.OPERATORI_VIEW, section: 'utenti' },

  // Sezione Report
  { href: '/statistiche', label: 'Statistiche', icon: 'it-chart-line', permission: PERMISSIONS.STATISTICHE_VIEW, section: 'report' },
  { href: '/ricerche', label: 'Ricerche', icon: 'it-search', permission: PERMISSIONS.RICERCHE_VIEW, section: 'report' },

  // Sezione Amministrazione (Admin only)
  { href: '/amministrazione', label: 'Amministrazione', icon: 'it-tool', adminOnly: true, section: 'admin' },
];

const sectionLabels: Record<string, string> = {
  principale: 'Principale',
  configurazione: 'Configurazione',
  organizzazione: 'Organizzazione',
  utenti: 'Utenti',
  report: 'Report',
  admin: 'Sistema',
};

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
  userRoles: string[];
}

export function Sidebar({ isOpen = true, onClose, userRoles }: SidebarProps) {
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === '/') {
      return pathname === '/';
    }
    return pathname.startsWith(href);
  };

  // Filter items based on user permissions
  const filteredItems = navItems.filter((item) => {
    // Admin-only items
    if (item.adminOnly) {
      return isAdmin(userRoles);
    }
    // Items with specific permission
    if (item.permission) {
      return hasPermission(userRoles, item.permission);
    }
    // Items without permission requirement (visible to all)
    return true;
  });

  // Group items by section
  const sections = filteredItems.reduce((acc, item) => {
    const section = item.section || 'principale';
    if (!acc[section]) {
      acc[section] = [];
    }
    acc[section].push(item);
    return acc;
  }, {} as Record<string, NavItem[]>);

  const sectionOrder = ['principale', 'configurazione', 'organizzazione', 'utenti', 'report', 'admin'];

  return (
    <>
      {/* Overlay for mobile */}
      {isOpen && (
        <div
          className="sidebar-overlay d-lg-none"
          onClick={onClose}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            zIndex: 999,
          }}
        />
      )}

      <aside
        className={clsx(
          'sidebar-wrapper',
          isOpen ? 'sidebar-open' : 'sidebar-closed'
        )}
      >
        <nav className="navbar navbar-expand-lg it-navscroll-wrapper">
          <div className="menu-wrapper">
            {sectionOrder.map((sectionKey) => {
              const items = sections[sectionKey];
              if (!items || items.length === 0) return null;

              return (
                <div key={sectionKey} className="link-list-wrapper mb-3">
                  {sectionKey !== 'principale' && (
                    <h6 className="sidebar-section-title px-3 mb-2 text-uppercase text-muted small">
                      {sectionLabels[sectionKey]}
                    </h6>
                  )}
                  <ul className="link-list">
                    {items.map((item) => (
                      <li key={item.href} className="nav-item">
                        <Link
                          href={item.href}
                          className={clsx(
                            'nav-link list-item',
                            isActive(item.href) && 'active'
                          )}
                          onClick={onClose}
                        >
                          {item.icon && (
                            <svg className="icon icon-sm me-2">
                              <use href={`/bootstrap-italia/dist/svg/sprites.svg#${item.icon}`}></use>
                            </svg>
                          )}
                          <span>{item.label}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </nav>
      </aside>
    </>
  );
}
