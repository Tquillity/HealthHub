import type { Metadata } from 'next';
import Link from 'next/link';
import { MailOpen } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { InvitationResponse } from '@/components/household/invitation-response';
import { OrgTypeBadge, RoleBadge } from '@/components/household/org-badges';
import { getSessionUserId } from '@/lib/session';
import { getInvitationForUser } from '@/lib/household-management';
import { InvitationIdSchema, invitePath } from '@/lib/invitations';
import { joinPrivacyNote } from '@/lib/org-policy';
import { ROLE_DESCRIPTIONS } from '@/lib/org-roles';
import { withNextPath } from '@/lib/safe-redirect';
import { createPageMetadata } from '@/lib/site-metadata';

// Links styled as buttons (a <button> inside a link is not valid HTML).
const primaryLink =
  'inline-flex min-h-[44px] items-center justify-center rounded-md bg-primary-500 px-4 py-2 font-medium text-white transition-colors hover:bg-primary-600';
const outlineLink =
  'inline-flex min-h-[44px] items-center justify-center rounded-md border border-gray-300 px-4 py-2 font-medium text-gray-900 transition-colors hover:bg-gray-100';

// Next.js reads `metadata` from server pages; fast refresh does not apply to them.
// eslint-disable-next-line react-refresh/only-export-components
export const metadata: Metadata = createPageMetadata({
  title: 'Invitation',
  description: 'Join a household on HealthHub.',
  path: '/invite',
  noIndex: true,
});

/**
 * In-app invitation link (there is no email service yet). Signed-out visitors are sent to sign
 * in or create an account and come back here. Details are shown only to the person the
 * invitation was sent to.
 */
export default async function InvitePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const parsed = InvitationIdSchema.safeParse(id);
  const path = invitePath(parsed.success ? parsed.data : 'invalid');
  const userId = await getSessionUserId();

  let content: React.ReactNode;
  if (!userId) {
    content = (
      <>
        <CardHeader>
          <CardTitle className="text-2xl">You&apos;ve been invited</CardTitle>
          <CardDescription>
            Someone invited you to share meal plans and grocery lists on HealthHub. Sign in, or
            create a free account, with the email address the invitation was sent to.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Link href={withNextPath('/sign-in', path)} className={primaryLink}>
            Sign in
          </Link>
          <Link href={withNextPath('/sign-up', path)} className={outlineLink}>
            Create account
          </Link>
        </CardContent>
      </>
    );
  } else {
    const result = parsed.success
      ? await getInvitationForUser(userId, parsed.data)
      : ({ ok: false, error: "We couldn't find this invitation. Ask for a new link." } as const);
    if (!result.ok) {
      content = (
        <>
          <CardHeader>
            <CardTitle className="text-2xl">This invitation can&apos;t be used</CardTitle>
            <CardDescription>{result.error}</CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/profile/household" className={outlineLink}>
              Go to your household
            </Link>
          </CardContent>
        </>
      );
    } else {
      const invitation = result.data;
      content = (
        <>
          <CardHeader>
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle className="text-2xl">Join {invitation.organizationName}</CardTitle>
              <OrgTypeBadge type={invitation.organizationType} />
            </div>
            <CardDescription>
              {invitation.inviterName
                ? `${invitation.inviterName} invited you.`
                : 'You have been invited.'}{' '}
              The invitation is valid until{' '}
              {invitation.expiresAt.toLocaleDateString('en-US', { dateStyle: 'long' })}.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-2 text-sm text-gray-600">
              <span>Your role:</span>
              <RoleBadge role={invitation.role} />
              <span>{ROLE_DESCRIPTIONS[invitation.role]}</span>
            </div>
            <p className="text-sm text-gray-600">{joinPrivacyNote(invitation.organizationType)}</p>
            {invitation.alreadyMember ? (
              <Link href="/profile/household" className={`${primaryLink} self-start`}>
                You&apos;re already a member: open it
              </Link>
            ) : (
              <InvitationResponse
                invitationId={invitation.id}
                organizationName={invitation.organizationName}
                redirectTo="/profile/household"
              />
            )}
          </CardContent>
        </>
      );
    }
  }

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-6 px-4 py-12">
      <MailOpen className="h-10 w-10 text-primary-600" aria-hidden />
      <Card>{content}</Card>
    </div>
  );
}
