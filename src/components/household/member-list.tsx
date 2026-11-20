'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Crown, UserX } from 'lucide-react';
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
import { SafeDeleteModal } from '@/components/ui/safe-delete-modal';
import { MemberAvatar } from '@/components/household/member-avatar';
import { RoleBadge } from '@/components/household/org-badges';
import {
  removeMember,
  transferOwnership,
  updateMemberRole,
} from '@/actions/household-actions';
import type { HouseholdMember } from '@/lib/household-management';
import {
  ASSIGNABLE_ROLES,
  checkMemberRemoval,
  checkOwnershipTransfer,
  checkRoleChange,
  ROLE_LABELS,
  type AssignableRole,
  type OrgRole,
} from '@/lib/org-roles';
import { useUIStore } from '@/lib/store';

type MemberListProps = {
  members: HouseholdMember[];
  currentUserId: string;
  currentUserRole: OrgRole;
  organizationName: string;
  className?: string;
};

const selectClassName =
  'min-h-[44px] rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600 disabled:opacity-50';

export function MemberList({
  members,
  currentUserId,
  currentUserRole,
  organizationName,
  className,
}: MemberListProps) {
  const router = useRouter();
  const showToast = useUIStore((state) => state.showToast);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [memberToRemove, setMemberToRemove] = useState<HouseholdMember | null>(null);
  const [newOwner, setNewOwner] = useState<HouseholdMember | null>(null);

  const allowedRoles = (member: HouseholdMember): AssignableRole[] =>
    ASSIGNABLE_ROLES.filter(
      (role) =>
        checkRoleChange({
          actorRole: currentUserRole,
          actorIsTarget: member.userId === currentUserId,
          targetRole: member.role,
          newRole: role,
        }).ok
    );

  const handleRoleChange = async (member: HouseholdMember, role: AssignableRole) => {
    if (role === member.role) return;
    setPendingId(member.id);
    const result = await updateMemberRole({ memberId: member.id, role });
    setPendingId(null);
    if (result.success) {
      showToast(`${member.name} is now ${ROLE_LABELS[role].toLowerCase()}.`, 'success');
      router.refresh();
    } else {
      showToast(result.error || 'Could not change the role', 'error');
    }
  };

  const handleRemove = async () => {
    if (!memberToRemove) return;
    const member = memberToRemove;
    setPendingId(member.id);
    const result = await removeMember(member.id);
    setPendingId(null);
    setMemberToRemove(null);
    if (result.success) {
      showToast(`${member.name} has been removed from ${organizationName}.`, 'success');
      router.refresh();
    } else {
      showToast(result.error || 'Could not remove member', 'error');
    }
  };

  const handleTransfer = async () => {
    if (!newOwner) return;
    const member = newOwner;
    setPendingId(member.id);
    const result = await transferOwnership(member.id);
    setPendingId(null);
    setNewOwner(null);
    if (result.success) {
      showToast(`${member.name} is now the owner. You are an admin.`, 'success');
      router.refresh();
    } else {
      showToast(result.error || 'Could not transfer ownership', 'error');
    }
  };

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="text-lg">Members</CardTitle>
        <CardDescription>
          {members.length} {members.length === 1 ? 'person' : 'people'} in {organizationName}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="flex flex-col gap-3">
          {members.map((member, index) => {
            const isYou = member.userId === currentUserId;
            const roles = allowedRoles(member);
            const canRemove = checkMemberRemoval({
              actorRole: currentUserRole,
              actorIsTarget: isYou,
              targetRole: member.role,
            }).ok;
            const canTransfer =
              member.role !== 'owner' &&
              checkOwnershipTransfer({ actorRole: currentUserRole, actorIsTarget: isYou }).ok;
            const busy = pendingId === member.id;

            return (
              <li
                key={member.id}
                className="flex flex-col gap-3 rounded-lg border border-gray-200 bg-gray-50 p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <MemberAvatar
                    id={`member-avatar-${index}`}
                    name={member.name}
                    image={member.image}
                  />
                  <div className="flex min-w-0 flex-col">
                    <span className="truncate font-semibold text-gray-900">
                      {member.name}
                      {isYou && <span className="ml-2 text-xs font-normal text-gray-500">(You)</span>}
                    </span>
                    <span className="truncate text-sm text-gray-500">{member.email}</span>
                    <span className="text-xs text-gray-400">
                      Joined {new Date(member.joinedAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-6">
                  <div className="flex flex-wrap items-center gap-2">
                    {roles.length > 0 ? (
                      <>
                        <label htmlFor={`member-role-${index}`} className="sr-only">
                          Role for {member.name}
                        </label>
                        <select
                          id={`member-role-${index}`}
                          value={member.role}
                          disabled={busy}
                          onChange={(event) =>
                            void handleRoleChange(member, event.target.value as AssignableRole)
                          }
                          className={selectClassName}
                        >
                          {/* Whenever options exist they include the current role (owners get none). */}
                          {roles.map((role) => (
                            <option key={role} value={role}>
                              {ROLE_LABELS[role]}
                            </option>
                          ))}
                        </select>
                      </>
                    ) : (
                      <RoleBadge role={member.role} />
                    )}
                    {canTransfer && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={busy}
                        onClick={() => setNewOwner(member)}
                        className="gap-2"
                        aria-label={`Make ${member.name} the owner`}
                      >
                        <Crown className="h-4 w-4" aria-hidden />
                        Make owner
                      </Button>
                    )}
                  </div>
                  {canRemove && (
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      disabled={busy}
                      onClick={() => setMemberToRemove(member)}
                      className="min-h-[44px] gap-2"
                      aria-label={`Remove ${member.name}`}
                    >
                      <UserX className="h-4 w-4" aria-hidden />
                      Remove
                    </Button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </CardContent>

      {memberToRemove && (
        <SafeDeleteModal
          isOpen
          onClose={() => setMemberToRemove(null)}
          onConfirm={() => void handleRemove()}
          title="Remove member"
          itemName={memberToRemove.name}
          description={`${memberToRemove.name} will lose access to ${organizationName}'s meal plans, grocery list and shared journal. Anything they shared with it becomes private again.`}
        />
      )}

      <Dialog open={newOwner !== null} onOpenChange={(open) => !open && setNewOwner(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Transfer ownership?</DialogTitle>
            <DialogDescription>
              {newOwner?.name} will become the owner of {organizationName}. You will become an
              admin. Only the new owner can undo this.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-6">
            <Button type="button" variant="outline" onClick={() => setNewOwner(null)}>
              Cancel
            </Button>
            <Button type="button" onClick={() => void handleTransfer()}>
              Transfer ownership
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
