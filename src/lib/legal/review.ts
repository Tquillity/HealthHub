import { LEGAL_REVIEW_VERSION } from '@/lib/legal/constants';

/**
 * When counsel-approved copy is merged, set LEGAL_REVIEW_APPROVED=true in production.
 * Until then, pages show the draft notice banner.
 */
export function isLegalReviewApproved(): boolean {
  return process.env.LEGAL_REVIEW_APPROVED === 'true';
}

export function getLegalReviewVersion(): string {
  return LEGAL_REVIEW_VERSION;
}
