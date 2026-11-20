import type { OrganizationType } from '@prisma/client';
import { Crown, Eye, Shield, User } from 'lucide-react';
import { ORG_POLICIES } from '@/lib/org-policy';
import { ROLE_LABELS, type OrgRole } from '@/lib/org-roles';
import { cn } from '@/lib/utils';

const TYPE_STYLES: Record<OrganizationType, string> = {
  HOUSEHOLD: 'border-wellness-200 bg-wellness-50 text-wellness-800',
  COLLECTIVE: 'border-primary-200 bg-primary-50 text-primary-800',
  COMMUNITY: 'border-amber-200 bg-amber-50 text-amber-800',
  CORPORATE: 'border-gray-300 bg-gray-100 text-gray-700',
};

export function OrgTypeBadge({
  type,
  className,
}: {
  type: OrganizationType;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-xs font-medium',
        TYPE_STYLES[type],
        className
      )}
    >
      {ORG_POLICIES[type].label}
    </span>
  );
}

const ROLE_STYLES: Record<OrgRole, string> = {
  owner: 'border-amber-200 bg-amber-50 text-amber-800',
  admin: 'border-primary-200 bg-primary-50 text-primary-800',
  member: 'border-gray-200 bg-gray-50 text-gray-700',
  viewer: 'border-gray-200 bg-white text-gray-600',
};

const ROLE_ICONS: Record<OrgRole, typeof User> = {
  owner: Crown,
  admin: Shield,
  member: User,
  viewer: Eye,
};

export function RoleBadge({ role, className }: { role: OrgRole; className?: string }) {
  const Icon = ROLE_ICONS[role];
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium',
        ROLE_STYLES[role],
        className
      )}
    >
      <Icon className="h-3 w-3" aria-hidden />
      {ROLE_LABELS[role]}
    </span>
  );
}
