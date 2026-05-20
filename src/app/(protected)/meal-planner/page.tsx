import { getWeeklyPlan } from '@/actions/meal-actions';
import { getProfile } from '@/actions/profile-actions';
import MealBoard from '@/components/meals/meal-board';
import { MealPlanGenerator } from '@/components/meals/meal-plan-generator';
import { MealPlannerSettings } from '@/components/meals/meal-planner-settings';
import { PrintManager } from '@/components/printables/print-manager';
import { ClearAllMealsButton } from '@/components/meals/clear-all-meals-button';
import { SaveTemplateButton } from '@/components/meals/save-template-button';
import { Button } from '@/components/ui/button';
import { ShoppingCart, BookOpen } from 'lucide-react';
import Link from 'next/link';
import { PageHeader } from '@/components/ui/page-header';
import { AppErrorBoundary } from '@/components/ui/error-boundary';
import { redirect } from 'next/navigation';

export default async function MealPlannerPage() {
  const { plan, recipes, duration, startDate, endDate, useDefaultStart } =
    await getWeeklyPlan();
  const profileResult = await getProfile();

  if (!profileResult.success || !profileResult.data) {
    redirect('/sign-in');
  }

  const user = profileResult.data;

  return (
    <div className="flex h-full flex-col p-6">
      <PageHeader
        className="mb-6"
        actionsClassName="w-full sm:w-auto sm:max-w-[70%] sm:justify-end"
        title="Meal Planner"
        description="Drag recipes onto your schedule or generate a plan."
        actions={
          <>
          <MealPlannerSettings
            initialDuration={user.mealPlanDuration}
            initialStartDate={user.mealPlanStartDate}
          />
          <ClearAllMealsButton planId={plan.id} />
          <SaveTemplateButton planId={plan.id} />
          <PrintManager plan={plan} startDate={startDate} />
          <MealPlanGenerator />
          <Link href="/meal-planner/templates">
            <Button variant="outline" className="gap-2 min-h-[44px]">
              <BookOpen className="h-4 w-4" />
              Templates
            </Button>
          </Link>
          <Link href="/groceries">
            <Button className="gap-2 min-h-[44px]">
              <ShoppingCart className="h-4 w-4" />
              Generate Grocery List
            </Button>
          </Link>
          </>
        }
      />

      <AppErrorBoundary sectionLabel="Meal planner">
        <MealBoard
          plan={plan}
          recipes={recipes}
          duration={duration}
          startDate={startDate}
          endDate={endDate}
          useDefaultStart={useDefaultStart}
        />
      </AppErrorBoundary>
    </div>
  );
}
