'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { OrganizationType } from '@prisma/client';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { createOrganization } from '@/actions/household-actions';
import { ORG_POLICIES, ORGANIZATION_TYPES } from '@/lib/org-policy';
import { useUIStore } from '@/lib/store';

export function CreateOrganizationForm({ className }: { className?: string }) {
  const router = useRouter();
  const showToast = useUIStore((state) => state.showToast);
  const [name, setName] = useState('');
  const [type, setType] = useState<OrganizationType>('HOUSEHOLD');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsSubmitting(true);
    const result = await createOrganization({ name, type });
    setIsSubmitting(false);
    if (result.success) {
      showToast(`${name.trim()} is ready. You're now viewing it.`, 'success');
      setName('');
      setType('HOUSEHOLD');
      router.refresh();
    } else {
      showToast(result.error || 'Could not create the space', 'error');
    }
  };

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="text-lg">Start a new space</CardTitle>
        <CardDescription>
          A second home, a shared house or a group. You will be its owner.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="org-name" className="text-sm font-medium text-gray-700">
              Name
            </label>
            <Input
              id="org-name"
              name="org-name"
              value={name}
              maxLength={80}
              onChange={(event) => setName(event.target.value)}
              placeholder="Summer house"
              required
              disabled={isSubmitting}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="org-type" className="text-sm font-medium text-gray-700">
              Type
            </label>
            <select
              id="org-type"
              name="org-type"
              value={type}
              onChange={(event) => setType(event.target.value as OrganizationType)}
              aria-describedby="org-type-help"
              className="min-h-[44px] w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600"
              disabled={isSubmitting}
            >
              {ORGANIZATION_TYPES.map((option) => (
                <option key={option} value={option}>
                  {ORG_POLICIES[option].label}
                </option>
              ))}
            </select>
            <p id="org-type-help" className="text-xs text-gray-500">
              {ORG_POLICIES[type].description}
            </p>
          </div>
          <Button
            type="submit"
            variant="outline"
            disabled={isSubmitting || !name.trim()}
            className="gap-2 self-end"
          >
            <Plus className="h-4 w-4" aria-hidden />
            {isSubmitting ? 'Creating…' : 'Create'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
