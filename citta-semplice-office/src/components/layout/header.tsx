'use client';

import Link from 'next/link';
import { signOut } from 'next-auth/react';
import { useState } from 'react';
import { UserData } from '@/lib/auth/user-context';
import { isAdmin, ROLES } from '@/lib/auth/roles';
import { Navbar } from './navbar';

interface HeaderProps {
  user: UserData;
}

export function Header({ user }: HeaderProps) {
  const [showUserMenu, setShowUserMenu] = useState(false);

  const handleLogout = async () => {
    await signOut({ redirect: false });
    window.location.href = '/login';
  };

  const getRoleBadge = () => {
    if (isAdmin(user.ruoli)) {
      return <span className="badge bg-danger ms-2">Admin</span>;
    }
    if (user.ruoli.includes(ROLES.GESTORE)) {
      return <span className="badge bg-warning ms-2">Gestore</span>;
    }
    return <span className="badge bg-info ms-2">Operatore</span>;
  };

  return (
    <header className="it-header-wrapper">
      <div className="it-header-slim-wrapper">
        <div className="container">
          <div className="row">
            <div className="col-12">
              <div className="it-header-slim-wrapper-content">
                <span className="d-none d-lg-block navbar-brand">
                  Reegione Siciliana
                </span>
                <div className="it-header-slim-right-zone">
                  <div className="dropdown">
                    <button
                      className="btn btn-primary btn-icon btn-full dropdown-toggle"
                      type="button"
                      onClick={() => setShowUserMenu(!showUserMenu)}
                      aria-expanded={showUserMenu}
                    >
                      <span className="rounded-icon">
                        <svg className="icon icon-primary">
                          <use href="/bootstrap-italia/dist/svg/sprites.svg#it-user"></use>
                        </svg>
                      </span>
                      <span className="d-none d-lg-block">
                        {user.nome} {user.cognome}
                        {getRoleBadge()}
                      </span>
                      <svg className="icon d-none d-lg-block">
                        <use href="/bootstrap-italia/dist/svg/sprites.svg#it-expand"></use>
                      </svg>
                    </button>
                    {showUserMenu && (
                      <div className="dropdown-menu show" style={{ right: 0, left: 'auto' }}>
                        <div className="row">
                          <div className="col-12">
                            <div className="px-3 py-2 border-bottom">
                              <div className="fw-bold">{user.nome} {user.cognome}</div>
                              <div className="small text-muted">{user.email}</div>
                              <div className="mt-1">
                                {user.ruoli.map((role) => (
                                  <span key={role} className="badge bg-secondary me-1">{role}</span>
                                ))}
                              </div>
                            </div>
                            <div className="link-list-wrapper">
                              <ul className="link-list">
                                <li>
                                  <Link
                                    className="dropdown-item list-item"
                                    href="/profilo"
                                    onClick={() => setShowUserMenu(false)}
                                  >
                                    <svg className="icon icon-sm me-2">
                                      <use href="/bootstrap-italia/dist/svg/sprites.svg#it-user"></use>
                                    </svg>
                                    <span>Il mio profilo</span>
                                  </Link>
                                </li>
                                <li>
                                  <button
                                    className="dropdown-item list-item text-danger"
                                    onClick={handleLogout}
                                  >
                                    <svg className="icon icon-sm me-2">
                                      <use href="/bootstrap-italia/dist/svg/sprites.svg#it-logout"></use>
                                    </svg>
                                    <span>Esci</span>
                                  </button>
                                </li>
                              </ul>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="it-nav-wrapper">
        <div className="it-header-center-wrapper">
          <div className="container">
            <div className="row">
              <div className="col-12">
                <div className="it-header-center-content-wrapper">
                  <div className="it-brand-wrapper">
                    <Link href="/">
                      <div className="it-brand-text">
                        <div className="it-brand-title">Citta Semplice</div>
                        <div className="it-brand-tagline d-none d-md-block">Portale delle istanza di parte</div>
                      </div>
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <Navbar userRoles={user.ruoli} />
      </div>
    </header>
  );
}
