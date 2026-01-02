'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Sparkles, UtensilsCrossed, BookOpen } from 'lucide-react';
import type { Routine, Recipe } from '@prisma/client';

interface DashboardClientProps {
  recentRoutines: Routine[];
  routinesCount: number;
  recipesCount: number;
  userName: string;
}

export function DashboardClient({
  recentRoutines,
  routinesCount,
  recipesCount,
  userName,
}: DashboardClientProps) {
  const firstName = userName.split(' ')[0] || userName;

  const healthTips = [
    "Starting your day with 5 minutes of deep breathing can significantly improve your energy levels and mental clarity throughout the day.",
    "Hydration is key! Aim to drink at least 8 glasses of water daily to maintain optimal body function.",
    "Regular meal planning can reduce stress and help you make healthier food choices throughout the week.",
    "Getting 7-9 hours of quality sleep each night is essential for physical recovery and mental well-being.",
    "Taking short breaks every hour during work can improve focus and reduce mental fatigue.",
  ];

  // Use useState and useEffect to avoid hydration mismatch
  // Select tip based on day of week for consistent server/client rendering
  // This ensures the same tip is shown on server and client for the same day
  const [randomTip, setRandomTip] = useState(() => {
    // Use day of week to select tip consistently (changes daily, not on each render)
    const dayOfWeek = new Date().getDay();
    const tipIndex = dayOfWeek % healthTips.length;
    return healthTips[tipIndex];
  });

  return (
    <div className="space-y-8">
      {/* Welcome Section */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-3">
          Welcome back, {firstName}!
        </h1>
        <p className="text-gray-600 text-lg">
          Ready to take care of your health and wellness today?
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Quick Actions */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900 mb-5">
              Quick Actions
            </h2>
            <div className="space-y-4">
              <Link href="/routines">
                <Button className="w-full gap-2 bg-primary-600 hover:bg-primary-700">
                  <Sparkles className="h-4 w-4" />
                  Try Routine Lottery
                </Button>
              </Link>
              <Link href="/meal-planner">
                <Button className="w-full gap-2" style={{ backgroundColor: 'rgb(34, 197, 94)', color: 'white' }} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgb(22, 163, 74)'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgb(34, 197, 94)'}>
                  <UtensilsCrossed className="h-4 w-4" />
                  Plan Meals
                </Button>
              </Link>
              <Link href="/recipes">
                <Button className="w-full gap-2 bg-gray-600 hover:bg-gray-700 text-white">
                  <BookOpen className="h-4 w-4" />
                  Browse Recipes
                </Button>
              </Link>
            </div>
          </div>

          {/* Health Tips */}
          <div className="rounded-lg p-6 border border-primary-100" style={{ background: 'linear-gradient(to bottom right, rgb(240, 249, 255), rgb(240, 253, 244))' }}>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Today's Tip
            </h3>
            <p className="text-gray-700 text-sm leading-relaxed">
              &quot;{randomTip}&quot;
            </p>
          </div>
        </div>

        {/* Statistics & Recent Routines */}
        <div className="lg:col-span-2 space-y-6">
          {/* Statistics Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-400 mb-3">
                Total Routines
              </h3>
              <p className="text-3xl font-bold text-gray-900 mb-2">{routinesCount}</p>
              <p className="text-sm text-gray-500">Available routines</p>
            </div>
            <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-400 mb-3">
                Total Recipes
              </h3>
              <p className="text-3xl font-bold text-gray-900 mb-2">{recipesCount}</p>
              <p className="text-sm text-gray-500">Available recipes</p>
            </div>
          </div>

          {/* Recent Routines */}
          {recentRoutines.length > 0 && (
            <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900 mb-5">
                Recent Routines
              </h2>
              <div className="space-y-4">
                {recentRoutines.map((routine) => (
                  <Link
                    key={routine.id}
                    href="/routines"
                    className="block rounded-lg border border-gray-200 p-4 transition-colors hover:bg-gray-50 hover:border-gray-300"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-medium text-gray-900">{routine.name}</h3>
                        {routine.description && (
                          <p className="text-sm text-gray-500 mt-1">
                            {routine.description}
                          </p>
                        )}
                      </div>
                      {routine.category && (
                        <span className="text-xs font-medium text-gray-500 capitalize">
                          {routine.category}
                        </span>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
              {recentRoutines.length >= 6 && (
                <Link
                  href="/routines"
                  className="mt-4 block text-center text-sm font-medium text-primary-600 hover:text-primary-700"
                >
                  View all routines →
                </Link>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

