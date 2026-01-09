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
import { redirect } from 'next/navigation';

export default async function MealPlannerPage() {
  const { plan, recipes, duration, startDate, endDate, useDefaultStart } = await getWeeklyPlan();
  const profileResult = await getProfile();
  
  if (!profileResult.success || !profileResult.data) {
    redirect('/sign-in');
  }

  const user = profileResult.data;

  return (
    <div className="flex h-full flex-col p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Meal Planner</h1>
          <p className="text-gray-500">
            Drag recipes onto your schedule or generate a plan.
          </p>
        </div>
        <div className="flex gap-2">
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
        </div>
      </div>

      <MealBoard
        plan={plan}
        recipes={recipes}
        duration={duration}
        startDate={startDate}
        endDate={endDate}
        useDefaultStart={useDefaultStart}
      />
    </div>
  );
}



