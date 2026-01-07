'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Trash2, Upload, X } from 'lucide-react';
import { createRoutine, updateRoutine, type Routine } from '@/actions/routine-actions';
import { uploadImage } from '@/actions/image-upload';

interface RoutineStep {
  step: number;
  title?: string;
  description: string;
  duration?: number;
  imageUrl?: string;
}

interface RoutineRichFormProps {
  routine?: Routine;
  onSuccess: () => void;
  onCancel: () => void;
}

export function RoutineRichForm({ routine, onSuccess, onCancel }: RoutineRichFormProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isEditing = !!routine;

  // Parse steps from JSON if editing
  const parseSteps = (): RoutineStep[] => {
    if (routine?.steps) {
      try {
        const parsed = typeof routine.steps === 'string' ? JSON.parse(routine.steps) : routine.steps;
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    }
    return [];
  };

  const [formData, setFormData] = useState({
    name: routine?.name || '',
    description: routine?.description || '',
    category: routine?.category || '',
    frequency: routine?.frequency || '',
    energyLevel: (routine?.energyLevel as 'low' | 'medium' | 'high') || 'medium',
    estimatedTime: routine?.estimatedTime || 15,
    imageUrl: routine?.imageUrl || '',
    context: (routine?.context as 'morning' | 'evening' | 'anytime') || 'anytime',
    duration: (routine?.duration as '5min' | '15min' | '30min' | '60min') || '15min',
    difficulty: (routine?.difficulty as 'beginner' | 'intermediate' | 'advanced') || 'beginner',
    equipment: routine?.equipment || [],
    tags: routine?.tags || [],
  });

  const [steps, setSteps] = useState<RoutineStep[]>(parseSteps());
  const [tips, setTips] = useState<string[]>(routine?.tips || []);
  const [contraindications, setContraindications] = useState<string[]>(routine?.contraindications || []);
  const [imagePreview, setImagePreview] = useState<string | null>(routine?.imageUrl || null);
  const [isUploading, setIsUploading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const categories = ['breathwork', 'meditation', 'exercise', 'stretching', 'mindfulness', 'sleep', 'energy'];
  const contexts = ['morning', 'evening', 'anytime'];
  const durations = ['5min', '15min', '30min', '60min'];
  const difficulties = ['beginner', 'intermediate', 'advanced'];

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setErrors({ ...errors, image: 'Please select an image file' });
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setErrors({ ...errors, image: 'Image size must be less than 5MB' });
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result as string);
    };
    reader.readAsDataURL(file);

    setIsUploading(true);
    const uploadFormData = new FormData();
    uploadFormData.append('file', file);

    const result = await uploadImage(uploadFormData);
    setIsUploading(false);

    if (result.success && result.url) {
      setFormData({ ...formData, imageUrl: result.url });
      setErrors({ ...errors, image: '' });
    } else {
      setErrors({ ...errors, image: result.error || 'Failed to upload image' });
      setImagePreview(null);
    }
  };

  const handleRemoveImage = () => {
    setImagePreview(null);
    setFormData({ ...formData, imageUrl: '' });
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const addStep = () => {
    setSteps([...steps, { step: steps.length + 1, description: '' }]);
  };

  const removeStep = (index: number) => {
    if (steps.length > 1) {
      const updated = steps.filter((_, i) => i !== index);
      setSteps(updated.map((s, idx) => ({ ...s, step: idx + 1 })));
    }
  };

  const updateStep = (index: number, field: keyof RoutineStep, value: string | number) => {
    const updated = [...steps];
    updated[index] = { ...updated[index], [field]: value };
    setSteps(updated);
  };

  const addTip = () => {
    setTips([...tips, '']);
  };

  const removeTip = (index: number) => {
    setTips(tips.filter((_, i) => i !== index));
  };

  const updateTip = (index: number, value: string) => {
    const updated = [...tips];
    updated[index] = value;
    setTips(updated);
  };

  const addContraindication = () => {
    setContraindications([...contraindications, '']);
  };

  const removeContraindication = (index: number) => {
    setContraindications(contraindications.filter((_, i) => i !== index));
  };

  const updateContraindication = (index: number, value: string) => {
    const updated = [...contraindications];
    updated[index] = value;
    setContraindications(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrors({});

    if (!formData.name.trim()) {
      setErrors({ name: 'Name is required' });
      setIsSubmitting(false);
      return;
    }

    const routineData = {
      ...(isEditing && { id: routine.id }),
      name: formData.name,
      description: formData.description || undefined,
      category: formData.category || undefined,
      frequency: formData.frequency || undefined,
      energyLevel: formData.energyLevel,
      estimatedTime: formData.estimatedTime,
      imageUrl: formData.imageUrl || undefined,
      context: formData.context,
      duration: formData.duration,
      difficulty: formData.difficulty,
      equipment: formData.equipment.filter(Boolean),
      tags: formData.tags.filter(Boolean),
      steps: steps.filter((s) => s.description.trim()).length > 0 ? steps.filter((s) => s.description.trim()) : undefined,
      tips: tips.filter(Boolean),
      contraindications: contraindications.filter(Boolean),
    };

    const result = isEditing
      ? await updateRoutine(routineData)
      : await createRoutine(routineData);

    if (result.success) {
      router.refresh();
      onSuccess();
    } else {
      setErrors({ submit: result.error || 'Failed to save routine' });
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6 max-h-[80vh] overflow-y-auto p-4">
      {/* Basic Info */}
      <div className="flex flex-col gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Name *</label>
          <Input
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
            className={errors.name ? 'border-red-300' : ''}
          />
          {errors.name && <p className="mt-1 text-sm text-red-600">{errors.name}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
          <textarea
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            rows={3}
            className="flex w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
          />
        </div>

        {/* Image Upload */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Image</label>
          <div className="flex flex-col gap-2">
            {imagePreview && (
              <div className="relative inline-block">
                <img src={imagePreview} alt="Preview" className="h-32 w-32 rounded-lg object-cover border border-gray-200" />
                <button
                  type="button"
                  onClick={handleRemoveImage}
                  className="absolute -top-2 -right-2 rounded-full bg-red-500 p-1 text-white hover:bg-red-600"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}
            <div className="flex gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageSelect}
                className="hidden"
                id="routine-image-upload"
              />
              <label
                htmlFor="routine-image-upload"
                className="flex cursor-pointer items-center gap-2 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                <Upload className="h-4 w-4" />
                {isUploading ? 'Uploading...' : imagePreview ? 'Change Image' : 'Upload Image'}
              </label>
              <Input
                type="url"
                value={formData.imageUrl}
                onChange={(e) => {
                  setFormData({ ...formData, imageUrl: e.target.value });
                  setImagePreview(e.target.value || null);
                }}
                placeholder="Or enter image URL"
                className="flex-1"
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
            <select
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
            >
              <option value="">Select category</option>
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat.charAt(0).toUpperCase() + cat.slice(1)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Frequency</label>
            <Input
              value={formData.frequency}
              onChange={(e) => setFormData({ ...formData, frequency: e.target.value })}
              placeholder="e.g., daily, weekly"
            />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Energy Level</label>
            <select
              value={formData.energyLevel}
              onChange={(e) => setFormData({ ...formData, energyLevel: e.target.value as 'low' | 'medium' | 'high' })}
              className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Context</label>
            <select
              value={formData.context}
              onChange={(e) => setFormData({ ...formData, context: e.target.value as 'morning' | 'evening' | 'anytime' })}
              className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
            >
              {contexts.map((ctx) => (
                <option key={ctx} value={ctx}>
                  {ctx.charAt(0).toUpperCase() + ctx.slice(1)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Duration</label>
            <select
              value={formData.duration}
              onChange={(e) => setFormData({ ...formData, duration: e.target.value as '5min' | '15min' | '30min' | '60min' })}
              className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
            >
              {durations.map((dur) => (
                <option key={dur} value={dur}>
                  {dur}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Difficulty</label>
            <select
              value={formData.difficulty}
              onChange={(e) => setFormData({ ...formData, difficulty: e.target.value as 'beginner' | 'intermediate' | 'advanced' })}
              className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
            >
              {difficulties.map((diff) => (
                <option key={diff} value={diff}>
                  {diff.charAt(0).toUpperCase() + diff.slice(1)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Estimated Time (minutes)</label>
            <Input
              type="number"
              min="1"
              value={formData.estimatedTime}
              onChange={(e) => setFormData({ ...formData, estimatedTime: parseInt(e.target.value) || 15 })}
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Equipment (comma-separated)</label>
          <Input
            value={formData.equipment.join(', ')}
            onChange={(e) => setFormData({ ...formData, equipment: e.target.value.split(',').map((t) => t.trim()).filter(Boolean) })}
            placeholder="e.g., mat, weights, resistance band"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Tags (comma-separated)</label>
          <Input
            value={formData.tags.join(', ')}
            onChange={(e) => setFormData({ ...formData, tags: e.target.value.split(',').map((t) => t.trim()).filter(Boolean) })}
            placeholder="e.g., relaxation, focus, energy"
          />
        </div>
      </div>

      {/* Steps */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">Steps</h3>
          <Button type="button" variant="outline" size="sm" onClick={addStep} className="gap-2">
            <Plus className="h-4 w-4" />
            Add Step
          </Button>
        </div>
        {steps.map((step, index) => (
          <div key={index} className="rounded-lg border border-gray-200 bg-white p-4">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700">Step {step.step}</span>
              {steps.length > 1 && (
                <Button type="button" variant="outline" size="sm" onClick={() => removeStep(index)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
            <div className="flex flex-col gap-2">
              <Input
                placeholder="Step title (optional)"
                value={step.title || ''}
                onChange={(e) => updateStep(index, 'title', e.target.value)}
              />
              <textarea
                placeholder="Step description *"
                value={step.description}
                onChange={(e) => updateStep(index, 'description', e.target.value)}
                rows={2}
                className="flex w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
                required
              />
              <div className="grid grid-cols-2 gap-2">
                <Input
                  type="number"
                  min="1"
                  placeholder="Duration (minutes, optional)"
                  value={step.duration || ''}
                  onChange={(e) => updateStep(index, 'duration', parseInt(e.target.value) || undefined)}
                />
                <Input
                  type="url"
                  placeholder="Step image URL (optional)"
                  value={step.imageUrl || ''}
                  onChange={(e) => updateStep(index, 'imageUrl', e.target.value)}
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Tips */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">Tips</h3>
          <Button type="button" variant="outline" size="sm" onClick={addTip} className="gap-2">
            <Plus className="h-4 w-4" />
            Add Tip
          </Button>
        </div>
        {tips.map((tip, index) => (
          <div key={index} className="flex gap-2">
            <Input
              placeholder="Enter a tip..."
              value={tip}
              onChange={(e) => updateTip(index, e.target.value)}
            />
            <Button type="button" variant="outline" size="sm" onClick={() => removeTip(index)}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>

      {/* Contraindications */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">Contraindications</h3>
          <Button type="button" variant="outline" size="sm" onClick={addContraindication} className="gap-2">
            <Plus className="h-4 w-4" />
            Add Contraindication
          </Button>
        </div>
        {contraindications.map((contra, index) => (
          <div key={index} className="flex gap-2">
            <Input
              placeholder="Enter a contraindication..."
              value={contra}
              onChange={(e) => updateContraindication(index, e.target.value)}
            />
            <Button type="button" variant="outline" size="sm" onClick={() => removeContraindication(index)}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>

      {errors.submit && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="text-sm text-red-600">{errors.submit}</p>
        </div>
      )}

      <div className="flex justify-end gap-3">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Saving...' : isEditing ? 'Update Routine' : 'Create Routine'}
        </Button>
      </div>
    </form>
  );
}

