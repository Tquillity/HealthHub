import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { getHouseholdMembers } from '@/actions/household-actions';
import { HouseholdMemberList } from '@/components/profile/household-member-list';
import { InviteMemberForm } from '@/components/profile/invite-member-form';
import { Users } from 'lucide-react';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';

export default async function HouseholdPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

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

      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-100 text-primary-600">
          <Users className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Household</h1>
          <p className="text-gray-500">
            Manage your household members and invitations
          </p>
        </div>
      </div>

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
