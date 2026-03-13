"use client";

import Link from "next/link";

export default function NavBar() {
    return (
        <div className="it-header-navbar-wrapper">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        {/* <!-- Topmenu --> */}
                        <nav className="navbar navbar-expand-lg has-megamenu" aria-label="Menu Principale">
                            <button className="custom-navbar-toggler" type="button" aria-controls="menu" aria-expanded="false" aria-label="Toggle navigation" data-bs-toggle="navbarcollapsible" data-bs-target="#nav10">
                                <svg className="icon">
                                    <use xlinkHref={`${process.env.NEXT_PUBLIC_BASE_PATH}/bootstrap-italia/dist/svg/sprites.svg#it-burger`}></use>
                                </svg>
                            </button>
                            <div className="navbar-collapsable" id="nav10">
                                <div className="overlay fade"></div>
                                <div className="menu-wrapper justify-content-between">
                                    <div className="close-div">
                                        <button className="btn close-menu" type="button">
                                            <svg className="icon icon-primary">
                                                <use xlinkHref={`${process.env.NEXT_PUBLIC_BASE_PATH}/bootstrap-italia/dist/svg/sprites.svg#it-close-circle`}></use>
                                            </svg>
                                            <span className="sr-only">Chiudi</span>
                                        </button>
                                    </div>
                                    <ul className="navbar-nav" data-element="main-navigation">
                                        <li className="nav-item ">
                                            <Link className="nav-link" href="/servizi">
                                                <span>Servizi</span>
                                            </Link>
                                        </li>
                                        <li className="nav-item ">
                                            <Link className="nav-link" href="/le-mie-istanze">
                                                <span>Le mie istanze</span>
                                            </Link>
                                        </li>                                        
                                    </ul>
                                </div>
                            </div>
                        </nav>
                        {/* <!-- End Topmenu --> */}
                    </div>
                </div>
            </div>
        </div>
    );
}