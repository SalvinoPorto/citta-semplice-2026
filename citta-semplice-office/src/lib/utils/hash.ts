import { createHash } from 'crypto';

export function generateFileHash(
  istanzaId: number,
  operatore: string,
  fileName: string
): string {
  const data = `${istanzaId}-${operatore}-${fileName}-${Date.now()}`;
  return createHash('sha256').update(data).digest('hex');
}

export function hashString(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

export function generateRandomString(length: number = 32): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  const randomValues = new Uint32Array(length);
  crypto.getRandomValues(randomValues);
  for (let i = 0; i < length; i++) {
    result += chars[randomValues[i] % chars.length];
  }
  return result;
}
