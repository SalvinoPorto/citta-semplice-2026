/**
 * Origin pubblica del portale: quella che il browser del cittadino raggiunge.
 *
 * Non basta `req.nextUrl.origin`. Nel build standalone (l'immagine Docker)
 * vale l'indirizzo su cui ascolta il server, es. `http://0.0.0.0:3000`, non
 * quello digitato dal cittadino: l'URL di ritorno inviato all'SSO puntava lì e
 * il login si interrompeva dopo l'autenticazione SPID/CIE. In `next dev` il
 * problema non si vede perché le due origin coincidono.
 *
 * Stessa regola di Auth.js (`reqWithEnvURL` in next-auth): AUTH_URL, poi
 * NEXTAUTH_URL, poi l'origin della richiesta. Così i redirect delle route SSO e
 * quelli di `proxy.ts` concordano sempre.
 */
export function originPubblica(req: { nextUrl: { origin: string } }): string {
  const url = process.env.AUTH_URL || process.env.NEXTAUTH_URL;
  return url ? new URL(url).origin : req.nextUrl.origin;
}
