'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { LogOut } from 'lucide-react';
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
import { leaveOrganization } from '@/actions/household-actions';
import { checkLeave, type OrgRole } from '@/lib/org-roles';
import { useUIStore } from '@/lib/store';

export function LeaveOrganizationCard({
  organizationId,
  organizationName,
  role,
  ownerCount,
  membershipCount,
  className,
}: {
  organizationId: string;
  organizationName: string;
  role: OrgRole;
  ownerCount: number;
  membershipCount: number;
  className?: string;
}) {
  const router = useRouter();
  const showToast = useUIStore((state) => state.showToast);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const check = checkLeave({ role, ownerCount, membershipCount });

  const handleLeave = async () => {
    setBusy(true);
    const result = await leaveOrganization(organizationId);
    setBusy(false);
    setConfirming(false);
    if (result.success) {
      showToast(`You left ${organizationName}.`, 'success');
      router.refresh();
    } else {
      showToast(result.error || 'Could not leave', 'error');
    }
  };

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="text-lg">Leave {organizationName}</CardTitle>
        <CardDescription>
          You lose access to its meal plans and lists. Journal days you shared with it become
          private again.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {!check.ok && (
          <p id="leave-blocked-reason" className="text-sm text-gray-600">
            {check.error}
          </p>
        )}
        <Button
          type="button"
          variant="destructive"
          disabled={!check.ok || busy}
          onClick={() => setConfirming(true)}
          aria-describedby={check.ok ? undefined : 'leave-blocked-reason'}
          className="min-h-[44px] gap-2 self-start"
        >
          <LogOut className="h-4 w-4" aria-hidden />
          Leave
        </Button>
      </CardContent>

      <Dialog open={confirming} onOpenChange={setConfirming}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Leave {organizationName}?</DialogTitle>
            <DialogDescription>
              To come back, someone will need to invite you again.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-6">
            <Button type="button" variant="outline" onClick={() => setConfirming(false)}>
              Stay
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={busy}
              onClick={() => void handleLeave()}
            >
              Leave
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
