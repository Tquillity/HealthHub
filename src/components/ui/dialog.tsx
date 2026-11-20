'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { restoreFocus, tabTrapTarget, useDialogOpener } from './dialog-focus';

interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
}

type DialogContentProps = React.HTMLAttributes<HTMLDivElement>;

interface DialogHeaderProps {
  children: React.ReactNode;
}

interface DialogTitleProps {
  className?: string;
  children: React.ReactNode;
}

interface DialogDescriptionProps {
  className?: string;
  children: React.ReactNode;
}

interface DialogFooterProps {
  className?: string;
  children: React.ReactNode;
}

/** Ids that tie the dialog to its title and description for screen readers. */
const DialogIdsContext = React.createContext<{
  titleId: string;
  descriptionId: string;
} | null>(null);

// `:disabled` also matches controls inside a disabled <fieldset>, which cannot take focus.
const FOCUSABLE = [
  'a[href]',
  'button:not(:disabled)',
  'input:not(:disabled):not([type="hidden"])',
  'select:not(:disabled)',
  'textarea:not(:disabled)',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

function focusableIn(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE));
}

/**
 * Modal dialog. Follows the WAI-ARIA Authoring Practices modal dialog pattern
 * (https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/): focus moves into the
 * dialog when it opens (an element with autoFocus keeps it), Tab and Shift+Tab stay
 * inside, Escape closes it, and focus returns to the element that opened it. The
 * rules themselves are in ./dialog-focus.
 */
const Dialog = ({ open, onOpenChange, children }: DialogProps) => {
  const panelRef = React.useRef<HTMLDivElement>(null);
  const opener = useDialogOpener(open);
  const onOpenChangeRef = React.useRef(onOpenChange);
  const titleId = React.useId();
  const descriptionId = React.useId();
  const ids = React.useMemo(
    () => ({ titleId, descriptionId }),
    [titleId, descriptionId]
  );

  React.useEffect(() => {
    onOpenChangeRef.current = onOpenChange;
  }, [onOpenChange]);

  React.useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  React.useEffect(() => {
    const panel = panelRef.current;
    if (!open || !panel) return;
    if (!panel.contains(document.activeElement)) {
      (focusableIn(panel)[0] ?? panel).focus();
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onOpenChangeRef.current(false);
        return;
      }
      if (event.key !== 'Tab') return;
      const items = focusableIn(panel);
      const active = document.activeElement;
      if (items.length === 0) {
        event.preventDefault();
        if (!panel.contains(active)) panel.focus();
        return;
      }
      const target = tabTrapTarget(
        items,
        active && panel.contains(active) ? active : null,
        event.shiftKey
      );
      if (target) {
        event.preventDefault();
        target.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      restoreFocus(opener, document);
    };
  }, [open, opener]);

  if (!open) return null;

  return (
    <DialogIdsContext.Provider value={ids}>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
        onClick={() => onOpenChange(false)}
      >
        <div
          ref={panelRef}
          tabIndex={-1}
          className="outline-none"
          onClick={(e) => e.stopPropagation()}
        >
          {children}
        </div>
      </div>
    </DialogIdsContext.Provider>
  );
};

const DialogContent = React.forwardRef<HTMLDivElement, DialogContentProps>(
  ({ className, children, ...props }, ref) => {
    const ids = React.useContext(DialogIdsContext);
    return (
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={ids?.titleId}
        aria-describedby={ids?.descriptionId}
        className={cn(
          'relative w-full max-w-lg rounded-lg bg-white p-6 shadow-xl',
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);
DialogContent.displayName = 'DialogContent';

const DialogHeader = ({ children }: DialogHeaderProps) => {
  return <div className="mb-4">{children}</div>;
};

const DialogTitle = React.forwardRef<HTMLHeadingElement, DialogTitleProps>(
  ({ className, children, ...props }, ref) => {
    const ids = React.useContext(DialogIdsContext);
    return (
      <h2
        ref={ref}
        id={ids?.titleId}
        className={cn('text-lg font-semibold text-gray-900', className)}
        {...props}
      >
        {children}
      </h2>
    );
  }
);
DialogTitle.displayName = 'DialogTitle';

const DialogDescription = React.forwardRef<
  HTMLParagraphElement,
  DialogDescriptionProps
>(({ className, children, ...props }, ref) => {
  const ids = React.useContext(DialogIdsContext);
  return (
    <p
      ref={ref}
      id={ids?.descriptionId}
      className={cn('mt-1 text-sm text-gray-500', className)}
      {...props}
    >
      {children}
    </p>
  );
});
DialogDescription.displayName = 'DialogDescription';

const DialogFooter = React.forwardRef<HTMLDivElement, DialogFooterProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn('mt-6 flex justify-end gap-2', className)}
        {...props}
      >
        {children}
      </div>
    );
  }
);
DialogFooter.displayName = 'DialogFooter';

export {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
};
