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
  const pathname = request.nextUrl.pathname;

  // Use REST-based session check to avoid Edge Runtime Node.js module issues
  // This makes an HTTP request to the auth API endpoint instead of importing auth directly
  let session: Session | null = null;
  try {
    const result = await betterFetch<Session>('/api/auth/get-session', {
      baseURL: request.nextUrl.origin,
      headers: {
        cookie: request.headers.get('cookie') || '',
      },
    });

    session = result.data ?? null;
  } catch (error) {
    console.error('[HealthHub proxy] Session lookup failed:', {
      pathname,
      error,
    });
  }

  const isAuthRoute =
    pathname.startsWith('/sign-in') || pathname.startsWith('/sign-up');

  const isProtectedRecipeRoute =
    pathname === '/recipes/new' || /^\/recipes\/[^/]+\/edit\/?$/.test(pathname);
  const isProtectedRoute =
    pathname.startsWith('/dashboard') ||
    pathname.startsWith('/meal-planner') ||
    pathname.startsWith('/routines') ||
    pathname.startsWith('/journal') ||
    pathname.startsWith('/groceries') ||
    pathname.startsWith('/cycle') ||
    pathname.startsWith('/profile') ||
    isProtectedRecipeRoute;

  // Redirect unauthenticated users away from protected routes
  if (!session && isProtectedRoute) {
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
    '/profile/:path*',
    '/sign-in',
    '/sign-up',
  ],
};


