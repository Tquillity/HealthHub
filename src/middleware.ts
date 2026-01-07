import { NextResponse, type NextRequest } from 'next/server';
import { auth } from '@/lib/auth';

/**
 * Next.js Middleware for Authentication
 * 
 * Protects dashboard routes and redirects unauthenticated users to sign-in.
 * Redirects authenticated users away from auth pages to dashboard.
 * 
 * Uses Better-Auth's session API to check authentication status.
 */
export default async function authMiddleware(request: NextRequest) {
  // Get session using Better-Auth's API
  // In middleware, we need to create headers object from request
  const cookieHeader = request.headers.get('cookie') || '';
  const headers = new Headers();
  if (cookieHeader) {
    headers.set('cookie', cookieHeader);
  }
  
  const session = await auth.api.getSession({
    headers: headers,
  });

  const isAuthRoute = request.nextUrl.pathname.startsWith('/sign-in') || 
                     request.nextUrl.pathname.startsWith('/sign-up');
  const isDashboardRoute = request.nextUrl.pathname.startsWith('/dashboard') || 
                           request.nextUrl.pathname.startsWith('/recipes') ||
                           request.nextUrl.pathname.startsWith('/meal-planner') ||
                           request.nextUrl.pathname.startsWith('/routines') ||
                           request.nextUrl.pathname.startsWith('/groceries') ||
                           request.nextUrl.pathname.startsWith('/journal') ||
                           request.nextUrl.pathname.startsWith('/cycle') ||
                           request.nextUrl.pathname.startsWith('/learn') ||
                           request.nextUrl.pathname.startsWith('/profile');

  // Redirect unauthenticated users away from protected routes
  if (!session && isDashboardRoute) {
    return NextResponse.redirect(new URL('/sign-in', request.url));
  }

  // Redirect authenticated users away from auth pages
  if (session && isAuthRoute) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/recipes/:path*',
    '/meal-planner/:path*',
    '/routines/:path*',
    '/journal/:path*',
    '/groceries/:path*',
    '/cycle/:path*',
    '/learn/:path*',
    '/profile/:path*',
    '/sign-in',
    '/sign-up',
  ],
};

