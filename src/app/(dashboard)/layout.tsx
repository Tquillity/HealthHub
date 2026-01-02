import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { NavLink } from '@/components/layout/nav-link';
import { Footer } from '@/components/layout/footer';
import {
  UtensilsCrossed,
  BookOpen,
  ShoppingCart,
  LayoutDashboard,
  CalendarDays,
  User,
  Sparkles,
  GraduationCap,
} from 'lucide-react';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect('/sign-in');
  }

  const navItems = [
    { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { name: 'Recipes', href: '/recipes', icon: UtensilsCrossed },
    { name: 'Meal Planner', href: '/meal-planner', icon: CalendarDays },
    { name: 'Routines', href: '/routines', icon: Sparkles },
    { name: 'Journal', href: '/journal', icon: BookOpen },
    { name: 'Learn', href: '/learn', icon: GraduationCap },
    { name: 'Groceries', href: '/groceries', icon: ShoppingCart },
    { name: 'Profile', href: '/profile', icon: User },
  ];

  return (
    <div className="flex min-h-screen bg-gray-50 text-gray-900">
      {/* Sidebar */}
      <aside className="hidden w-64 flex-col border-r border-gray-200 bg-white p-4 md:flex">
        <div className="mb-8 flex items-center gap-2 px-2 text-xl font-bold text-blue-600">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-xs text-white">
            HH
          </div>
          HealthHub
        </div>

        <nav className="flex-1 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink key={item.name} href={item.href}>
                <Icon className="h-4 w-4" />
                {item.name}
              </NavLink>
            );
          })}
        </nav>

        <div className="mt-auto border-t border-gray-100 pt-4">
          <div className="flex items-center gap-3 px-3 py-2 text-sm font-medium text-gray-500">
            <User className="h-4 w-4" />
            {session.user.name}
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex flex-1 flex-col">
        <header className="flex h-16 items-center justify-between border-b border-gray-200 bg-white px-8">
          <div className="font-bold text-blue-600 md:hidden">HealthHub</div>
          <div className="hidden text-sm font-medium text-gray-400 md:block">
            Household Wellness Hub
          </div>
          <div className="rounded bg-gray-100 px-2 py-1 font-mono text-xs text-gray-500">
            v2.0.0
          </div>
        </header>

        <div className="flex-1 p-8">{children}</div>
        
        <Footer />
      </main>
    </div>
  );
}
