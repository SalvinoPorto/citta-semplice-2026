/**
 * Short-lived HMAC-SHA256 tokens for the CIG SSO handoff.
 *
 * After the CIG callback validates the TID, the server signs a one-time token
 * containing the user's codice fiscale. The login page reads this token from
 * the URL, passes it to the `cig-sso` CredentialsProvider, which verifies it
 * and creates the next-auth session.
 *
 * Token format (base64url-encoded): `<expiry>|<cf>|<hmac>`
 * Lifetime: 2 minutes (enough for the browser redirect round-trip).
 */

import { createHmac, timingSafeEqual } from 'crypto';

const LIFETIME_MS = 2 * 60 * 1000; // 2 minutes
const SEP = '|';

function secret(): string {
  const s = process.env.NEXTAUTH_SECRET;
  if (!s) throw new Error('NEXTAUTH_SECRET is not set');
  return s;
}

function sign(payload: string): string {
  return createHmac('sha256', secret()).update(payload).digest('hex');
}

export function signSsoToken(codiceFiscale: string): string {
  const expiry = Date.now() + LIFETIME_MS;
  const payload = `${expiry}${SEP}${codiceFiscale}`;
  const hmac = sign(payload);
  return Buffer.from(`${payload}${SEP}${hmac}`).toString('base64url');
}

export function verifySsoToken(token: string): string | null {
  try {
    const decoded = Buffer.from(token, 'base64url').toString('utf-8');
    // Format: expiry|cf|hmac  (CF contains only letters/digits, no `|`)
    const firstSep = decoded.indexOf(SEP);
    const lastSep = decoded.lastIndexOf(SEP);
    if (firstSep === lastSep) return null; // malformed

    const payload = decoded.substring(0, lastSep);
    const hmac = decoded.substring(lastSep + 1);

    const expectedHmac = sign(payload);
    // Constant-time comparison to prevent timing attacks
    if (!timingSafeEqual(Buffer.from(hmac, 'hex'), Buffer.from(expectedHmac, 'hex'))) {
      return null;
    }

    const expiry = parseInt(decoded.substring(0, firstSep), 10);
    if (Date.now() > expiry) return null; // expired

    const cf = decoded.substring(firstSep + 1, lastSep);
    if (!cf) return null;

    return cf;
  } catch {
    return null;
  }
}
