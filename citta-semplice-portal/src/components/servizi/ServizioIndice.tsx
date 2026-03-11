'use client';

interface Servizio {
  descrizione?: string | null;
  comeFare?: string | null;
  cosaServe?: string | null;
  altreInfo?: string | null;
  contatti?: string | null;
}

export function ServizioIndice({ servizio }: { servizio: Servizio }) {
  const voci = [
    { id: 'description', label: 'Descrizione', show: !!servizio.descrizione },
    { id: 'how-to', label: 'Come fare', show: !!servizio.comeFare },
    { id: 'needed', label: 'Cosa serve', show: !!servizio.cosaServe },
    { id: 'obtain', label: 'Ulteriori informazioni', show: !!servizio.altreInfo },
    { id: 'contacts', label: 'Contatti', show: !!servizio.contatti },
    { id: 'submit-request', label: 'Accedi al servizio', show: true },
  ].filter((v) => v.show);

  const scroll = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <nav className="navbar it-navscroll-wrapper navbar-expand-lg it-top-navscroll" aria-label="Indice della pagina">
      <button
        className="custom-navbar-toggler"
        type="button"
        aria-controls="navbarNav"
        aria-expanded="false"
        aria-label="Mostra/Nascondi la navigazione"
      >
        <span className="rounded-icon">
          <svg className="icon icon-primary">
            <use href="/bootstrap-italia/dist/svg/sprites.svg#it-expand" />
          </svg>
        </span>
        <span>Indice della pagina</span>
      </button>
      <div className="navbar-collapsible-wrapper">
        <div className="navbar-collapsible" id="navbarNav">
          <div className="menu-wrapper">
            <div className="link-list-wrapper">
              <h3 className="no_toc">Indice della pagina</h3>
              <ul className="link-list">
                {voci.map((voce) => (
                  <li key={voce.id}>
                    <button
                      className="btn btn-link list-item p-0 text-start"
                      onClick={() => scroll(voce.id)}
                    >
                      <span>{voce.label}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}
