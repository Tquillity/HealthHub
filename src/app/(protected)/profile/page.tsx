import { redirect } from 'next/navigation';
import { getServerSession } from '@/lib/session';
import { getProfile } from '@/actions/profile-actions';
import { ProfileClient } from '@/components/profile/profile-client';
import { Users, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { PageHeader } from '@/components/ui/page-header';

export default async function ProfilePage() {
  const session = await getServerSession();

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
      <PageHeader
        className="mb-6"
        title="Profile"
        description="Manage your personal information and preferences"
      />

      <div className="flex flex-col gap-6">
        {/* Personal Info Section */}
        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-xl font-semibold text-gray-900">
            Personal Information
          </h2>
          <ProfileClient profile={profile} />
        </div>

        {/* Household Section */}
        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-100 text-primary-600">
                <Users className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-gray-900">Household</h2>
                <p className="text-sm text-gray-500">
                  Manage household members and invitations
                </p>
              </div>
            </div>
            <Link
              href="/profile/household"
              className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-primary-600 transition-colors hover:bg-primary-50"
            >
              Manage
              <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
