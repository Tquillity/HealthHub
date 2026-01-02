import { getWeeklyPlan } from '@/actions/meal-actions';
import MealBoard from '@/components/meals/meal-board';
import { MealPlanGenerator } from '@/components/meals/meal-plan-generator';
import { Button } from '@/components/ui/button';
import { ShoppingCart } from 'lucide-react';
import Link from 'next/link';

export default async function MealPlannerPage() {
  const { plan, recipes } = await getWeeklyPlan();

  return (
    <div className="flex h-full flex-col p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Meal Planner</h1>
          <p className="text-gray-500">Drag recipes onto your weekly schedule or generate a plan.</p>
        </div>
        <div className="flex gap-2">
          <MealPlanGenerator />
          <Link href="/groceries">
            <Button className="gap-2">
              <ShoppingCart className="h-4 w-4" />
              Generate Grocery List
            </Button>
          </Link>
        </div>
      </div>

      <MealBoard plan={plan} recipes={recipes} />
    </div>
  );
}


