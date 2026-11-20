'use client';

import Link from 'next/link';
import { parseAsBoolean, useQueryState } from 'nuqs';
import { HeartHandshake, Settings2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { SupportStatusItem } from '@/components/household/support-status-item';
import type { ProjectedCycleStatus } from '@/lib/cycle-status-sharing';
import { cn } from '@/lib/utils';

/**
 * Dashboard card: the cycle status other household members chose to share, already projected
 * on the server (src/lib/support-status.ts). Support mode (?support=true) is a simpler view.
 */
export function SupportStatusCard({
  organizationName,
  statuses,
  className,
}: {
  organizationName: string;
  statuses: ProjectedCycleStatus[];
  className?: string;
}) {
  const [simple, setSimple] = useQueryState('support', parseAsBoolean.withDefault(false));

  return (
    <Card className={className} role="region" aria-labelledby="support-status-title">
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <CardTitle id="support-status-title" className="flex items-center gap-2 text-xl">
            <HeartHandshake className="h-5 w-5 text-primary-600" aria-hidden />
            Support status
          </CardTitle>
          <CardDescription>
            How people in {organizationName} are doing, from what they chose to share.
          </CardDescription>
        </div>
        {statuses.length > 0 && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            aria-pressed={simple}
            aria-describedby="support-mode-help"
            onClick={() => void setSimple(simple ? null : true)}
            className="gap-2"
          >
            <span
              aria-hidden
              className={cn(
                'h-2.5 w-2.5 rounded-full',
                simple ? 'bg-wellness-500' : 'bg-gray-300'
              )}
            />
            Support mode
          </Button>
        )}
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {statuses.length > 0 && (
          <p id="support-mode-help" className="sr-only">
            Support mode shows a simpler view with just the phase and an idea for today.
          </p>
        )}
        {statuses.length === 0 ? (
          // "With you": someone may share with members who joined before you, and not with you.
          <p className="text-sm text-gray-600">
            Nobody in {organizationName} shares their cycle status with you right now. Sharing
            is always each person&apos;s own choice.
          </p>
        ) : (
          <ul className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {statuses.map((status) => (
              <li key={status.id}>
                <SupportStatusItem status={status} simple={simple} className="h-full" />
              </li>
            ))}
          </ul>
        )}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-gray-500">
            Phases are estimated from the dates each person entered. Estimates only. Not a
            contraceptive or fertility tool, and not medical advice.
          </p>
          <Link
            href="/profile#cycle-sharing"
            className="flex min-h-[44px] items-center gap-2 rounded-lg px-3 text-sm font-medium text-primary-600 transition-colors hover:bg-primary-50"
          >
            <Settings2 className="h-4 w-4" aria-hidden />
            Choose what you share
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
