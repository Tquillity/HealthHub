import { getHouseholdSupportStatuses } from '@/actions/support-status-actions';
import { SupportStatusCard } from '@/components/dashboard/support-status-card';

/**
 * Support Status for the active space. Renders nothing outside households (collectives,
 * communities and workplaces never show individual cycle status) and nothing when the
 * household has no other members.
 */
export async function SupportStatusWidget({ className }: { className?: string }) {
  const result = await getHouseholdSupportStatuses();
  const board = result.success ? result.data : null;
  if (!board || !board.sharingAllowed || board.otherMemberCount === 0) return null;

  return (
    <SupportStatusCard
      organizationName={board.organization.name}
      statuses={board.statuses}
      className={className}
    />
  );
}
