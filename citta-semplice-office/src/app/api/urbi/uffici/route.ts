import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/session';
import { getElencoUffici } from '@/lib/services/protocollazione/UrbiProtocolloService';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
  }

  const uffici = await getElencoUffici();
  return NextResponse.json({ uffici });
}
