import Link from 'next/link';

export function Header() {
  return (
    <header className="it-header-wrapper">
      {/* Slim header */}
      <div className="it-header-slim-wrapper">
        <div className="container">
          <div className="row">
            <div className="col-12">
              <div className="it-header-slim-wrapper-content">
                <a className="d-none d-lg-block navbar-brand" href="https://www.regione.sicilia.it" target="_blank" rel="noopener noreferrer">
                  Regione Sicilia
                </a>
                <div className="it-header-slim-right-zone">
                  <div className="it-access-top-wrapper">
                    <Link href="/login" className="btn btn-primary btn-sm">
                      Accedi
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Center header */}
      <div className="it-nav-wrapper">
        <div className="it-header-center-wrapper">
          <div className="container">
            <div className="row">
              <div className="col-12">
                <div className="it-header-center-content-wrapper">
                  <div className="it-brand-wrapper">
                    <a href="https://www.comune.catania.it" target="_blank" rel="noopener noreferrer">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        className="icon"
                        src="/images/stemma.png"
                        alt="Comune di Catania"
                        width="82"
                        height="82"
                      />
                      <div className="it-brand-text">
                        <div className="it-brand-title">Comune di Catania</div>
                        <div className="it-brand-tagline d-none d-md-block">Città Semplice</div>
                      </div>
                    </a>
                  </div>
                  <div className="it-right-zone">
                    <div className="it-socials d-none d-md-flex">
                      <span>Seguici su</span>
                      <ul>
                        <li>
                          <a href="https://www.facebook.com/pages/Comune-di-Catania/439675602754310" aria-label="Facebook" target="_blank" rel="noopener noreferrer">
                            <svg className="icon"><use href="/bootstrap-italia/dist/svg/sprites.svg#it-facebook" /></svg>
                          </a>
                        </li>
                        <li>
                          <a href="https://www.youtube.com/channel/UCGzL2M1pmX0s0iXrSg5W_EQ" aria-label="YouTube" target="_blank" rel="noopener noreferrer">
                            <svg className="icon"><use href="/bootstrap-italia/dist/svg/sprites.svg#it-youtube" /></svg>
                          </a>
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <div className="it-header-navbar-wrapper">
          <div className="container">
            <div className="row">
              <div className="col-12">
                <nav className="navbar navbar-expand-lg has-megamenu" aria-label="Navigazione principale">
                  <button
                    className="custom-navbar-toggler"
                    type="button"
                    aria-controls="nav01"
                    aria-expanded="false"
                    aria-label="Mostra/Nascondi la navigazione"
                    data-bs-toggle="navbarcollapsible"
                    data-bs-target="#nav01"
                  >
                    <svg className="icon bg-override">
                      <use href="/bootstrap-italia/dist/svg/sprites.svg#it-burger" />
                    </svg>
                  </button>
                  <div className="navbar-collapsible-wrapper" id="nav01">
                    <div className="navbar-collapsible-wrapper-overlay" data-bs-dismiss="navbarcollapsible" data-bs-target="#nav01" />
                    <div className="navbar-collapsible" id="navbarNav">
                      <div className="close-div">
                        <button className="btn close-menu-wrapper" type="button" data-bs-dismiss="navbarcollapsible" data-bs-target="#nav01">
                          <span className="it-close" />
                          Chiudi
                        </button>
                      </div>
                      <ul className="navbar-nav">
                        <li className="nav-item">
                          <Link className="nav-link" href="/servizi">
                            <span>Servizi</span>
                          </Link>
                        </li>
                        <li className="nav-item">
                          <Link className="nav-link" href="/le-mie-istanze">
                            <span>Le mie istanze</span>
                          </Link>
                        </li>
                      </ul>
                    </div>
                  </div>
                </nav>
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
