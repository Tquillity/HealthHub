import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { InvitationResponse } from '@/components/household/invitation-response';
import { OrgTypeBadge, RoleBadge } from '@/components/household/org-badges';
import type { InvitationForYou } from '@/lib/household-management';
import { cn } from '@/lib/utils';

/** Pending invitations sent to the signed-in user's email address. */
export function InvitationsForYou({
  invitations,
  className,
}: {
  invitations: InvitationForYou[];
  className?: string;
}) {
  if (invitations.length === 0) return null;
  return (
    <Card className={cn('border-primary-200 bg-primary-50/40', className)}>
      <CardHeader>
        <CardTitle className="text-lg">Invitations for you</CardTitle>
        <CardDescription>
          Accepting adds you to that space and switches to it. You can switch back any time
          from the menu.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="flex flex-col gap-3">
          {invitations.map((invitation) => (
            <li
              key={invitation.id}
              className="flex flex-col gap-3 rounded-lg border border-gray-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex min-w-0 flex-col gap-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-gray-900">{invitation.organizationName}</span>
                  <OrgTypeBadge type={invitation.organizationType} />
                </div>
                <div className="flex flex-wrap items-center gap-2 text-sm text-gray-500">
                  <span>
                    {invitation.inviterName
                      ? `${invitation.inviterName} invited you as`
                      : 'You are invited as'}
                  </span>
                  <RoleBadge role={invitation.role} />
                </div>
              </div>
              <InvitationResponse
                invitationId={invitation.id}
                organizationName={invitation.organizationName}
              />
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
