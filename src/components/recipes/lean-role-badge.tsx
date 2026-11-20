import { CakeSlice, Utensils, Warehouse, Workflow, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  LEAN_ROLE_DESCRIPTIONS,
  normalizeLeanRole,
  type LeanRole,
} from '@/lib/lean-kitchen';

const ROLE_STYLES: Record<LeanRole, { icon: LucideIcon; className: string }> = {
  Infrastructure: {
    icon: Warehouse,
    className: 'bg-primary-100 text-primary-800 ring-primary-700/20',
  },
  Process: {
    icon: Workflow,
    className: 'bg-wellness-100 text-wellness-800 ring-wellness-700/20',
  },
  Daily: {
    icon: Utensils,
    className: 'bg-amber-100 text-amber-800 ring-amber-700/20',
  },
  Treat: {
    icon: CakeSlice,
    className: 'bg-pink-100 text-pink-800 ring-pink-700/20',
  },
};

interface LeanRoleBadgeProps {
  role: string | null | undefined;
  className?: string;
}

/**
 * LEAN role pill. Screen readers hear "LEAN role: Infrastructure"; unknown or empty
 * roles render nothing.
 */
export function LeanRoleBadge({ role, className }: LeanRoleBadgeProps) {
  const leanRole = normalizeLeanRole(role);
  if (!leanRole) return null;
  const { icon: Icon, className: roleClassName } = ROLE_STYLES[leanRole];

  return (
    <span
      title={LEAN_ROLE_DESCRIPTIONS[leanRole]}
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium ring-1 ring-inset',
        roleClassName,
        className
      )}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      <span className="sr-only">LEAN role: </span>
      {leanRole}
    </span>
  );
}
