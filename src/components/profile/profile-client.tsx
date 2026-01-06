'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { updateProfile } from '@/actions/profile-actions';
import { CheckCircle2 } from 'lucide-react';

interface ProfileClientProps {
  profile: {
    id: string;
    name: string;
    email: string;
    image?: string | null;
    energyLevel?: string | null;
    dietaryRestrictions: string[];
    healthGoals: string[];
    timezone?: string | null;
    enableCycleTracking?: boolean;
    cycleLength?: number;
    lastPeriodDate?: string | null;
    focusPreference?: string;
  };
}

export function ProfileClient({ profile: initialProfile }: ProfileClientProps) {
  const [profile, setProfile] = useState(initialProfile);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const [formData, setFormData] = useState({
    name: profile.name,
    energyLevel: profile.energyLevel || 'medium',
    dietaryRestrictions: profile.dietaryRestrictions.join(', '),
    healthGoals: profile.healthGoals.join(', '),
    timezone: profile.timezone || 'UTC',
    enableCycleTracking: profile.enableCycleTracking ?? false,
    cycleLength: profile.cycleLength ?? 28,
    lastPeriodDate: profile.lastPeriodDate 
      ? new Date(profile.lastPeriodDate).toISOString().split('T')[0] 
      : '',
    focusPreference: profile.focusPreference || 'both',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSuccess(false);

    // Parse comma-separated strings into arrays
    const dietaryRestrictions = formData.dietaryRestrictions
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    const healthGoals = formData.healthGoals
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    // Convert date input (YYYY-MM-DD) to ISO datetime string
    const lastPeriodDateISO = formData.lastPeriodDate
      ? `${formData.lastPeriodDate}T00:00:00.000Z`
      : null;

    const result = await updateProfile({
      name: formData.name,
      energyLevel: formData.energyLevel as 'low' | 'medium' | 'high',
      dietaryRestrictions,
      healthGoals,
      timezone: formData.timezone,
      enableCycleTracking: formData.enableCycleTracking,
      cycleLength: formData.cycleLength,
      lastPeriodDate: lastPeriodDateISO,
      focusPreference: formData.focusPreference as 'hormonal' | 'workout' | 'both',
    });

    if (result.success && result.data) {
      setProfile(result.data);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } else {
      alert(result.error || 'Failed to update profile');
    }

    setIsSubmitting(false);
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      {/* Personal Info Section */}
      <div className="flex flex-col gap-4">
        <h3 className="text-lg font-semibold text-gray-900">Personal Information</h3>
        
        <div>
          <label htmlFor="profile-name" className="block text-sm font-medium text-gray-700 mb-1.5">Name</label>
          <Input
            id="profile-name"
            name="profile-name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
          />
        </div>

        <div>
          <label htmlFor="profile-email" className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
          <Input
            id="profile-email"
            name="profile-email"
            value={profile.email}
            disabled
            className="bg-gray-50"
          />
          <p className="mt-1 text-xs text-gray-500">Email cannot be changed</p>
        </div>
      </div>

      {/* Preferences Section */}
      <div className="flex flex-col gap-4 border-t border-gray-200 pt-6">
        <h3 className="text-lg font-semibold text-gray-900">Preferences</h3>

        <div>
          <label htmlFor="profile-energy-level" className="block text-sm font-medium text-gray-700 mb-1.5">Energy Level</label>
          <select
            id="profile-energy-level"
            name="profile-energy-level"
            value={formData.energyLevel}
            onChange={(e) =>
              setFormData({ ...formData, energyLevel: e.target.value })
            }
            className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600"
          >
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
        </div>

        <div>
          <label htmlFor="profile-dietary-restrictions" className="block text-sm font-medium text-gray-700 mb-1.5">
            Dietary Restrictions (comma-separated)
          </label>
          <Input
            id="profile-dietary-restrictions"
            name="profile-dietary-restrictions"
            value={formData.dietaryRestrictions}
            onChange={(e) =>
              setFormData({ ...formData, dietaryRestrictions: e.target.value })
            }
            placeholder="e.g., vegetarian, gluten-free, dairy-free"
          />
          <p className="mt-1 text-xs text-gray-500">
            Separate multiple restrictions with commas
          </p>
        </div>

        <div>
          <label htmlFor="profile-health-goals" className="block text-sm font-medium text-gray-700 mb-1.5">
            Health Goals (comma-separated)
          </label>
          <Input
            id="profile-health-goals"
            name="profile-health-goals"
            value={formData.healthGoals}
            onChange={(e) =>
              setFormData({ ...formData, healthGoals: e.target.value })
            }
            placeholder="e.g., weight loss, muscle gain, heart health"
          />
          <p className="mt-1 text-xs text-gray-500">
            Separate multiple goals with commas
          </p>
        </div>

        <div>
          <label htmlFor="profile-timezone" className="block text-sm font-medium text-gray-700 mb-1.5">Timezone</label>
          <Input
            id="profile-timezone"
            name="profile-timezone"
            value={formData.timezone}
            onChange={(e) =>
              setFormData({ ...formData, timezone: e.target.value })
            }
            placeholder="UTC"
          />
        </div>
      </div>

      {/* Cycle Tracking Section */}
      <div className="flex flex-col gap-4 border-t border-gray-200 pt-6">
        <h3 className="text-lg font-semibold text-gray-900">Cycle Tracking</h3>

        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            id="profile-enable-cycle-tracking"
            name="profile-enable-cycle-tracking"
            checked={formData.enableCycleTracking}
            onChange={(e) =>
              setFormData({ ...formData, enableCycleTracking: e.target.checked })
            }
            className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-2 focus:ring-primary-600"
          />
          <label htmlFor="profile-enable-cycle-tracking" className="text-sm font-medium text-gray-700">
            Enable Cycle Tracking
          </label>
        </div>

        {formData.enableCycleTracking && (
          <div className="flex flex-col gap-4 pl-7">
            <div>
              <label htmlFor="profile-cycle-length" className="block text-sm font-medium text-gray-700 mb-1.5">
                Average Cycle Length (days)
              </label>
              <Input
                id="profile-cycle-length"
                name="profile-cycle-length"
                type="number"
                min="20"
                max="45"
                value={formData.cycleLength}
                onChange={(e) =>
                  setFormData({ ...formData, cycleLength: parseInt(e.target.value) || 28 })
                }
              />
              <p className="mt-1 text-xs text-gray-500">Typically 21-35 days (default: 28)</p>
            </div>

            <div>
              <label htmlFor="profile-last-period-date" className="block text-sm font-medium text-gray-700 mb-1.5">
                Last Period Start Date
              </label>
              <Input
                id="profile-last-period-date"
                name="profile-last-period-date"
                type="date"
                value={formData.lastPeriodDate}
                onChange={(e) =>
                  setFormData({ ...formData, lastPeriodDate: e.target.value })
                }
              />
              <p className="mt-1 text-xs text-gray-500">The first day of your last menstrual period</p>
            </div>

            <div>
              <label htmlFor="profile-focus-preference" className="block text-sm font-medium text-gray-700 mb-1.5">
                Focus Preference
              </label>
              <select
                id="profile-focus-preference"
                name="profile-focus-preference"
                value={formData.focusPreference}
                onChange={(e) =>
                  setFormData({ ...formData, focusPreference: e.target.value })
                }
                className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600"
              >
                <option value="both">Both (Hormonal Balance & Athletic Performance)</option>
                <option value="hormonal">Hormonal Balance</option>
                <option value="workout">Athletic Performance</option>
              </select>
              <p className="mt-1 text-xs text-gray-500">Choose what type of recommendations you'd like to receive</p>
            </div>
          </div>
        )}
      </div>

      {success && (
        <div className="flex items-center gap-2 rounded-lg bg-wellness-50 p-3 text-wellness-700">
          <CheckCircle2 className="h-5 w-5" />
          <span className="text-sm font-medium">Profile updated successfully!</span>
        </div>
      )}

      <div className="flex justify-end gap-3 pt-4">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>
    </form>
  );
}

