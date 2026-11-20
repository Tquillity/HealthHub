'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Mail, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { CopyInviteLinkButton } from '@/components/household/copy-invite-link-button';
import { RoleBadge } from '@/components/household/org-badges';
import { deleteInvitation } from '@/actions/household-actions';
import type { PendingInvitation } from '@/lib/household-management';
import { invitePath } from '@/lib/invitations';
import { useUIStore } from '@/lib/store';

export function PendingInvitations({
  invitations,
  className,
}: {
  invitations: PendingInvitation[];
  className?: string;
}) {
  const router = useRouter();
  const showToast = useUIStore((state) => state.showToast);
  const [toCancel, setToCancel] = useState<PendingInvitation | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const handleCancel = async () => {
    if (!toCancel) return;
    const invitation = toCancel;
    setToCancel(null);
    setBusyId(invitation.id);
    const result = await deleteInvitation(invitation.id);
    setBusyId(null);
    if (result.success) {
      showToast(`Invitation for ${invitation.email} cancelled.`, 'success');
      router.refresh();
    } else {
      showToast(result.error || 'Could not cancel the invitation', 'error');
    }
  };

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="text-lg">Pending invitations</CardTitle>
        <CardDescription>
          Copy a link to send it again, or cancel it so it stops working.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {invitations.length === 0 ? (
          <p className="text-sm text-gray-500">No pending invitations.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {invitations.map((invitation) => (
              <li
                key={invitation.id}
                className="flex flex-col gap-3 rounded-lg border border-gray-200 bg-gray-50 p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gray-200 text-gray-600">
                    <Mail className="h-4 w-4" aria-hidden />
                  </span>
                  <div className="flex min-w-0 flex-col gap-1">
                    <span className="truncate font-medium text-gray-900">{invitation.email}</span>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
                      <RoleBadge role={invitation.role} />
                      <span>Expires {new Date(invitation.expiresAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-6">
                  <CopyInviteLinkButton path={invitePath(invitation.id)} email={invitation.email} />
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    disabled={busyId === invitation.id}
                    onClick={() => setToCancel(invitation)}
                    className="min-h-[44px] gap-2"
                    aria-label={`Cancel invite for ${invitation.email}`}
                  >
                    <X className="h-4 w-4" aria-hidden />
                    Cancel invite
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>

      <Dialog open={toCancel !== null} onOpenChange={(open) => !open && setToCancel(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel this invitation?</DialogTitle>
            <DialogDescription>
              The link sent to {toCancel?.email} will stop working. You can invite them again
              later.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-6">
            <Button type="button" variant="outline" onClick={() => setToCancel(null)}>
              Keep it
            </Button>
            <Button type="button" variant="destructive" onClick={() => void handleCancel()}>
              Cancel invitation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
