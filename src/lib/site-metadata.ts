import type { Metadata } from 'next';

export const SITE_NAME = 'HealthHub';
export const SITE_TAGLINE = 'Household wellness hub — focus, nutrition, and learning';
export const DEFAULT_DESCRIPTION =
  'Free wellness tools for your household: Pomodoro timer, recipes, meal planning, journaling, cycle insights, and evidence-based learning.';

const DEFAULT_OG_IMAGE = '/logo512.png';

function getSiteUrl(): URL {
  const base =
    process.env.NEXT_PUBLIC_BETTER_AUTH_URL ||
    process.env.BETTER_AUTH_URL ||
    'http://localhost:3000';
  return new URL(base);
}

export function getMetadataBase(): URL {
  return getSiteUrl();
}

type PageMetadataOptions = {
  title: string;
  description?: string;
  path?: string;
  ogImage?: string;
  noIndex?: boolean;
};

/**
 * Shared metadata for public marketing and content routes.
 * Uses logo512.png as the default OG image (committed PWA asset).
 */
export function createPageMetadata({
  title,
  description = DEFAULT_DESCRIPTION,
  path = '/',
  ogImage = DEFAULT_OG_IMAGE,
  noIndex = false,
}: PageMetadataOptions): Metadata {
  const metadataBase = getSiteUrl();
  const canonical = new URL(path, metadataBase);
  const imageUrl = new URL(ogImage, metadataBase);

  const fullTitle =
    title === SITE_NAME || title.startsWith(`${SITE_NAME} —`)
      ? title
      : `${title} | ${SITE_NAME}`;

  return {
    title: fullTitle,
    description,
    alternates: {
      canonical: canonical.pathname + canonical.search,
    },
    openGraph: {
      type: 'website',
      locale: 'en_US',
      url: canonical.toString(),
      siteName: SITE_NAME,
      title: fullTitle,
      description,
      images: [
        {
          url: imageUrl.toString(),
          width: 512,
          height: 512,
          alt: `${SITE_NAME} logo`,
        },
      ],
    },
    twitter: {
      card: 'summary',
      title: fullTitle,
      description,
      images: [imageUrl.toString()],
    },
    ...(noIndex ? { robots: { index: false, follow: false } } : {}),
  };
}
