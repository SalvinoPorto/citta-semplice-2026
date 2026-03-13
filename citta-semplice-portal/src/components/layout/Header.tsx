import Link from 'next/link';
import NavBar from "./nav-bar";

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
                  <Link href="/login" className="btn-full btn-icon btn btn-primary" type="button">
                    <span className="rounded-icon">
                      <svg className="icon icon-primary" aria-hidden="true">
                        <use href="/bootstrap-italia/dist/svg/sprites.svg#it-user"></use>
                      </svg>
                    </span>
                    <span className="d-none d-lg-block">Accedi all'area personale</span>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Center header */}
      <div className="it-nav-wrapper">
        <div className="it-header-center-wrapper it-small-header">
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
                          <a href="https://twitter.com/ComunediCatania" aria-label="Twitter" target="_blank">
                            <svg className="icon" aria-hidden="true"><use href="/bootstrap-italia/dist/svg/sprites.svg#it-twitter" xlinkHref="/bootstrap-italia/dist/svg/sprites.svg#it-twitter"></use></svg>
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
        <NavBar />
      </div>
    </header>
  );
}
