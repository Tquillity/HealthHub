'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { inviteMember } from '@/actions/household-actions';
import { useUIStore } from '@/lib/store';
import { UserPlus } from 'lucide-react';

export function InviteMemberForm() {
  const showToast = useUIStore((state) => state.showToast);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'member' | 'admin'>('member');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    const result = await inviteMember({ email, role });

    if (result.success) {
      showToast(`Invitation sent to ${email}`, 'success');
      setEmail('');
      setRole('member');
    } else {
      showToast(result.error || 'Failed to send invitation', 'error');
    }

    setIsSubmitting(false);
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
      <div>
        <h3 className="text-lg font-semibold text-gray-900">Invite Member</h3>
        <p className="mt-1 text-sm text-gray-500">
          Send an invitation to join your household
        </p>
      </div>

      <div className="flex flex-col gap-4">
        <div>
          <label htmlFor="invite-email" className="block text-sm font-medium text-gray-700 mb-1.5">
            Email Address
          </label>
          <Input
            id="invite-email"
            name="invite-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="partner@example.com"
            required
            disabled={isSubmitting}
          />
        </div>

        <div>
          <label htmlFor="invite-role" className="block text-sm font-medium text-gray-700 mb-1.5">
            Role
          </label>
          <select
            id="invite-role"
            name="invite-role"
            value={role}
            onChange={(e) => setRole(e.target.value as 'member' | 'admin')}
            className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600"
            disabled={isSubmitting}
          >
            <option value="member">Member</option>
            <option value="admin">Admin</option>
          </select>
          <p className="mt-1 text-xs text-gray-500">
            Members can view and use shared resources. Admins can also manage recipes and routines.
          </p>
        </div>
      </div>

      <div className="flex justify-end">
        <Button type="submit" disabled={isSubmitting || !email.trim()} className="gap-2">
          <UserPlus className="h-4 w-4" />
          {isSubmitting ? 'Sending...' : 'Send Invitation'}
        </Button>
      </div>
    </form>
  );
}

