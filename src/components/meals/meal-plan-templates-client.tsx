'use client';

import { useState, useEffect } from 'react';
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
import {
  deleteMealPlanTemplate,
  duplicateMealPlanTemplate,
  updateMealPlanTemplate,
  applyMealPlanTemplate,
  getMealPlanTemplates,
  getWeeklyPlan,
} from '@/actions/meal-actions';
import { SafeDeleteModal } from '@/components/ui/safe-delete-modal';
import { Edit2, Trash2, Copy, Check, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';

type MealPlanTemplate = {
  id: string;
  name: string;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
  items: Array<{
    id: string;
    dayOffset: number;
    mealType: string;
    servings: number;
    recipe: {
      id: string;
      name: string;
      imageUrl: string | null;
      category: string | null;
    };
  }>;
};

interface MealPlanTemplatesClientProps {
  initialTemplates: MealPlanTemplate[];
}

export function MealPlanTemplatesClient({
  initialTemplates,
}: MealPlanTemplatesClientProps) {
  const router = useRouter();
  const [templates, setTemplates] =
    useState<MealPlanTemplate[]>(initialTemplates);
  const [editingTemplate, setEditingTemplate] =
    useState<MealPlanTemplate | null>(null);
  const [editFormData, setEditFormData] = useState({
    name: '',
    description: '',
  });
  const [isSaving, setIsSaving] = useState(false);
  const [deleteTemplate, setDeleteTemplate] = useState<MealPlanTemplate | null>(
    null
  );
  // Sharing is hidden until the public /meal-planner/templates/shared/[token] route exists (MEAL-17).
  const [confirmApplyTemplate, setConfirmApplyTemplate] =
    useState<MealPlanTemplate | null>(null);
  const [applyingTemplate, setApplyingTemplate] = useState<string | null>(null);

  useEffect(() => {
    // Refresh templates when needed
    const refreshTemplates = async () => {
      const result = await getMealPlanTemplates();
      if (result.success && result.data) {
        setTemplates(result.data);
      }
    };
    refreshTemplates();
  }, []);

  const handleEdit = (template: MealPlanTemplate) => {
    setEditingTemplate(template);
    setEditFormData({
      name: template.name,
      description: template.description || '',
    });
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTemplate) return;

    setIsSaving(true);
    const result = await updateMealPlanTemplate({
      id: editingTemplate.id,
      name: editFormData.name,
      description: editFormData.description || undefined,
    });

    setIsSaving(false);

    if (result.success) {
      setEditingTemplate(null);
      setEditFormData({ name: '', description: '' });
      // Refresh templates
      const refreshResult = await getMealPlanTemplates();
      if (refreshResult.success && refreshResult.data) {
        setTemplates(refreshResult.data);
      }
    } else {
      alert(result.error || 'Failed to update template');
    }
  };

  const handleDelete = async () => {
    if (!deleteTemplate) return;

    const result = await deleteMealPlanTemplate(deleteTemplate.id);
    if (result.success) {
      setDeleteTemplate(null);
      // Refresh templates
      const refreshResult = await getMealPlanTemplates();
      if (refreshResult.success && refreshResult.data) {
        setTemplates(refreshResult.data);
      }
    } else {
      alert(result.error || 'Failed to delete template');
    }
  };

  const handleDuplicate = async (template: MealPlanTemplate) => {
    const result = await duplicateMealPlanTemplate(template.id);
    if (result.success) {
      // Refresh templates
      const refreshResult = await getMealPlanTemplates();
      if (refreshResult.success && refreshResult.data) {
        setTemplates(refreshResult.data);
      }
    } else {
      alert(result.error || 'Failed to duplicate template');
    }
  };

  const handleApply = async (template: MealPlanTemplate) => {
    setApplyingTemplate(template.id);

    try {
      // Get current meal plan
      const planResult = await getWeeklyPlan();
      if (!planResult || !planResult.plan) {
        alert('Failed to load current meal plan');
        setApplyingTemplate(null);
        return;
      }

      // Create date string in YYYY-MM-DD format using local date components
      // This ensures the template starts from "today" in the user's local timezone
      // Using local date components prevents timezone conversion issues
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      // Use local date components, not UTC, to preserve the user's "today"
      const year = today.getFullYear();
      const month = String(today.getMonth() + 1).padStart(2, '0');
      const day = String(today.getDate()).padStart(2, '0');
      const dateString = `${year}-${month}-${day}`;

      const result = await applyMealPlanTemplate(
        template.id,
        planResult.plan.id,
        dateString
      );

      setApplyingTemplate(null);

      if (result.success) {
        setConfirmApplyTemplate(null);
        router.push('/meal-planner');
        router.refresh();
      } else {
        alert(result.error || 'Failed to apply template');
      }
    } catch {
      setApplyingTemplate(null);
      alert('Failed to load current meal plan. Please try again.');
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {templates.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-white p-12 text-center">
          <p className="text-gray-500">
            No templates yet. Save a meal plan as a template to get started.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {templates.map((template) => (
            <div
              key={template.id}
              className="flex flex-col gap-4 rounded-lg border border-gray-200 bg-white p-4 shadow-sm"
            >
              <div className="flex flex-col gap-2">
                <h3 className="text-lg font-semibold text-gray-900">
                  {template.name}
                </h3>
                {template.description && (
                  <p className="text-sm text-gray-600">
                    {template.description}
                  </p>
                )}
                <div className="flex flex-col gap-1 text-xs text-gray-500">
                  <p>
                    {template.items.length} meal
                    {template.items.length !== 1 ? 's' : ''}
                  </p>
                  <p>
                    Created{' '}
                    {format(new Date(template.createdAt), 'MMM d, yyyy')}
                  </p>
                </div>
              </div>

              <div className="mt-auto flex flex-wrap gap-2">
                <Button
                  onClick={() => setConfirmApplyTemplate(template)}
                  size="sm"
                  className="flex-1 gap-2 min-h-[44px]"
                  disabled={applyingTemplate === template.id}
                >
                  {applyingTemplate === template.id ? (
                    <>Applying...</>
                  ) : (
                    <>
                      <Check className="h-4 w-4" />
                      Apply
                    </>
                  )}
                </Button>
                <Button
                  onClick={() => handleEdit(template)}
                  size="sm"
                  variant="outline"
                  className="gap-2 min-h-[44px]"
                >
                  <Edit2 className="h-4 w-4" />
                  Edit
                </Button>
                <Button
                  onClick={() => handleDuplicate(template)}
                  size="sm"
                  variant="outline"
                  className="gap-2 min-h-[44px]"
                >
                  <Copy className="h-4 w-4" />
                  Copy
                </Button>
                <Button
                  onClick={() => setDeleteTemplate(template)}
                  size="sm"
                  variant="outline"
                  className="gap-2 min-h-[44px] text-red-600 hover:text-red-700 hover:bg-red-50"
                >
                  <Trash2 className="h-4 w-4" />
                  Delete
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog
        open={!!editingTemplate}
        onOpenChange={(open) => !open && setEditingTemplate(null)}
      >
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold text-gray-900">
              Edit Template
            </DialogTitle>
            <DialogDescription className="mt-1 text-sm text-gray-500">
              Update the name and description of this template.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveEdit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="edit-template-name"
                className="text-sm font-medium text-gray-700"
              >
                Template Name <span className="text-red-500">*</span>
              </label>
              <Input
                id="edit-template-name"
                type="text"
                value={editFormData.name}
                onChange={(e) =>
                  setEditFormData({ ...editFormData, name: e.target.value })
                }
                required
                autoFocus
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="edit-template-description"
                className="text-sm font-medium text-gray-700"
              >
                Description (optional)
              </label>
              <Input
                id="edit-template-description"
                type="text"
                value={editFormData.description}
                onChange={(e) =>
                  setEditFormData({
                    ...editFormData,
                    description: e.target.value,
                  })
                }
              />
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setEditingTemplate(null);
                  setEditFormData({ name: '', description: '' });
                }}
                disabled={isSaving}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSaving || !editFormData.name.trim()}
                className="gap-2"
              >
                <Check className="h-4 w-4" />
                {isSaving ? 'Saving...' : 'Save Changes'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Modal */}
      {deleteTemplate && (
        <SafeDeleteModal
          isOpen={!!deleteTemplate}
          onClose={() => setDeleteTemplate(null)}
          onConfirm={handleDelete}
          title="Delete Template"
          itemName={deleteTemplate.name}
          description="This will permanently delete this template. This action cannot be undone."
        />
      )}

      {/* Apply confirmation: applying replaces every meal in the current plan */}
      <Dialog
        open={!!confirmApplyTemplate}
        onOpenChange={(open) => {
          if (!open && !applyingTemplate) setConfirmApplyTemplate(null);
        }}
      >
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100">
                <AlertTriangle className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <DialogTitle className="text-lg font-semibold text-gray-900">
                  Apply Template
                </DialogTitle>
                <DialogDescription className="mt-1 text-sm text-gray-500">
                  This replaces all meals in your current meal plan. This action
                  cannot be undone.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="py-4">
            <p className="text-sm text-gray-700">
              Apply{' '}
              <span className="font-semibold text-gray-900">
                &quot;{confirmApplyTemplate?.name}&quot;
              </span>{' '}
              starting today?
            </p>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setConfirmApplyTemplate(null)}
              disabled={!!applyingTemplate}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() =>
                confirmApplyTemplate && handleApply(confirmApplyTemplate)
              }
              disabled={!!applyingTemplate}
              className="gap-2"
            >
              <Check className="h-4 w-4" />
              {applyingTemplate ? 'Applying...' : 'Replace plan'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
