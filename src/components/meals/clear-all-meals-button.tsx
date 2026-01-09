'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { clearAllMeals } from '@/actions/meal-actions';
import { Trash2, AlertTriangle } from 'lucide-react';

interface ClearAllMealsButtonProps {
  planId: string;
  disabled?: boolean;
}

export function ClearAllMealsButton({
  planId,
  disabled = false,
}: ClearAllMealsButtonProps) {
  const router = useRouter();
  const [showConfirm, setShowConfirm] = useState(false);
  const [isClearing, setIsClearing] = useState(false);

  const handleClear = async () => {
    setIsClearing(true);
    const result = await clearAllMeals(planId);
    setIsClearing(false);

    if (result.success) {
      setShowConfirm(false);
      router.refresh();
    } else {
      alert(result.error || 'Failed to clear meals');
    }
  };

  return (
    <>
      <Button
        onClick={() => setShowConfirm(true)}
        variant="outline"
        className="gap-2 min-h-[44px]"
        disabled={disabled}
      >
        <Trash2 className="h-4 w-4" />
        Clear All
      </Button>

      <Dialog open={showConfirm} onOpenChange={setShowConfirm}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100">
                <AlertTriangle className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <DialogTitle className="text-lg font-semibold text-gray-900">
                  Clear All Meals
                </DialogTitle>
                <DialogDescription className="mt-1 text-sm text-gray-500">
                  This will remove all meals from your current meal plan. This action cannot be undone.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="py-4">
            <p className="text-sm text-gray-700">
              Are you sure you want to clear all meals from this meal plan?
            </p>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setShowConfirm(false)}
              disabled={isClearing}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleClear}
              disabled={isClearing}
              className="gap-2"
            >
              <Trash2 className="h-4 w-4" />
              {isClearing ? 'Clearing...' : 'Clear All'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

