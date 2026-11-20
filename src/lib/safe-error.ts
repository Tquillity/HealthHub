/**
 * A log label for an error that never includes its message.
 *
 * Use it when logging failures around health data: Prisma validation errors print the
 * query arguments (temperatures, heart rates) in their message, so log only the error
 * class and code.
 */
export function safeErrorLabel(error: unknown): string {
  if (!(error instanceof Error)) return 'non-error thrown';
  const code =
    'code' in error && typeof error.code === 'string' ? ` ${error.code}` : '';
  return `${error.name}${code}`;
}
