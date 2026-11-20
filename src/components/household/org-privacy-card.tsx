import type { CycleShareLevel, OrganizationType } from '@prisma/client';
import Link from 'next/link';
import { BookLock, ShoppingCart, Users, UtensilsCrossed } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CYCLE_SHARE_LEVEL_INFO } from '@/lib/cycle-status-sharing';
import { getOrgPolicy, MIN_AGGREGATE_GROUP_SIZE } from '@/lib/org-policy';

type Row = {
  icon: typeof BookLock;
  title: string;
  text: string;
  link?: { href: string; label: string };
};

/**
 * Plain-language summary of what this space shares, from the org-policy rules. In a household
 * it also says whether the viewer shares their own cycle status here (`yourCycleShareLevel`,
 * the share for this space; NONE or left out when they do not).
 */
export function OrgPrivacyCard({
  type,
  yourCycleShareLevel = 'NONE',
  className,
}: {
  type: OrganizationType;
  yourCycleShareLevel?: CycleShareLevel;
  className?: string;
}) {
  const policy = getOrgPolicy(type);
  const sharingCycleHere =
    policy.cycleStatusSharing === 'opt-in' && yourCycleShareLevel !== 'NONE';

  let journalAndCycle: Row;
  if (policy.individualSharing !== 'opt-in') {
    journalAndCycle = {
      icon: BookLock,
      title: 'Journal and cycle',
      text: "Always private. Nobody here can see anyone's journal or cycle.",
    };
  } else if (policy.cycleStatusSharing !== 'opt-in') {
    journalAndCycle = {
      icon: BookLock,
      title: 'Journal and cycle',
      text: 'Private. You can share a single journal day here if you want to, and stop sharing any time. Cycle status is only ever shown to households.',
    };
  } else if (sharingCycleHere) {
    journalAndCycle = {
      icon: BookLock,
      title: 'Journal and cycle',
      text: `Your journal stays private unless you share a day. You share your cycle status with this household: ${CYCLE_SHARE_LEVEL_INFO[yourCycleShareLevel].label}.`,
      link: { href: '/profile#cycle-sharing', label: 'Change or stop it in Profile' },
    };
  } else {
    journalAndCycle = {
      icon: BookLock,
      title: 'Journal and cycle',
      text: 'Private. You can share a single journal day, or your cycle status, with this household, and stop any time.',
      link: { href: '/profile#cycle-sharing', label: 'Cycle status sharing in Profile' },
    };
  }

  const rows: Row[] = [
    {
      icon: UtensilsCrossed,
      title: 'Meal plans',
      text:
        policy.mealPlans === 'shared'
          ? 'One shared plan for everyone here.'
          : 'A shared plan for the people who choose to plan here.',
    },
    {
      icon: ShoppingCart,
      title: 'Grocery list',
      text: policy.grocerySources
        ? 'Shared, showing which meals each item is for.'
        : 'Shared, without showing which meals or days items come from.',
    },
    journalAndCycle,
    {
      icon: Users,
      title: 'Group numbers',
      text: `Only anonymous totals, and only when at least ${MIN_AGGREGATE_GROUP_SIZE} people take part.`,
    },
  ];

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="text-lg">What is shared here</CardTitle>
        <CardDescription>{policy.description}</CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="flex flex-col gap-3">
          {rows.map((row) => (
            <li key={row.title} className="flex items-start gap-3">
              <row.icon className="mt-0.5 h-4 w-4 shrink-0 text-primary-600" aria-hidden />
              <div className="flex flex-col">
                <span className="text-sm font-medium text-gray-900">{row.title}</span>
                <span className="text-sm text-gray-600">{row.text}</span>
                {row.link && (
                  <Link
                    href={row.link.href}
                    className="inline-flex min-h-[44px] items-center self-start text-sm font-medium text-primary-700 underline-offset-2 hover:underline"
                  >
                    {row.link.label}
                  </Link>
                )}
              </div>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
