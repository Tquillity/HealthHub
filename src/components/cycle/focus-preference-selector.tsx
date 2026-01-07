'use client';

/**
 * FocusPreferenceSelector Component
 * 
 * Collapsible component that allows users to change their focus preference
 * (hormonal/workout/both) directly on the cycle tracker page.
 * Ported from food-heaven project.
 */

import { useState } from 'react';
import { updateFocusPreference } from '@/actions/cycle-actions';
import { useRouter } from 'next/navigation';
import { ChevronDown, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface FocusPreferenceSelectorProps {
  currentPreference: 'hormonal' | 'workout' | 'both';
  onPreferenceChange?: () => void;
  compact?: boolean;
}

export function FocusPreferenceSelector({ currentPreference, onPreferenceChange, compact = false }: FocusPreferenceSelectorProps) {
  const [isExpanded, setIsExpanded] = useState(!compact);
  const [isUpdating, setIsUpdating] = useState(false);
  const router = useRouter();

  const handlePreferenceChange = async (newPreference: 'hormonal' | 'workout' | 'both') => {
    if (newPreference === currentPreference || isUpdating) return;

    setIsUpdating(true);
    try {
      const result = await updateFocusPreference(newPreference);
      if (result.success) {
        router.refresh();
        onPreferenceChange?.();
      } else {
        console.error('Failed to update preference:', result.error);
      }
    } catch (error) {
      console.error('Error updating preference:', error);
    } finally {
      setIsUpdating(false);
    }
  };

  const preferenceLabels: Record<'hormonal' | 'workout' | 'both', string> = {
    hormonal: 'Hormonal Balance',
    workout: 'Athletic Performance',
    both: 'Both',
  };

  // Compact mode: Icon button with dropdown
  if (compact) {
    return (
      <div className="relative">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setIsExpanded(!isExpanded)}
          className="gap-2 min-h-[44px]"
          aria-label="Focus Preference Settings"
        >
          <Settings className="h-4 w-4" />
          <span className="text-xs font-medium">{preferenceLabels[currentPreference]}</span>
          <ChevronDown
            className={`h-3 w-3 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
          />
        </Button>
        
        {isExpanded && (
          <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg border border-gray-200 shadow-lg z-10">
            <div className="flex flex-col gap-1 p-2">
              {(['hormonal', 'workout', 'both'] as const).map((focus) => (
                <button
                  key={focus}
                  onClick={() => {
                    handlePreferenceChange(focus);
                    setIsExpanded(false);
                  }}
                  disabled={isUpdating}
                  className={`px-3 py-2 rounded text-sm text-left transition-colors ${
                    currentPreference === focus
                      ? 'bg-purple-600 text-white'
                      : 'text-gray-700 hover:bg-gray-100'
                  } ${isUpdating ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {preferenceLabels[focus]}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // Full mode: Original collapsible card
  return (
    <div className="mb-6 bg-gray-50 rounded-lg border border-gray-200">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={`w-full px-4 flex justify-between items-center text-left transition-all ${
          isExpanded ? 'py-4' : 'py-2'
        }`}
      >
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-medium text-gray-900">Focus Preference</h3>
          {!isExpanded && (
            <span className="text-sm text-gray-500">
              ({preferenceLabels[currentPreference]})
            </span>
          )}
        </div>
        <ChevronDown
          className={`w-5 h-5 text-gray-500 transition-transform duration-200 ${
            isExpanded ? 'transform rotate-180' : ''
          }`}
        />
      </button>

      {isExpanded && (
        <div className="px-4 pb-4">
          <div className="flex gap-4">
            {(['hormonal', 'workout', 'both'] as const).map((focus) => (
              <button
                key={focus}
                onClick={() => handlePreferenceChange(focus)}
                disabled={isUpdating}
                className={`px-4 py-2 rounded-lg transition-colors ${
                  currentPreference === focus
                    ? 'bg-purple-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                } ${isUpdating ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {preferenceLabels[focus]}
              </button>
            ))}
          </div>
          <p className="text-xs text-gray-500 mt-2">
            Choose what type of recommendations you'd like to receive
          </p>
        </div>
      )}
    </div>
  );
}

