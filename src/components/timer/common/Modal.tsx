'use client';

import { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/pomo/utils/cn';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

export const Modal = ({ isOpen, onClose, title, children }: ModalProps) => {
  const modalRef = useRef<HTMLDivElement>(null);
  const triggerElementRef = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const focusTimeoutRef = useRef<number | null>(null);
  const previousOverflowRef = useRef<string>('');

  useEffect(() => {
    if (isOpen) {
      triggerElementRef.current = document.activeElement as HTMLElement;
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();

      if (e.key === 'Tab' && modalRef.current) {
        const focusableSelector = [
          'a[href]',
          'area[href]',
          'input:not([disabled])',
          'select:not([disabled])',
          'textarea:not([disabled])',
          'button:not([disabled])',
          'iframe',
          'object',
          'embed',
          '[contenteditable]',
          'audio[controls]',
          'video[controls]',
          'summary',
          '[tabindex]:not([tabindex="-1"])'
        ].join(',');
        
        const focusables = Array.from(
          modalRef.current.querySelectorAll<HTMLElement>(focusableSelector)
        ).filter(el => {
          const style = window.getComputedStyle(el);
          return style.display !== 'none' && style.visibility !== 'hidden';
        });
        
        if (focusables.length === 0) return;
        
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        const activeElement = document.activeElement as HTMLElement;
        
        if (e.shiftKey && activeElement === first) {
          last.focus();
          e.preventDefault();
        } else if (!e.shiftKey && activeElement === last) {
          first.focus();
          e.preventDefault();
        }
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      previousOverflowRef.current = document.body.style.overflow || '';
      document.body.style.overflow = 'hidden';

      focusTimeoutRef.current = window.setTimeout(() => {
        const focusableSelector = [
          'a[href]',
          'area[href]',
          'input:not([disabled])',
          'select:not([disabled])',
          'textarea:not([disabled])',
          'button:not([disabled])',
          'iframe',
          'object',
          'embed',
          '[contenteditable]',
          'audio[controls]',
          'video[controls]',
          'summary',
          '[tabindex]:not([tabindex="-1"])'
        ].join(',');
        
        const focusables = Array.from(
          modalRef.current?.querySelectorAll<HTMLElement>(focusableSelector) ?? []
        ).filter(el => {
          const style = window.getComputedStyle(el);
          return style.display !== 'none' && style.visibility !== 'hidden';
        });
        (focusables[0] ?? modalRef.current)?.focus();
      }, 0);
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflowRef.current;

      if (focusTimeoutRef.current !== null) {
        window.clearTimeout(focusTimeoutRef.current);
        focusTimeoutRef.current = null;
      }
      
      if (triggerElementRef.current) {
        triggerElementRef.current.focus();
        triggerElementRef.current = null;
      }
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200 cursor-pointer"
      onClick={onClose}
    >
      <div
        ref={modalRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
        className={cn(
          "app-modal-shell bg-(--theme-primary) brightness-95 text-white w-full max-w-xl rounded-[28px] overflow-hidden transform transition-all animate-in zoom-in-95 duration-200 mx-2 flex flex-col max-h-[85vh] cursor-default outline-none",
        )}
      >
        <div className="app-modal-header flex justify-between items-center gap-4">
          <h2 id={titleId} className="app-card-title">{title}</h2>
          <button
            onClick={onClose}
            className="text-white/70 hover:text-white transition-colors p-1.5 hover:bg-white/10 rounded-full"
            aria-label="Close"
            title="Close"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="app-modal-body overflow-y-auto custom-scrollbar flex-1">
          {children}
        </div>
      </div>
    </div>,
    document.body
  );
};
