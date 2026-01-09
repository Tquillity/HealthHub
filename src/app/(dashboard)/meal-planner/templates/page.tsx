import { getMealPlanTemplates } from '@/actions/meal-actions';
import { getProfile } from '@/actions/profile-actions';
import { MealPlanTemplatesClient } from '@/components/meals/meal-plan-templates-client';
import { redirect } from 'next/navigation';

export default async function MealPlanTemplatesPage() {
  const profileResult = await getProfile();
  
  if (!profileResult.success || !profileResult.data) {
    redirect('/sign-in');
  }

  const templatesResult = await getMealPlanTemplates();

  return (
    <div className="flex h-full flex-col p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Meal Plan Templates</h1>
        <p className="text-gray-500">
          Manage your saved meal plan templates. Edit, duplicate, or share them with others.
        </p>
      </div>

      <MealPlanTemplatesClient
        initialTemplates={templatesResult.success ? templatesResult.data || [] : []}
      />
    </div>
  );
}

