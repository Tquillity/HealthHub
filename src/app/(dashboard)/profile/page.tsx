import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { getProfile } from '@/actions/profile-actions';
import { ProfileClient } from '@/components/profile/profile-client';
import { User } from 'lucide-react';

export default async function ProfilePage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect('/sign-in');
  }

  const profileResult = await getProfile();

  if (!profileResult.success || !profileResult.data) {
    return (
      <div className="p-6">
        <p className="text-gray-500">Failed to load profile.</p>
      </div>
    );
  }

  const profile = profileResult.data;

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-100 text-primary-600">
          <User className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Profile</h1>
          <p className="text-gray-500">Manage your personal information and preferences</p>
        </div>
      </div>

      <div className="flex flex-col gap-6">
        {/* Personal Info Section */}
        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-xl font-semibold text-gray-900">Personal Information</h2>
          <ProfileClient profile={profile} />
        </div>
      </div>
    </div>
  );
}

