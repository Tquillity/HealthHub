import { redirect } from 'next/navigation';
import { getServerSession } from '@/lib/session';
import { getHouseholdMembers } from '@/actions/household-actions';
import { HouseholdMemberList } from '@/components/profile/household-member-list';
import { InviteMemberForm } from '@/components/profile/invite-member-form';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';

export default async function HouseholdPage() {
  const session = await getServerSession();

  if (!session) {
    redirect('/sign-in');
  }

  const result = await getHouseholdMembers();

  if (!result.success || !result.data) {
    return (
      <div className="p-6">
        <p className="text-gray-500">
          {result.error || 'Failed to load household members'}
        </p>
      </div>
    );
  }

  const { members, currentUserRole } = result.data;
  const canInvite = currentUserRole === 'owner' || currentUserRole === 'admin';

  return (
    <div className="p-6">
      <Link
        href="/profile"
        className="mb-6 flex items-center text-sm text-gray-500 transition-colors hover:text-blue-600"
      >
        <ChevronLeft className="h-4 w-4" />
        Back to Profile
      </Link>

      <PageHeader
        className="mb-6"
        title="Household"
        description="Manage your household members and invitations"
      />

      <div className="flex flex-col gap-6">
        {/* Member List */}
        <HouseholdMemberList
          members={members}
          currentUserRole={currentUserRole}
          currentUserId={session.user.id}
        />

        {/* Invite Form (only for owners and admins) */}
        {canInvite && <InviteMemberForm />}
      </div>
    </div>
  );
}
