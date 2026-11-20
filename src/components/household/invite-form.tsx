'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CopyInviteLinkButton } from '@/components/household/copy-invite-link-button';
import { inviteMember } from '@/actions/household-actions';
import { INVITATION_TTL_DAYS } from '@/lib/invitations';
import { ROLE_DESCRIPTIONS, ROLE_LABELS, type AssignableRole } from '@/lib/org-roles';
import { useUIStore } from '@/lib/store';

type InviteFormProps = {
  /** Roles this person may hand out (an admin cannot invite admins). */
  roles: AssignableRole[];
  organizationName: string;
  className?: string;
};

export function InviteForm({ roles, organizationName, className }: InviteFormProps) {
  const router = useRouter();
  const showToast = useUIStore((state) => state.showToast);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<AssignableRole>(roles.includes('member') ? 'member' : roles[0]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [created, setCreated] = useState<{ email: string; invitePath: string } | null>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsSubmitting(true);
    const result = await inviteMember({ email, role });
    setIsSubmitting(false);

    if (result.success && result.data) {
      setCreated({ email: result.data.email, invitePath: result.data.invitePath });
      setEmail('');
      showToast(`Invitation ready for ${result.data.email}. Copy the link and send it to them.`, 'success');
      router.refresh();
    } else {
      showToast(result.error || 'Could not create the invitation', 'error');
    }
  };

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="text-lg">Invite someone</CardTitle>
        <CardDescription>
          Invite a partner or family member to {organizationName}. You get a link to send them;
          it works for {INVITATION_TTL_DAYS} days and only for the email address you enter.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="invite-email" className="text-sm font-medium text-gray-700">
              Email address
            </label>
            <Input
              id="invite-email"
              name="invite-email"
              type="email"
              autoComplete="off"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="partner@example.com"
              required
              disabled={isSubmitting}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="invite-role" className="text-sm font-medium text-gray-700">
              Role
            </label>
            <select
              id="invite-role"
              name="invite-role"
              value={role}
              onChange={(event) => setRole(event.target.value as AssignableRole)}
              aria-describedby="invite-role-help"
              className="min-h-[44px] w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600"
              disabled={isSubmitting}
            >
              {roles.map((option) => (
                <option key={option} value={option}>
                  {ROLE_LABELS[option]}
                </option>
              ))}
            </select>
            <p id="invite-role-help" className="text-xs text-gray-500">
              {ROLE_DESCRIPTIONS[role]}
            </p>
          </div>

          <Button type="submit" disabled={isSubmitting || !email.trim()} className="gap-2 self-end">
            <UserPlus className="h-4 w-4" aria-hidden />
            {isSubmitting ? 'Creating…' : 'Create invite link'}
          </Button>
        </form>

        {created && (
          <div
            role="status"
            className="flex flex-col gap-3 rounded-lg border border-wellness-200 bg-wellness-50 p-4"
          >
            <p className="text-sm text-wellness-800">
              Send this link to <span className="font-semibold">{created.email}</span>. They sign in
              (or create an account) with that address and tap Accept.
            </p>
            <CopyInviteLinkButton
              path={created.invitePath}
              email={created.email}
              className="self-start"
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
