/**
 * GET /api/auth/sso/logon?callbackUrl=<url>
 *
 * Step 1 of CIG SSO login:
 * - Builds the AuthRequest XML
 * - Calls Request2RID.jsp on the CIG SSO server
 * - Redirects the browser to AutRequest.do with the signed RID buffer
 */

import { NextRequest, NextResponse } from 'next/server';
import { CigClient, buildAuthRequestXml, PS2S } from '@/lib/auth/cig-client';

const SSO_URL = process.env.CIG_SSO_URL ?? 'https://www.comune.catania.it/sso/';
const SITE_URL = process.env.NEXTAUTH_URL ?? 'http://localhost:3000';
const STYLESHEET = process.env.CIG_STYLESHEET ?? '';
const LOGO_URL = process.env.CIG_LOGO_URL ?? '';

export async function GET(req: NextRequest) {
  const callbackUrl = req.nextUrl.searchParams.get('callbackUrl') ?? '/le-mie-istanze';

  const urlReturn = `${SITE_URL}/api/auth/sso/callback`;
  const urlErrore = `${SITE_URL}/login?error=sso`;

  const authXml = buildAuthRequestXml(urlReturn, urlErrore, STYLESHEET, LOGO_URL);

  const client = new CigClient();
  client.setServerUrl(`${SSO_URL}Request2RID.jsp`);

  const esito = await client.request2RID(authXml);

  if (esito !== PS2S.OK) {
    console.error('[SSO logon] request2RID failed:', esito);
    return NextResponse.redirect(new URL(`/login?error=sso_init`, req.url));
  }

  // Store the callbackUrl in a short-lived httpOnly cookie so the callback
  // route can redirect the user to the right destination after login.
  const redirectUrl = `${SSO_URL}AutRequest.do?buffer=${encodeURIComponent(client.netBuffer)}`;

  const response = NextResponse.redirect(redirectUrl);
  response.cookies.set('cig_sso_callback', callbackUrl, {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 300, // 5 minutes — enough for the SSO round-trip
    path: '/',
  });

  return response;
}
