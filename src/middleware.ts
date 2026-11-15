import { NextResponse, type NextRequest } from 'next/server';

import { SESSION_COOKIE } from '@/lib/auth/shared';

// Cookie presence and redirects only. Real authorization is requireTeam() / requireAdmin() and
// withTeam() / withAdmin() (TRD §5.3).

export function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  if (pathname === '/admin/login' || req.cookies.has(SESSION_COOKIE)) return NextResponse.next();

  const isAdminArea = pathname === '/screen' || pathname.startsWith('/admin');
  const loginPath = isAdminArea ? '/ctf/admin/login' : '/ctf/login';
  const query = isAdminArea ? '' : `?${new URLSearchParams({ next: pathname + search })}`;
  // Relative Location keeps the public host and scheme behind reverse proxies.
  return new NextResponse(null, {
    status: 307,
    headers: { Location: loginPath + query },
  });
}

export const config = {
  matcher: [
    '/dashboard',
    '/challenge/:path*',
    '/toolkit',
    '/manual',
    '/coordinates',
    '/leaderboard',
    '/finale',
    '/vault/:path*',
    '/screen',
    '/admin/:path*',
  ],
};
