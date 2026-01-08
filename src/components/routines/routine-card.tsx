'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Edit, Trash2 } from 'lucide-react';
import { deleteRoutine } from '@/actions/routine-actions';
import { SafeDeleteModal } from '@/components/ui/safe-delete-modal';
import type { Routine } from '@prisma/client';

// Extend Routine type to include optional fields that may not be in generated types yet
type RoutineWithMetadata = Routine & {
  imageUrl?: string | null;
  context?: string | null;
  duration?: string | null;
  difficulty?: string | null;
  tags?: string[];
};

interface RoutineCardProps {
  routine: RoutineWithMetadata;
  onEdit?: (routine: RoutineWithMetadata) => void;
  onClick?: (routine: RoutineWithMetadata) => void;
  showAdminControls?: boolean;
}

const categoryIcons: Record<string, string> = {
  breathwork: '🌬️',
  meditation: '🧘',
  exercise: '💪',
  stretching: '🤸',
  mindfulness: '🧠',
  sleep: '😴',
  energy: '⚡',
};

const getContextColor = (context: string | null) => {
  switch (context) {
    case 'morning':
      return 'bg-yellow-100 text-yellow-800';
    case 'evening':
      return 'bg-purple-100 text-purple-800';
    case 'anytime':
      return 'bg-blue-100 text-blue-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
};

const getEnergyColor = (energy: string) => {
  switch (energy) {
    case 'low':
      return 'bg-green-100 text-green-800';
    case 'medium':
      return 'bg-yellow-100 text-yellow-800';
    case 'high':
      return 'bg-red-100 text-red-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
};

export function RoutineCard({
  routine,
  onEdit,
  onClick,
  showAdminControls = false,
}: RoutineCardProps) {
  const router = useRouter();
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const handleDelete = async () => {
    const result = await deleteRoutine(routine.id);
    if (result.success) {
      setShowDeleteModal(false);
      router.refresh();
    } else {
      alert(result.error || 'Failed to delete routine');
    }
  };

  return (
    <>
      <div
        className={`rounded-lg border border-gray-200 bg-white p-4 shadow-sm transition-shadow ${
          onClick ? 'cursor-pointer hover:shadow-md' : ''
        }`}
        onClick={() => onClick?.(routine)}
      >
        {/* Image */}
        {routine.imageUrl && (
          <div className="relative mb-4 aspect-video w-full overflow-hidden rounded-lg bg-gray-100">
            <img
              src={routine.imageUrl}
              alt={routine.name}
              className="h-full w-full object-cover"
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.style.display = 'none';
              }}
            />
            {showAdminControls && (
              <div className="absolute right-2 top-2 flex gap-2">
                {onEdit && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onEdit(routine);
                    }}
                    className="cursor-pointer rounded-full bg-white p-1.5 shadow-sm transition-colors hover:bg-gray-100"
                    title="Edit routine"
                  >
                    <Edit className="h-4 w-4 text-blue-600" />
                  </button>
                )}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowDeleteModal(true);
                  }}
                  className="cursor-pointer rounded-full bg-white p-1.5 shadow-sm transition-colors hover:bg-gray-100"
                  title="Delete routine"
                >
                  <Trash2 className="h-4 w-4 text-red-600" />
                </button>
              </div>
            )}
          </div>
        )}

        {/* Content */}
        <div className="flex items-start gap-2">
          <span className="text-2xl">
            {routine.category ? categoryIcons[routine.category] || '🌟' : '🌟'}
          </span>
          <div className="flex-1">
            <h3 className="font-semibold text-gray-900">{routine.name}</h3>
            {routine.description && (
              <p className="mt-1 line-clamp-2 text-sm text-gray-500">
                {routine.description}
              </p>
            )}
          </div>
        </div>

        {/* Badges */}
        <div className="mt-4 flex flex-wrap gap-2">
          {routine.context && (
            <span
              className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${getContextColor(routine.context)}`}
            >
              {routine.context}
            </span>
          )}
          <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize ${getEnergyColor(routine.energyLevel)}`}
          >
            {routine.energyLevel} energy
          </span>
          {routine.duration && (
            <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-800">
              {routine.duration}
            </span>
          )}
          {routine.difficulty && (
            <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-800 capitalize">
              {routine.difficulty}
            </span>
          )}
          {routine.tags && routine.tags.length > 0 && (
            <>
              {routine.tags.slice(0, 2).map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center rounded-full bg-primary-100 px-2 py-0.5 text-xs font-medium text-primary-700"
                >
                  {tag}
                </span>
              ))}
              {routine.tags.length > 2 && (
                <span className="text-xs text-gray-500">+{routine.tags.length - 2}</span>
              )}
            </>
          )}
        </div>
      </div>

      <SafeDeleteModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={handleDelete}
        title="Delete Routine"
        itemName={routine.name}
      />
    </>
  );
}

