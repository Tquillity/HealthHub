export type ProtectedNavIconName =
  | 'layout-dashboard'
  | 'timer'
  | 'utensils-crossed'
  | 'calendar-days'
  | 'sparkles'
  | 'book-open'
  | 'moon'
  | 'graduation-cap'
  | 'shopping-cart'
  | 'user';

export type ProtectedNavItem = {
  name: string;
  href: string;
  icon: ProtectedNavIconName;
};

export const protectedNavItems: ProtectedNavItem[] = [
  { name: 'Dashboard', href: '/dashboard', icon: 'layout-dashboard' },
  { name: 'Focus Timer', href: '/timer', icon: 'timer' },
  { name: 'Recipes', href: '/recipes', icon: 'utensils-crossed' },
  { name: 'Meal Planner', href: '/meal-planner', icon: 'calendar-days' },
  { name: 'Routines', href: '/routines', icon: 'sparkles' },
  { name: 'Journal', href: '/journal', icon: 'book-open' },
  { name: 'Cycle', href: '/cycle', icon: 'moon' },
  { name: 'Learn', href: '/learn', icon: 'graduation-cap' },
  { name: 'Groceries', href: '/groceries', icon: 'shopping-cart' },
  { name: 'Profile', href: '/profile', icon: 'user' },
];
