'use client';

import type { LucideIcon } from 'lucide-react';
import {
  BookOpen,
  CalendarDays,
  GraduationCap,
  LayoutDashboard,
  Moon,
  ShoppingCart,
  Sparkles,
  Timer,
  User,
  UtensilsCrossed,
} from 'lucide-react';
import type { ProtectedNavIconName } from '@/components/layout/protected-nav-items';

const ICONS: Record<ProtectedNavIconName, LucideIcon> = {
  'layout-dashboard': LayoutDashboard,
  timer: Timer,
  'utensils-crossed': UtensilsCrossed,
  'calendar-days': CalendarDays,
  sparkles: Sparkles,
  'book-open': BookOpen,
  moon: Moon,
  'graduation-cap': GraduationCap,
  'shopping-cart': ShoppingCart,
  user: User,
};

type ProtectedNavIconProps = {
  name: ProtectedNavIconName;
  className?: string;
};

export function ProtectedNavIcon({ name, className }: ProtectedNavIconProps) {
  const Icon = ICONS[name];
  return <Icon className={className} aria-hidden />;
}
