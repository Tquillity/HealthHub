'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { saveMealPlanAsTemplate } from '@/actions/meal-actions';
import { Save } from 'lucide-react';

interface SaveTemplateButtonProps {
  planId: string;
  disabled?: boolean;
}

export function SaveTemplateButton({
  planId,
  disabled = false,
}: SaveTemplateButtonProps) {
  const router = useRouter();
  const [showDialog, setShowDialog] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
  });

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setError(null);

    const result = await saveMealPlanAsTemplate({
      planId,
      name: formData.name,
      description: formData.description || undefined,
    });

    setIsSaving(false);

    if (result.success) {
      setShowDialog(false);
      setFormData({ name: '', description: '' });
      setError(null);
      router.refresh();
    } else {
      setError(result.error || 'Failed to save template');
    }
  };

  return (
    <>
      <Button
        onClick={() => {
          setShowDialog(true);
          setError(null);
        }}
        variant="outline"
        className="gap-2 min-h-[44px]"
        disabled={disabled}
      >
        <Save className="h-4 w-4" />
        Save as Template
      </Button>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold text-gray-900">
              Save Meal Plan as Template
            </DialogTitle>
            <DialogDescription className="mt-1 text-sm text-gray-500">
              Save your current meal plan as a reusable template that you can apply to future weeks.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSave} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="template-name"
                className="text-sm font-medium text-gray-700"
              >
                Template Name <span className="text-red-500">*</span>
              </label>
              <Input
                id="template-name"
                type="text"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                placeholder="e.g., Weekly Meal Plan, Healthy Week"
                required
                autoFocus
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="template-description"
                className="text-sm font-medium text-gray-700"
              >
                Description (optional)
              </label>
              <Input
                id="template-description"
                type="text"
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                placeholder="Brief description of this template"
              />
            </div>

            {error && (
              <div className="rounded-lg bg-red-50 border border-red-200 p-3">
                <p className="text-sm text-red-800">{error}</p>
              </div>
            )}

            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowDialog(false);
                  setFormData({ name: '', description: '' });
                  setError(null);
                }}
                disabled={isSaving}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSaving || !formData.name.trim()} className="gap-2">
                <Save className="h-4 w-4" />
                {isSaving ? 'Saving...' : 'Save Template'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

