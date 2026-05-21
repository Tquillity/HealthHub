'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ProtectedNavItem } from '@/components/layout/protected-nav-items';
import { ProtectedNavIcon } from '@/components/layout/protected-nav-icon';

type ProtectedMobileNavProps = {
  items: ProtectedNavItem[];
  userName: string;
};

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function getFocusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (element) => !element.hasAttribute('disabled') && element.tabIndex !== -1
  );
}

export function ProtectedMobileNav({ items, userName }: ProtectedMobileNavProps) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLElement>(null);

  const closeMenu = () => {
    setOpen(false);
    menuButtonRef.current?.focus();
  };

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) {
      return;
    }
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeMenu();
        return;
      }

      if (event.key !== 'Tab' || !drawerRef.current) {
        return;
      }

      const focusables = getFocusableElements(drawerRef.current);
      if (focusables.length === 0) {
        return;
      }

      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement;

      if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open]);

  useEffect(() => {
    if (!open || !drawerRef.current) {
      return;
    }
    const focusables = getFocusableElements(drawerRef.current);
    focusables[0]?.focus();
  }, [open]);

  return (
    <div className="md:hidden">
      <button
        ref={menuButtonRef}
        type="button"
        className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-gray-700 transition-colors hover:bg-gray-100"
        aria-expanded={open}
        aria-controls="protected-mobile-nav-drawer"
        aria-label={open ? 'Close navigation menu' : 'Open navigation menu'}
        onClick={() => setOpen((value) => !value)}
      >
        {open ? <X className="h-5 w-5" aria-hidden /> : <Menu className="h-5 w-5" aria-hidden />}
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/40"
            aria-label="Close navigation menu"
            onClick={closeMenu}
          />
          <aside
            ref={drawerRef}
            id="protected-mobile-nav-drawer"
            role="dialog"
            aria-modal="true"
            aria-label="Main navigation"
            className="relative flex h-full w-72 max-w-[85vw] flex-col border-r border-gray-200 bg-white p-6 shadow-xl"
          >
            <div className="mb-6 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-lg font-bold text-blue-600">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-xs text-white">
                  HH
                </div>
                HealthHub
              </div>
              <button
                type="button"
                className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-gray-600 hover:bg-gray-100"
                aria-label="Close navigation menu"
                onClick={closeMenu}
              >
                <X className="h-5 w-5" aria-hidden />
              </button>
            </div>

            <nav className="flex flex-1 flex-col gap-1 overflow-y-auto">
              {items.map((item) => {
                const isActive =
                  pathname === item.href || pathname.startsWith(`${item.href}/`);
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    aria-current={isActive ? 'page' : undefined}
                    className={cn(
                      'flex min-h-[44px] items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                      isActive
                        ? 'bg-blue-50 text-blue-600'
                        : 'text-gray-600 hover:bg-blue-50 hover:text-blue-600'
                    )}
                    onClick={closeMenu}
                  >
                    <ProtectedNavIcon name={item.icon} className="h-4 w-4 shrink-0" />
                    {item.name}
                  </Link>
                );
              })}
            </nav>

            <div className="mt-4 border-t border-gray-100 pt-4">
              <div className="flex min-h-[44px] items-center gap-3 px-3 py-2 text-sm font-medium text-gray-500">
                <ProtectedNavIcon name="user" className="h-4 w-4 shrink-0" />
                {userName}
              </div>
            </div>
          </aside>
        </div>
      ) : null}
    </div>
  );
}
