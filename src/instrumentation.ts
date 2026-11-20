/**
 * Next.js calls register() once when a server instance starts
 * (https://nextjs.org/docs/app/guides/instrumentation).
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;

  const { reportProductionEnvWarnings } = await import('@/lib/env-checks');
  reportProductionEnvWarnings();
}
