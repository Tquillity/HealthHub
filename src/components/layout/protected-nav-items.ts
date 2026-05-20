import type { LucideIcon } from 'lucide-react';
import {
  UtensilsCrossed,
  BookOpen,
  ShoppingCart,
  LayoutDashboard,
  CalendarDays,
  User,
  Sparkles,
  GraduationCap,
  Moon,
  Timer,
} from 'lucide-react';

export type ProtectedNavItem = {
  name: string;
  href: string;
  icon: LucideIcon;
};

export const protectedNavItems: ProtectedNavItem[] = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Focus Timer', href: '/timer', icon: Timer },
  { name: 'Recipes', href: '/recipes', icon: UtensilsCrossed },
  { name: 'Meal Planner', href: '/meal-planner', icon: CalendarDays },
  { name: 'Routines', href: '/routines', icon: Sparkles },
  { name: 'Journal', href: '/journal', icon: BookOpen },
  { name: 'Cycle', href: '/cycle', icon: Moon },
  { name: 'Learn', href: '/learn', icon: GraduationCap },
  { name: 'Groceries', href: '/groceries', icon: ShoppingCart },
  { name: 'Profile', href: '/profile', icon: User },
];
