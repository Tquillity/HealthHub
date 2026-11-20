'use client';

import { useEffect, useId, useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQueryState } from 'nuqs';
import { Check, ChevronsUpDown, Settings } from 'lucide-react';
import { switchActiveOrganization } from '@/actions/organization-actions';
import { OrgTypeBadge } from '@/components/household/org-badges';
import type { OrganizationSummary } from '@/lib/active-organization';
import { isFocusLeaving } from '@/lib/focus';
import { useUIStore } from '@/lib/store';
import { cn } from '@/lib/utils';

type OrgSwitcherProps = {
  organizations: OrganizationSummary[];
  activeOrganizationId: string;
  className?: string;
};

/**
 * Switch the household (or collective, community, workplace) the app shows. The server action
 * checks membership and stores the choice in an httpOnly cookie; the page then re-renders.
 *
 * A disclosure (button + list of buttons), not an ARIA menu: Tab moves through the spaces, and
 * Escape or moving focus away closes it.
 */
export function OrgSwitcher({ organizations, activeOrganizationId, className }: OrgSwitcherProps) {
  const router = useRouter();
  const showToast = useUIStore((state) => state.showToast);
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [status, setStatus] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const listId = useId();
  const active =
    organizations.find((organization) => organization.id === activeOrganizationId) ??
    organizations[0];

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  if (!active) return null;

  const handleSelect = (organization: OrganizationSummary) => {
    setOpen(false);
    // The button stays focusable while switching (aria-disabled, not disabled), so focus
    // does not fall back to the top of the page.
    buttonRef.current?.focus();
    if (organization.id === active.id || isPending) return;
    setStatus(`Switching to ${organization.name}…`);
    startTransition(async () => {
      const result = await switchActiveOrganization(organization.id);
      if (result.success) {
        setStatus(`Now viewing ${organization.name}.`);
        router.refresh();
      } else {
        const message = result.error || 'Could not switch space';
        setStatus(message);
        showToast(message, 'error');
      }
    });
  };

  return (
    <div
      ref={containerRef}
      className={cn('relative flex flex-col gap-1', className)}
      onBlur={(event) => {
        if (open && isFocusLeaving(containerRef.current, event.relatedTarget)) setOpen(false);
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape' && open) {
          // Close only this list, not the mobile drawer around it.
          event.stopPropagation();
          setOpen(false);
          buttonRef.current?.focus();
        }
      }}
    >
      <span className="px-1 text-xs font-medium uppercase tracking-wide text-gray-400">
        Space
      </span>
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-label={`Current space: ${active.name}. Switch space`}
        aria-disabled={isPending || undefined}
        onClick={() => {
          if (!isPending) setOpen((value) => !value);
        }}
        className="flex min-h-[44px] w-full items-center justify-between gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-left text-sm transition-colors hover:bg-gray-50 aria-disabled:opacity-60"
      >
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="truncate font-medium text-gray-900">{active.name}</span>
          <span className="flex items-center gap-1">
            <OrgTypeBadge type={active.type} />
            {active.role === 'viewer' && (
              <span className="text-xs text-gray-500">View only</span>
            )}
          </span>
        </span>
        <ChevronsUpDown className="h-4 w-4 shrink-0 text-gray-400" aria-hidden />
      </button>

      {open && (
        <div
          id={listId}
          className="absolute left-0 right-0 top-full z-50 mt-1 flex flex-col gap-1 rounded-lg border border-gray-200 bg-white p-1 shadow-lg"
        >
          <ul className="flex max-h-72 flex-col gap-1 overflow-y-auto" aria-label="Your spaces">
            {organizations.map((organization) => {
              const isActive = organization.id === active.id;
              return (
                <li key={organization.id}>
                  <button
                    type="button"
                    aria-current={isActive ? 'true' : undefined}
                    onClick={() => handleSelect(organization)}
                    className={cn(
                      'flex min-h-[44px] w-full items-center justify-between gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors',
                      isActive ? 'bg-primary-50 text-primary-700' : 'text-gray-700 hover:bg-gray-50'
                    )}
                  >
                    <span className="flex min-w-0 flex-col gap-0.5">
                      <span className="truncate font-medium">{organization.name}</span>
                      <OrgTypeBadge type={organization.type} className="self-start" />
                    </span>
                    {isActive && <Check className="h-4 w-4 shrink-0" aria-hidden />}
                  </button>
                </li>
              );
            })}
          </ul>
          <Link
            href="/profile/household"
            onClick={() => setOpen(false)}
            className="flex min-h-[44px] items-center gap-2 rounded-md border-t border-gray-100 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 hover:text-primary-600"
          >
            <Settings className="h-4 w-4" aria-hidden />
            Manage spaces
          </Link>
        </div>
      )}
      <span role="status" className="sr-only">
        {status}
      </span>
    </div>
  );
}

/**
 * Shareable `?org=<id>` links: switch to that organization (only if the signed-in user is a
 * member; the server action checks), then drop the parameter. Render once per layout.
 */
export function OrgDeepLink() {
  const router = useRouter();
  const showToast = useUIStore((state) => state.showToast);
  const [org, setOrg] = useQueryState('org');
  const handled = useRef<string | null>(null);

  useEffect(() => {
    if (!org || handled.current === org) return;
    handled.current = org;
    void (async () => {
      const result = await switchActiveOrganization(org);
      await setOrg(null);
      if (result.success) {
        if (result.data) showToast(`Now viewing ${result.data.name}`, 'info');
        router.refresh();
      } else {
        showToast(result.error || 'Could not open that space', 'error');
      }
    })();
  }, [org, router, setOrg, showToast]);

  return null;
}
