import type { OrganizationType } from '@prisma/client';
import { BookLock, ShoppingCart, Users, UtensilsCrossed } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getOrgPolicy, MIN_AGGREGATE_GROUP_SIZE } from '@/lib/org-policy';

/** Plain-language summary of what this space shares, from the org-policy rules. */
export function OrgPrivacyCard({
  type,
  className,
}: {
  type: OrganizationType;
  className?: string;
}) {
  const policy = getOrgPolicy(type);
  const rows = [
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
    {
      icon: BookLock,
      title: 'Journal and cycle',
      text:
        policy.individualSharing === 'opt-in'
          ? 'Private. You can share a single journal day here if you want to, and stop sharing any time.'
          : "Always private. Nobody here can see anyone's journal or cycle.",
    },
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
              </div>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
