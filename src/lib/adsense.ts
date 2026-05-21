export function isAdSenseEnabled(): boolean {
  return (
    process.env.NEXT_PUBLIC_ADSENSE_ENABLED === 'true' &&
    Boolean(process.env.NEXT_PUBLIC_ADSENSE_CLIENT?.trim())
  );
}
