'use client';

import { RoutineCard } from './routine-card';
import { useRouter } from 'next/navigation';
import type { Routine } from '@prisma/client';

interface RoutinesGridProps {
  routines: Routine[];
}

export function RoutinesGrid({ routines }: RoutinesGridProps) {
  const router = useRouter();

  // Check if user is admin (we'll pass this as prop later)
  const isAdmin = true; // TODO: Get from props

  const handleEdit = (routine: Routine) => {
    // This will be handled by RoutinesClient
  };

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {routines.map((routine) => (
        <RoutineCard
          key={routine.id}
          routine={routine}
          onEdit={isAdmin ? handleEdit : undefined}
          showAdminControls={isAdmin}
        />
      ))}
    </div>
  );
}

