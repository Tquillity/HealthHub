import { getMealPlanTemplates } from '@/actions/meal-actions';
import { getProfile } from '@/actions/profile-actions';
import { MealPlanTemplatesClient } from '@/components/meals/meal-plan-templates-client';
import { AppErrorBoundary } from '@/components/ui/error-boundary';
import { PageHeader } from '@/components/ui/page-header';
import { redirect } from 'next/navigation';

export default async function MealPlanTemplatesPage() {
  const profileResult = await getProfile();

  if (!profileResult.success || !profileResult.data) {
    redirect('/sign-in');
  }

  const templatesResult = await getMealPlanTemplates();

  return (
    <div className="flex h-full flex-col p-6">
      <PageHeader
        className="mb-6"
        title="Meal Plan Templates"
        description="Manage your saved meal plan templates. Edit, duplicate, or share them with others."
      />

      <AppErrorBoundary sectionLabel="Meal plan templates">
        <MealPlanTemplatesClient
          initialTemplates={templatesResult.success ? templatesResult.data || [] : []}
        />
      </AppErrorBoundary>
    </div>
  );
}
