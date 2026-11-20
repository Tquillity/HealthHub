'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { acceptInvitation, declineInvitation } from '@/actions/household-actions';
import { useUIStore } from '@/lib/store';
import { cn } from '@/lib/utils';

/** Accept / Decline buttons for one invitation addressed to the signed-in user. */
export function InvitationResponse({
  invitationId,
  organizationName,
  redirectTo,
  className,
}: {
  invitationId: string;
  organizationName: string;
  /** Where to go after accepting; stays on the page and refreshes when omitted. */
  redirectTo?: string;
  className?: string;
}) {
  const router = useRouter();
  const showToast = useUIStore((state) => state.showToast);
  const [busy, setBusy] = useState<'accept' | 'decline' | null>(null);

  const handleAccept = async () => {
    setBusy('accept');
    const result = await acceptInvitation(invitationId);
    if (result.success) {
      showToast(`Welcome to ${organizationName}!`, 'success');
      if (redirectTo) router.push(redirectTo);
      router.refresh();
    } else {
      showToast(result.error || 'Could not accept the invitation', 'error');
      setBusy(null);
    }
  };

  const handleDecline = async () => {
    setBusy('decline');
    const result = await declineInvitation(invitationId);
    if (result.success) {
      showToast(`Invitation to ${organizationName} declined.`, 'info');
      router.refresh();
    } else {
      showToast(result.error || 'Could not decline the invitation', 'error');
    }
    setBusy(null);
  };

  return (
    <div className={cn('flex flex-wrap items-center gap-6', className)}>
      <Button
        type="button"
        onClick={() => void handleAccept()}
        disabled={busy !== null}
        className="gap-2"
        aria-label={`Accept invitation to ${organizationName}`}
      >
        <Check className="h-4 w-4" aria-hidden />
        {busy === 'accept' ? 'Joining…' : 'Accept'}
      </Button>
      <Button
        type="button"
        variant="outline"
        onClick={() => void handleDecline()}
        disabled={busy !== null}
        className="gap-2"
        aria-label={`Decline invitation to ${organizationName}`}
      >
        <X className="h-4 w-4" aria-hidden />
        {busy === 'decline' ? 'Declining…' : 'Decline'}
      </Button>
    </div>
  );
}
