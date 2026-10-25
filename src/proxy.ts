import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifyJWT, getJwtSecret } from '@/utils/auth';

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Paths that require authentication
  const isAdminPath = pathname.startsWith('/admin');
  const isCustomerPath = pathname.startsWith('/customer');
  const isAuthPath = pathname === '/login' || pathname === '/register';
  const isRootPath = pathname === '/';

  // Extract the JWT token from cookies
  const tokenCookie = request.cookies.get('aqua_token');
  const token = tokenCookie?.value;

  let decoded = null;
  if (token) {
    decoded = await verifyJWT(token, getJwtSecret());
  }

  // 1. Unauthenticated users trying to access protected paths or the root path
  if (!decoded && (isAdminPath || isCustomerPath || isRootPath)) {
    const loginUrl = new URL('/login', request.url);
    // If they were trying to access a specific dashboard page, preserve it as a redirect parameter
    if (!isRootPath) {
      loginUrl.searchParams.set('redirect', pathname);
    }
    return NextResponse.redirect(loginUrl);
  }

  // 2. Authenticated users trying to access login/register/root paths
  if (decoded) {
    if (isAuthPath || isRootPath) {
      if (decoded.role === 'ADMIN') {
        return NextResponse.redirect(new URL('/admin/dashboard', request.url));
      } else {
        return NextResponse.redirect(new URL('/customer/dashboard', request.url));
      }
    }

    // 3. Prevent Customers from accessing Admin routes
    if (isCustomerPath && decoded.role === 'ADMIN') {
      return NextResponse.redirect(new URL('/admin/dashboard', request.url));
    }

    // 4. Prevent Admins from accessing Customer routes
    if (isAdminPath && decoded.role === 'CUSTOMER') {
      return NextResponse.redirect(new URL('/customer/dashboard', request.url));
    }
  }

  // Allow the request to proceed if it matches no redirection criteria
  return NextResponse.next();
}

// Config to specify which paths the proxy runs on
export const config = {
  matcher: [
    '/',
    '/login',
    '/register',
    '/admin/:path*',
    '/customer/:path*',
  ],
};
