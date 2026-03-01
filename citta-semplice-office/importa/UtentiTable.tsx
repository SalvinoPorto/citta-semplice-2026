'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { TFilterHead } from '@/app/components/TFilterHead'
import { TFilterHeadGroup } from '@/app/components/TFilterHeadGroup'
import { THead, THeadGroup } from '@/app/components/THeadGroup'
import Paginatore from '@/app/components/paginatore'
import Link from 'next/link'
import { Order } from '@/app/lib/models/table'
import { BaseRequest, Filter } from '@/app/lib/models/request'
import { useRouter } from 'next/navigation'
import { Utente } from '@/app/lib/Entities/Utente'

const tipoLabels: { [key: number]: string } = {
    0: 'Non attivo',
    1: 'Locale',
    2: 'LDAP Email',
    3: 'LDAP AD'
}

export default function UtentiTable() {
    const router = useRouter();
    const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';
    const [utenti, setUtenti] = useState<Utente[]>([])
    const [page, setPage] = useState(1)
    const [pages, setPages] = useState(0)
    const [filters, setFilters] = useState<Filter[]>([])
    const [order, setOrder] = useState<Order>({ field: 'id', direction: 1 })
    const [loading, setLoading] = useState(true)
    const prevPage = useRef(1);

    const fetchData = useCallback(() => {
        setLoading(true)
        fetch(`${basePath}/api/utenti/paged`, {
            method: 'POST',
            body: JSON.stringify({ page, pages, filters, order } as BaseRequest),
            headers: { 'Content-Type': 'application/json' },
        })
            .then((r) => {
                if (r.status === 401) {
                    // Sessione scaduta: redirect al login
                    router.push(`/login`);
                    return null;
                }
                if (!r.ok) {
                    throw new Error('Errore HTTP: ' + r.status);
                }
                return r.json();
            })
            .then((data) => {
                if (!data) return; // Skip se redirect per 401
                setUtenti(data.content);
                setPages(data.totalPages);
                if (page === prevPage.current) {
                    setPage(1);
                }
                prevPage.current = page;
            })
            .catch((err) => {
                console.error(err);
            })
            .finally(() => setLoading(false))
    }, [page, pages, filters, order, router, basePath])

    useEffect(() => {
        fetchData()
    }, [fetchData])

    return (
        <div className="row">
            <div className="col-sm-12">
                <table className="table table-bordered table-striped">
                    <THeadGroup onChange={(e) => setOrder(e)}>
                        <THead field="id" width="5%">ID</THead>
                        <THead field="userid" width="15%">Username</THead>
                        <THead field="nome" width="25%">Nome</THead>
                        <THead field="tipo" width="10%">Tipo</THead>
                        <THead field="ruolo" width="10%">Ruolo</THead>
                        <THead field="direzione" width="15%">Direzione</THead>
                        <THead field="qualifica" width="15%">Qualifica</THead>
                        <THead field="" width="5%">&nbsp;</THead>
                    </THeadGroup>
                    <TFilterHeadGroup onFilter={(e) => { setFilters(e) }} >
                        <TFilterHead />
                        <TFilterHead field="userid" placeholder="Cerca username" />
                        <TFilterHead field="nome" placeholder="Cerca nome" />
                        <TFilterHead />
                        <TFilterHead field="ruolo" placeholder="Cerca ruolo" />
                        <TFilterHead field="direzione" placeholder="Cerca direzione" />
                        <TFilterHead field="qualifica" placeholder="Cerca qualifica" />
                        <TFilterHead />
                    </TFilterHeadGroup>
                    <tbody>
                        {loading ? (
                            <>
                                {[...Array(3)].map((_, i) => (
                                    <tr key={i} style={{ height: '20px', background: '#eee', marginBottom: '8px', borderRadius: 4 }} />
                                ))}
                            </>
                        ) : (
                            <>
                                {utenti.map((item, index) => (
                                    <tr key={index}>
                                        <td>{item.id}</td>
                                        <td>{item.userid}</td>
                                        <td>{item.nome}</td>
                                        <td>
                                            <span className={`badge ${item.tipo === 0 ? 'bg-secondary' : item.tipo === 1 ? 'bg-primary' : 'bg-info'}`}>
                                                {tipoLabels[item.tipo || 0]}
                                            </span>
                                        </td>
                                        <td>
                                            <span className={`badge ${item.ruolo === 'Admin' ? 'bg-danger' : 'bg-success'}`}>
                                                {item.ruolo}
                                            </span>
                                        </td>
                                        <td>{item.direzione}</td>
                                        <td>{item.qualifica}</td>
                                        <td className="text-center">
                                            <Link href={`/utente/${item.id}`} className="btn btn-sm btn-outline-primary" title="Modifica utente">
                                                <i className="fa fa-eye"></i>
                                            </Link>
                                        </td>
                                    </tr>
                                ))}
                            </>
                        )}
                    </tbody>
                </table>
                <nav>
                    <Paginatore page={page} pages={pages} onChange={(e) => setPage(e)} />
                </nav>
            </div>
        </div>
    )
}
