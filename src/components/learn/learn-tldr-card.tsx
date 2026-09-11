import type { ComponentType, ReactNode } from 'react';
import type { LearnTldr } from '@/lib/validation/education-schemas';
import {
  AlertTriangle,
  Clock,
  FlaskConical,
  Hand,
  Pill,
  Scale,
  ShieldAlert,
  Sparkles,
  XCircle,
  CheckCircle2,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface LearnTldrCardProps {
  tldr: LearnTldr;
  title: string;
  className?: string;
}

function FactBlock({
  icon: Icon,
  label,
  children,
  tone = 'default',
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  children: ReactNode;
  tone?: 'default' | 'positive' | 'caution' | 'danger';
}) {
  const toneClasses = {
    default: 'border-gray-200 bg-white',
    positive: 'border-emerald-200 bg-emerald-50/50',
    caution: 'border-amber-200 bg-amber-50/50',
    danger: 'border-red-200 bg-red-50/50',
  } as const;

  const iconClasses = {
    default: 'text-primary-600',
    positive: 'text-emerald-700',
    caution: 'text-amber-700',
    danger: 'text-red-700',
  } as const;

  return (
    <section
      className={cn(
        'rounded-xl border p-4 shadow-sm',
        toneClasses[tone]
      )}
    >
      <div className="mb-2 flex items-center gap-2">
        <Icon className={cn('h-4 w-4 shrink-0', iconClasses[tone])} aria-hidden />
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-700">
          {label}
        </h2>
      </div>
      <div className="text-sm leading-relaxed text-gray-800">{children}</div>
    </section>
  );
}

function BulletList({
  items,
  variant = 'default',
}: {
  items: string[];
  variant?: 'default' | 'positive' | 'danger';
}) {
  const Icon =
    variant === 'positive'
      ? CheckCircle2
      : variant === 'danger'
        ? XCircle
        : Sparkles;
  const iconClass =
    variant === 'positive'
      ? 'text-emerald-600'
      : variant === 'danger'
        ? 'text-red-600'
        : 'text-primary-500';

  return (
    <ul className="flex flex-col gap-2">
      {items.map((item) => (
        <li key={item} className="flex items-start gap-2">
          <Icon className={cn('mt-0.5 h-4 w-4 shrink-0', iconClass)} aria-hidden />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

/**
 * Second-level "TLDR" information card: only the practical essentials.
 */
export function LearnTldrCard({ tldr, title, className }: LearnTldrCardProps) {
  return (
    <div className={cn('flex flex-col gap-4', className)}>
      <header className="rounded-xl border border-primary-200 bg-primary-50/60 p-5">
        <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-primary-700">
          TLDR — Too Long; Didn&apos;t Read
        </p>
        <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">{title}</h1>
        {tldr.summary ? (
          <p className="mt-3 text-base leading-relaxed text-gray-800">
            {tldr.summary}
          </p>
        ) : null}
      </header>

      <div className="grid gap-4 sm:grid-cols-2">
        {tldr.whenToTake ? (
          <FactBlock icon={Clock} label="When to take">
            <p>{tldr.whenToTake}</p>
          </FactBlock>
        ) : null}

        {tldr.howToTake ? (
          <FactBlock icon={Hand} label="How to take">
            <p>{tldr.howToTake}</p>
          </FactBlock>
        ) : null}

        {tldr.portioning ? (
          <FactBlock icon={Scale} label="How to portion">
            <p>{tldr.portioning}</p>
          </FactBlock>
        ) : null}

        {tldr.duration ? (
          <FactBlock icon={FlaskConical} label="Duration / maintenance">
            <p>{tldr.duration}</p>
          </FactBlock>
        ) : null}
      </div>

      {tldr.takeWith.length > 0 ? (
        <FactBlock icon={Pill} label="Take with" tone="positive">
          <BulletList items={tldr.takeWith} variant="positive" />
        </FactBlock>
      ) : null}

      {tldr.avoidWith.length > 0 ? (
        <FactBlock icon={XCircle} label="Do not take with / avoid" tone="danger">
          <BulletList items={tldr.avoidWith} variant="danger" />
        </FactBlock>
      ) : null}

      {tldr.keyPoints.length > 0 ? (
        <FactBlock icon={Sparkles} label="Key points">
          <BulletList items={tldr.keyPoints} />
        </FactBlock>
      ) : null}

      {tldr.cautions.length > 0 ? (
        <FactBlock icon={ShieldAlert} label="Cautions" tone="caution">
          <BulletList items={tldr.cautions} variant="danger" />
        </FactBlock>
      ) : null}

      {tldr.extraNotes ? (
        <FactBlock icon={AlertTriangle} label="Notes" tone="caution">
          <p>{tldr.extraNotes}</p>
        </FactBlock>
      ) : null}
    </div>
  );
}
