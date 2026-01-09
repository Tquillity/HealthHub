import { betterFetch } from '@better-fetch/fetch';
import { NextResponse, type NextRequest } from 'next/server';
import type { Session } from 'better-auth/types';

/**
 * Next.js Proxy (formerly Middleware) for Authentication
 *
 * Protects dashboard routes and redirects unauthenticated users to sign-in.
 * Redirects authenticated users away from auth pages to dashboard.
 *
 * Uses REST-based session check via @better-fetch/fetch to avoid Edge Runtime issues.
 * This bypasses the database connection (prisma) that would crash in Edge Runtime.
 */
export async function proxy(request: NextRequest) {
  // Use REST-based session check to avoid Edge Runtime Node.js module issues
  // This makes an HTTP request to the auth API endpoint instead of importing auth directly
  const { data: session } = await betterFetch<Session>('/api/auth/get-session', {
    baseURL: request.nextUrl.origin,
    headers: {
      cookie: request.headers.get('cookie') || '',
    },
  });

  const isAuthRoute =
    request.nextUrl.pathname.startsWith('/sign-in') ||
    request.nextUrl.pathname.startsWith('/sign-up');

  const isDashboardRoute =
    request.nextUrl.pathname.startsWith('/dashboard') ||
    request.nextUrl.pathname.startsWith('/recipes') ||
    request.nextUrl.pathname.startsWith('/meal-planner') ||
    request.nextUrl.pathname.startsWith('/routines') ||
    request.nextUrl.pathname.startsWith('/journal') ||
    request.nextUrl.pathname.startsWith('/groceries') ||
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


