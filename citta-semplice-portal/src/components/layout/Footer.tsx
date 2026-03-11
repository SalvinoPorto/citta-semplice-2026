export function Footer() {
  return (
    <footer id="Footer" className="it-footer">
      <div className="it-footer-main">
        <div className="container">
          <section>
            <div className="row">
              <div className="col-12 footer-items-wrapper logo-wrapper">
                <div className="it-brand-wrapper">
                  <a href="https://www.comune.catania.it" target="_blank" rel="noopener noreferrer">
                    <div className="it-brand-text">
                      <h2 className="no_toc">Comune di Catania</h2>
                    </div>
                  </a>
                </div>
              </div>
            </div>
          </section>
          <section className="py-4 border-white">
            <div className="row">
              <div className="col-md-3 footer-items-wrapper">
                <h3 className="footer-heading-title">Amministrazione</h3>
                <ul className="footer-list">
                  <li><a href="https://www.comune.catania.it/amministrazione/organi-di-governo/">Organi di governo</a></li>
                  <li><a href="https://www.comune.catania.it/amministrazione/aree-amministrative/">Aree amministrative</a></li>
                  <li><a href="https://www.comune.catania.it/amministrazione/uffici/">Uffici</a></li>
                </ul>
              </div>
              <div className="col-md-3 footer-items-wrapper">
                <h3 className="footer-heading-title">Servizi</h3>
                <ul className="footer-list">
                  <li><a href="/servizi">Tutti i servizi</a></li>
                  <li><a href="/le-mie-istanze">Le mie istanze</a></li>
                </ul>
              </div>
              <div className="col-md-3 footer-items-wrapper">
                <h3 className="footer-heading-title">Contatti</h3>
                <ul className="footer-list">
                  <li><a href="https://www.comune.catania.it/amministrazione/contatti/">Contatti</a></li>
                  <li><a href="https://www.comune.catania.it/trasparenza/">Amministrazione Trasparente</a></li>
                </ul>
              </div>
              <div className="col-md-3 footer-items-wrapper">
                <h3 className="footer-heading-title">Seguici su</h3>
                <ul className="footer-list">
                  <li>
                    <a href="https://www.facebook.com/pages/Comune-di-Catania/439675602754310" target="_blank" rel="noopener noreferrer">
                      Facebook
                    </a>
                  </li>
                  <li>
                    <a href="https://www.youtube.com/channel/UCGzL2M1pmX0s0iXrSg5W_EQ" target="_blank" rel="noopener noreferrer">
                      YouTube
                    </a>
                  </li>
                </ul>
              </div>
            </div>
          </section>
        </div>
      </div>
      <div className="it-footer-small-prints clearfix">
        <div className="container">
          <h3 className="visually-hidden">Sezione Link Utili</h3>
          <ul className="it-footer-small-prints-list list-inline mb-0 d-flex flex-column flex-md-row">
            <li className="list-inline-item">
              <a href="/privacy" data-element="privacy-policy-link">Privacy policy</a>
            </li>
            <li className="list-inline-item">
              <a href="/accessibilita" data-element="accessibility-link">Dichiarazione di accessibilità</a>
            </li>
          </ul>
        </div>
      </div>
    </footer>
  );
}
