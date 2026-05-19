'use client';

import { RoutineCard } from './routine-card';
import type { Routine } from '@prisma/client';

interface RoutinesGridProps {
  routines: Routine[];
}

export function RoutinesGrid({ routines }: RoutinesGridProps) {
  // Note: Admin controls are handled by RoutinesClient parent component
  const isAdmin = false; // This component doesn't need admin check

  const handleEdit = (_routine: Routine) => {
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

