import Link from 'next/link';
import { BookOpen, Sparkles, Timer, UtensilsCrossed } from 'lucide-react';
import { Button } from '@/components/ui/button';

/** Static links into the main tools. Part of the dashboard shell, so it renders without data. */
export function DashboardQuickActions() {
  return (
    <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
      <h2 className="text-xl font-semibold text-gray-900 mb-5">Quick Actions</h2>
      <div className="flex flex-col gap-3">
        <Link href="/timer" className="block">
          <Button className="w-full gap-2 bg-primary-600 hover:bg-primary-700">
            <Timer className="h-4 w-4" />
            Focus Now
          </Button>
        </Link>
        <Link href="/routines" className="block">
          <Button className="w-full gap-2 bg-wellness-500 hover:bg-wellness-600 text-white">
            <Sparkles className="h-4 w-4" />
            Try Routine Lottery
          </Button>
        </Link>
        <Link href="/meal-planner" className="block">
          <Button className="w-full gap-2 bg-gray-600 hover:bg-gray-700 text-white">
            <UtensilsCrossed className="h-4 w-4" />
            Plan Meals
          </Button>
        </Link>
        <Link href="/recipes" className="block">
          <Button className="w-full gap-2" variant="outline">
            <BookOpen className="h-4 w-4" />
            Browse Recipes
          </Button>
        </Link>
      </div>
    </div>
  );
}
