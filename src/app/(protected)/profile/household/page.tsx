import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { getServerSession } from '@/lib/session';
import { getHouseholdData } from '@/lib/household-management';
import { getSharedJournalEntries } from '@/lib/journal-sharing';
import { getCycleShareLevel } from '@/lib/support-status';
import { canManage } from '@/lib/org-roles';
import { PageHeader } from '@/components/ui/page-header';
import { OrgTypeBadge, RoleBadge } from '@/components/household/org-badges';
import { MemberList } from '@/components/household/member-list';
import { InviteForm } from '@/components/household/invite-form';
import { PendingInvitations } from '@/components/household/pending-invitations';
import { InvitationsForYou } from '@/components/household/invitations-for-you';
import { OrgPrivacyCard } from '@/components/household/org-privacy-card';
import { SharedJournalFeed } from '@/components/household/shared-journal-feed';
import { CreateOrganizationForm } from '@/components/household/create-organization-form';
import { LeaveOrganizationCard } from '@/components/household/leave-organization-card';

/**
 * Household management for the active organization (switch it in the sidebar). Components
 * that hold state are keyed by the organization, so a switch remounts them: no invite link,
 * role choice or open dialog carries over from the previous space.
 */
export default async function HouseholdPage() {
  const session = await getServerSession();
  if (!session) {
    redirect('/sign-in');
  }

  const result = await getHouseholdData(session.user.id);
  if (!result.ok) {
    return (
      <div className="p-6">
        <p className="text-gray-500">{result.error || 'Failed to load your household'}</p>
      </div>
    );
  }

  const household = result.data;
  const { organization } = household;
  const isManager = canManage(household.currentUserRole);
  const [sharedEntries, yourCycleShareLevel] = await Promise.all([
    getSharedJournalEntries(session.user.id, organization.id),
    getCycleShareLevel(session.user.id, organization.id),
  ]);

  return (
    <div className="flex flex-col gap-6 p-6">
      <Link
        href="/profile"
        className="flex min-h-[44px] items-center gap-1 self-start text-sm text-gray-500 transition-colors hover:text-primary-600"
      >
        <ChevronLeft className="h-4 w-4" aria-hidden />
        Back to Profile
      </Link>

      <PageHeader
        title={organization.name}
        description="Members, invitations and what this space shares. Switch spaces from the menu."
        actions={
          <>
            <OrgTypeBadge type={organization.type} />
            <RoleBadge role={household.currentUserRole} />
          </>
        }
      />

      <InvitationsForYou invitations={household.invitationsForYou} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <MemberList
          key={`members-${organization.id}`}
          className="lg:col-span-2"
          members={household.members}
          currentUserId={household.currentUserId}
          currentUserRole={household.currentUserRole}
          organizationName={organization.name}
        />
        <OrgPrivacyCard type={organization.type} yourCycleShareLevel={yourCycleShareLevel} />

        {isManager && (
          <>
            <InviteForm
              key={`invite-${organization.id}`}
              organizationId={organization.id}
              roles={household.invitableRoles}
              organizationName={organization.name}
            />
            <PendingInvitations
              key={`pending-${organization.id}`}
              className="lg:col-span-2"
              invitations={household.invitations}
            />
          </>
        )}

        <SharedJournalFeed
          className="lg:col-span-2"
          entries={sharedEntries}
          organizationName={organization.name}
          organizationType={organization.type}
        />
        <div className="flex flex-col gap-6">
          <CreateOrganizationForm />
          <LeaveOrganizationCard
            key={`leave-${organization.id}`}
            organizationId={organization.id}
            organizationName={organization.name}
            role={household.currentUserRole}
            ownerCount={household.ownerCount}
            membershipCount={household.membershipCount}
          />
        </div>
      </div>
    </div>
  );
}
