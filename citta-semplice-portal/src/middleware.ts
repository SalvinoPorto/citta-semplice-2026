import { auth } from '@/lib/auth/config';
import { NextResponse } from 'next/server';

export default auth((req) => {
  const { nextUrl, auth: session } = req;
  const isLoggedIn = !!session;
  const isAuthPage = nextUrl.pathname.startsWith('/login');
  const isProtected = nextUrl.pathname.startsWith('/le-mie-istanze');

  if (isProtected && !isLoggedIn) {
    return NextResponse.redirect(
      new URL(`/login?callbackUrl=${encodeURIComponent(nextUrl.pathname)}`, nextUrl)
    );
  }

  if (isAuthPage && isLoggedIn) {
    return NextResponse.redirect(new URL('/le-mie-istanze', nextUrl));
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|bootstrap-italia|images).*)',
  ],
};
