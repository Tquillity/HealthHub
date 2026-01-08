'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { removeMember } from '@/actions/household-actions';
import { useUIStore } from '@/lib/store';
import { User, UserX, Crown, Shield } from 'lucide-react';
import { SafeDeleteModal } from '@/components/ui/safe-delete-modal';

interface HouseholdMember {
  id: string;
  userId: string;
  name: string;
  email: string;
  image: string | null;
  role: string;
  joinedAt: Date;
}

interface HouseholdMemberListProps {
  members: HouseholdMember[];
  currentUserRole: string;
  currentUserId: string;
}

export function HouseholdMemberList({
  members,
  currentUserRole,
  currentUserId,
}: HouseholdMemberListProps) {
  const showToast = useUIStore((state) => state.showToast);
  const [removingMemberId, setRemovingMemberId] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [memberToRemove, setMemberToRemove] = useState<HouseholdMember | null>(null);

  const canRemoveMembers = currentUserRole === 'owner';

  const handleRemoveClick = (member: HouseholdMember) => {
    setMemberToRemove(member);
    setShowDeleteModal(true);
  };

  const handleRemoveConfirm = async () => {
    if (!memberToRemove) return;

    setRemovingMemberId(memberToRemove.id);
    const result = await removeMember(memberToRemove.id);

    if (result.success) {
      showToast(`${memberToRemove.name} has been removed from the household`, 'success');
      setShowDeleteModal(false);
      setMemberToRemove(null);
      // Refresh the page to update the member list
      window.location.reload();
    } else {
      showToast(result.error || 'Failed to remove member', 'error');
    }

    setRemovingMemberId(null);
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'owner':
        return <Crown className="h-4 w-4 text-yellow-600" />;
      case 'admin':
        return <Shield className="h-4 w-4 text-blue-600" />;
      default:
        return <User className="h-4 w-4 text-gray-600" />;
    }
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'owner':
        return 'Owner';
      case 'admin':
        return 'Admin';
      default:
        return 'Member';
    }
  };

  if (members.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <p className="text-center text-gray-500">No members found</p>
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-col gap-4 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Household Members</h3>
          <p className="mt-1 text-sm text-gray-500">
            {members.length} {members.length === 1 ? 'member' : 'members'} in your household
          </p>
        </div>

        <div className="flex flex-col gap-3">
          {members.map((member) => {
            const isCurrentUser = member.userId === currentUserId;
            const canRemove = canRemoveMembers && !isCurrentUser;

            return (
              <div
                key={member.id}
                className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 p-4"
              >
                <div className="flex items-center gap-3">
                  {member.image ? (
                    <img
                      src={member.image}
                      alt={member.name}
                      className="h-10 w-10 rounded-full"
                    />
                  ) : (
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-100 text-primary-600">
                      <User className="h-5 w-5" />
                    </div>
                  )}
                  <div className="flex flex-col">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900">
                        {member.name}
                        {isCurrentUser && (
                          <span className="ml-2 text-xs text-gray-500">(You)</span>
                        )}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                      <span>{member.email}</span>
                      <span>•</span>
                      <div className="flex items-center gap-1">
                        {getRoleIcon(member.role)}
                        <span>{getRoleLabel(member.role)}</span>
                      </div>
                    </div>
                    <span className="text-xs text-gray-400">
                      Joined {new Date(member.joinedAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>

                {canRemove && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleRemoveClick(member)}
                    disabled={removingMemberId === member.id}
                    className="gap-2 text-red-600 hover:bg-red-50 hover:text-red-700"
                  >
                    <UserX className="h-4 w-4" />
                    Remove
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {memberToRemove && (
        <SafeDeleteModal
          isOpen={showDeleteModal}
          onClose={() => {
            setShowDeleteModal(false);
            setMemberToRemove(null);
          }}
          onConfirm={handleRemoveConfirm}
          title="Remove Household Member"
          itemName={memberToRemove.name}
          description={`This will remove ${memberToRemove.name} from your household. They will lose access to shared meal plans, grocery lists, and other household resources.`}
        />
      )}
    </>
  );
}

