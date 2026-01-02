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

    const result = await updateProfile({
      name: formData.name,
      energyLevel: formData.energyLevel as 'low' | 'medium' | 'high',
      dietaryRestrictions,
      healthGoals,
      timezone: formData.timezone,
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
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Personal Info Section */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-900">Personal Information</h3>
        
        <div>
          <label className="block text-sm font-medium text-gray-700">Name</label>
          <Input
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            className="mt-1"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Email</label>
          <Input
            value={profile.email}
            disabled
            className="mt-1 bg-gray-50"
          />
          <p className="mt-1 text-xs text-gray-500">Email cannot be changed</p>
        </div>
      </div>

      {/* Preferences Section */}
      <div className="space-y-4 border-t border-gray-200 pt-6">
        <h3 className="text-lg font-semibold text-gray-900">Preferences</h3>

        <div>
          <label className="block text-sm font-medium text-gray-700">Energy Level</label>
          <select
            value={formData.energyLevel}
            onChange={(e) =>
              setFormData({ ...formData, energyLevel: e.target.value })
            }
            className="mt-1 flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600"
          >
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">
            Dietary Restrictions (comma-separated)
          </label>
          <Input
            value={formData.dietaryRestrictions}
            onChange={(e) =>
              setFormData({ ...formData, dietaryRestrictions: e.target.value })
            }
            placeholder="e.g., vegetarian, gluten-free, dairy-free"
            className="mt-1"
          />
          <p className="mt-1 text-xs text-gray-500">
            Separate multiple restrictions with commas
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">
            Health Goals (comma-separated)
          </label>
          <Input
            value={formData.healthGoals}
            onChange={(e) =>
              setFormData({ ...formData, healthGoals: e.target.value })
            }
            placeholder="e.g., weight loss, muscle gain, heart health"
            className="mt-1"
          />
          <p className="mt-1 text-xs text-gray-500">
            Separate multiple goals with commas
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Timezone</label>
          <Input
            value={formData.timezone}
            onChange={(e) =>
              setFormData({ ...formData, timezone: e.target.value })
            }
            placeholder="UTC"
            className="mt-1"
          />
        </div>
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

