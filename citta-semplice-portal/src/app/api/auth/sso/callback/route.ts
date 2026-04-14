/**
 * GET /api/auth/sso/callback?buffer=<TID>
 *
 * Step 2 of CIG SSO login (called by the SSO server after authentication):
 * - Exchanges the TID buffer for the user's data via TID2Ticket.jsp
 * - Upserts the Utente record in the database
 * - Signs a short-lived SSO token containing the codice fiscale
 * - Redirects to /login?ssoToken=<token> for next-auth session creation
 */

import { NextRequest, NextResponse } from 'next/server';
import { CigClient, parseUserXml, PS2S } from '@/lib/auth/cig-client';
import { signSsoToken } from '@/lib/auth/sso-token';
import { prisma } from '@/lib/db/prisma';

const SSO_URL = process.env.CIG_SSO_URL ?? 'https://www.comune.catania.it/sso/';
const SITE_URL = process.env.NEXTAUTH_URL ?? 'http://localhost:3000';

export async function GET(req: NextRequest) {
  const buffer = req.nextUrl.searchParams.get('buffer');

  if (!buffer) {
    console.error('[SSO callback] missing buffer parameter');
    return NextResponse.redirect(new URL('/login?error=sso_invalid', req.url));
  }

  // Exchange TID for user data
  const client = new CigClient();
  client.setServerUrl(`${SSO_URL}TID2Ticket.jsp`);

  const esito = await client.tid2Ticket(buffer);

  if (esito !== PS2S.OK) {
    console.error('[SSO callback] tid2Ticket failed:', esito);
    return NextResponse.redirect(new URL('/login?error=sso_auth', req.url));
  }

  const userData = parseUserXml(client.dataBuffer);
  if (!userData) {
    console.error('[SSO callback] failed to parse user XML:\n', client.dataBuffer);
    return NextResponse.redirect(new URL('/login?error=sso_user', req.url));
  }

  // Upsert the citizen record
  try {
    await prisma.utente.upsert({
      where: { codiceFiscale: userData.codiceFiscale },
      create: {
        codiceFiscale: userData.codiceFiscale,
        nome: userData.nome || 'N/D',
        cognome: userData.cognome || 'N/D',
        email: userData.email,
        luogoNascita: userData.luogoNascita,
        dataNascita: userData.dataNascita ? new Date(userData.dataNascita) : null,
      },
      update: {
        // Update identity data on each SSO login (SPID/CIE data is authoritative)
        nome: userData.nome || undefined,
        cognome: userData.cognome || undefined,
        email: userData.email ?? undefined,
        luogoNascita: userData.luogoNascita ?? undefined,
        dataNascita: userData.dataNascita ? new Date(userData.dataNascita) : undefined,
      },
    });
  } catch (err) {
    console.error('[SSO callback] DB upsert failed:', err);
    return NextResponse.redirect(new URL('/login?error=sso_db', req.url));
  }

  // Sign a short-lived token and hand off to the login page
  const ssoToken = signSsoToken(userData.codiceFiscale);

  const callbackUrl =
    req.cookies.get('cig_sso_callback')?.value ?? '/le-mie-istanze';

  const redirectTarget = new URL('/login', SITE_URL);
  redirectTarget.searchParams.set('ssoToken', ssoToken);
  redirectTarget.searchParams.set('callbackUrl', callbackUrl);

  const response = NextResponse.redirect(redirectTarget);
  // Clear the state cookie
  response.cookies.delete('cig_sso_callback');

  return response;
}
