'use client';

/**
 * Phase Drawer Component (Mobile)
 * 
 * Bottom drawer component for mobile phase deep-dive exploration.
 * Slides up from the bottom when user clicks a phase area on mobile.
 * 
 * Features:
 * - Smooth slide-up animation
 * - Backdrop overlay
 * - Swipe-to-close gesture support
 * - Full phase information in mobile-optimized layout
 * - Accessibility: proper ARIA labels and keyboard navigation
 */

import { useEffect, useState } from 'react';
import { CyclePhase } from '@/lib/cycle-calculator';
import { PhaseDeepDive } from './phase-deep-dive';
import { X } from 'lucide-react';

interface PhaseDrawerProps {
  isOpen: boolean;
  phase: CyclePhase | null;
  currentPhase: CyclePhase;
  focusPreference: 'hormonal' | 'workout' | 'both';
  onClose: () => void;
}

export function PhaseDrawer({
  isOpen,
  phase,
  currentPhase,
  focusPreference,
  onClose,
}: PhaseDrawerProps) {
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    if (isOpen) {
      // Prevent body scroll when drawer is open
      document.body.style.overflow = 'hidden';
      // Trigger animation
      setTimeout(() => setIsAnimating(true), 10);
    } else {
      document.body.style.overflow = '';
      setIsAnimating(false);
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onClose]);

  if (!isOpen || !phase) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black/50 z-40 transition-opacity duration-300 ${
          isAnimating ? 'opacity-100' : 'opacity-0'
        }`}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer */}
      <div
        className={`fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-2xl shadow-2xl max-h-[90vh] overflow-y-auto transition-transform duration-300 ease-out ${
          isAnimating ? 'translate-y-0' : 'translate-y-full'
        }`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="phase-drawer-title"
      >
        {/* Handle bar */}
        <div className="sticky top-0 bg-white z-10 pt-4 pb-2 flex items-center justify-center border-b border-gray-200">
          <div className="w-12 h-1.5 bg-gray-300 rounded-full" />
          <h2 id="phase-drawer-title" className="sr-only">
            Phase Deep Dive
          </h2>
          <button
            onClick={onClose}
            className="absolute right-4 p-2 text-gray-500 hover:text-gray-700 transition-colors"
            aria-label="Close drawer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          <PhaseDeepDive
            phase={phase}
            currentPhase={currentPhase}
            focusPreference={focusPreference}
            onClose={onClose}
          />
        </div>
      </div>
    </>
  );
}

