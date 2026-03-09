import { isAdmin, hasRole } from '@/lib/auth/roles';
import Link from "next/link";

interface NavbarProps {
    userRoles: string[];
}

export function Navbar({ userRoles }: NavbarProps) {
    return (
        <div className="it-header-navbar-wrapper">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <nav className="navbar navbar-expand-lg has-megamenu" aria-label="Navigazione principale">
                            <button className="custom-navbar-toggler" type="button" aria-controls="nav0" aria-expanded="false" aria-label="Mostra/Nascondi la navigazione" data-bs-toggle="navbarcollapsible" data-bs-target="#nav0" data-focus-mouse="false">
                                <svg className="icon bg-override"><use href="/bootstrap-italia/dist/svg/sprites.svg#it-burger"></use></svg>
                            </button>
                            <div className="navbar-collapsable" id="nav0" aria-hidden="true">
                                <div className="overlay fade" ></div>
                                <div className="close-div">
                                    <button className="btn close-menu" type="button" data-focus-mouse="false">
                                        <span className="visually-hidden">Nascondi la navigazione</span>
                                        <svg className="icon"><use href="/bootstrap-italia/dist/svg/sprites.svg#it-close-big"></use></svg>
                                    </button>
                                </div>
                                <div className="menu-wrapper">
                                    <ul className="navbar-nav">
                                        <li className="nav-item active">
                                            <Link className="nav-link" href="/" aria-current="page"><span>Dashboard</span></Link>
                                        </li>
                                        <li className="nav-item">
                                            <Link className="nav-link" href="/istanze" ><span>Istanze</span></Link>
                                        </li>
                                        {(hasRole(userRoles, 'GESTORE_SERVIZI')) &&
                                            <li className="nav-item dropdown">
                                                <Link className="nav-link dropdown-toggle" href="#" role="button" data-bs-toggle="dropdown" aria-expanded="false" id="mainNavDropdown0">
                                                    <span>Configurazione</span>
                                                    <svg className="icon icon-xs"><use href="/bootstrap-italia/dist/svg/sprites.svg#it-expand"></use></svg>
                                                </Link>
                                                <div className="dropdown-menu" role="region" aria-labelledby="mainNavDropdown0">
                                                    <div className="link-list-wrapper">
                                                        <ul className="link-list">
                                                            <li><Link className="dropdown-item list-item" href="/servizi"><span>Servizi</span></Link></li>
                                                            <li><span className="divider"></span></li>
                                                        </ul>
                                                    </div>
                                                </div>
                                            </li>
                                        }
                                        <li className="nav-item dropdown">
                                            <Link className="nav-link dropdown-toggle" href="#" role="button" data-bs-toggle="dropdown" aria-expanded="false" id="mainNavDropdown0">
                                                <span>Report</span>
                                                <svg className="icon icon-xs"><use href="/bootstrap-italia/dist/svg/sprites.svg#it-expand"></use></svg>
                                            </Link>
                                            <div className="dropdown-menu" role="region" aria-labelledby="mainNavDropdown0">
                                                <div className="link-list-wrapper">
                                                    <ul className="link-list">
                                                        <li><Link className="dropdown-item list-item" href="/statistiche"><span>Statistiche</span></Link></li>
                                                        <li><Link className="dropdown-item list-item" href="/ricerche"><span>Ricerche</span></Link></li>
                                                    </ul>
                                                </div>
                                            </div>
                                        </li>
                                        {isAdmin(userRoles) &&
                                            <li className="nav-item">
                                                <Link className="nav-link" href="/amministrazione">
                                                    <span>Amministrazione</span>
                                                </Link>
                                            </li>
                                        }
                                    </ul>
                                </div>
                            </div>
                        </nav>
                    </div>
                </div>
            </div>
        </div>
    )
}