'use client';

import { X, Upload } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { categories, commonCuisines, difficulties, type RecipeFormBasicSectionProps } from './recipe-form-types';

export function RecipeFormBasicSection({
  formData,
  setFormData,
  errors,
  imagePreview,
  setImagePreview,
  fileInputRef,
  isUploading,
  isUploadingAdditional,
  additionalImages,
  isSuperadmin,
  handleImageSelect,
  handleRemoveImage,
  handleMoveToAdditional,
  handleAddAdditionalImage,
  handleRemoveAdditionalImage,
  handleSetAsMainImage,
}: RecipeFormBasicSectionProps) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
      <h3 className="mb-4 text-lg font-semibold text-gray-900">Basic Information</h3>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div className="md:col-span-2">
          <label htmlFor="recipe-name" className="block text-sm font-medium text-gray-700 mb-2">
            Recipe Name *
          </label>
          <Input
            id="recipe-name"
            name="recipe-name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            className={errors.name ? 'border-red-300' : ''}
            required
          />
          {errors.name && <p className="mt-1 text-sm text-red-600">{errors.name}</p>}
        </div>

        <div className="md:col-span-2">
          <label htmlFor="recipe-description" className="block text-sm font-medium text-gray-700 mb-2">
            Description
          </label>
          <textarea
            id="recipe-description"
            name="recipe-description"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            rows={3}
            className="flex w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
          />
        </div>

        <fieldset className="flex flex-col gap-2 border-0 p-0">
          <legend className="mb-2 block text-sm font-medium text-gray-700">Recipe Image</legend>
          {imagePreview && (
            <div className="relative inline-block">
              <div className="mb-1 text-xs font-medium text-gray-500">Main Image (Card)</div>
              <img
                src={imagePreview}
                alt="Preview"
                className="h-32 w-32 rounded-lg object-cover border-2 border-primary-500 border-dashed"
              />
              <div className="absolute -top-2 -right-2 flex gap-1">
                <button
                  type="button"
                  onClick={handleMoveToAdditional}
                  className="cursor-pointer rounded-full bg-blue-500 p-1 text-white hover:bg-blue-600"
                  aria-label="Move main image to additional images"
                  title="Move to Additional Images"
                >
                  <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M7 16l-4-4m0 0l4-4m-4 4h18"
                    />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={handleRemoveImage}
                  className="cursor-pointer rounded-full bg-red-500 p-1 text-white hover:bg-red-600"
                  aria-label="Remove main recipe image"
                  title="Remove Image"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            </div>
          )}
          <div className="flex flex-col gap-2">
            <div className="flex gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageSelect}
                className="hidden"
                id="image-upload"
              />
              <label
                htmlFor="image-upload"
                className="flex cursor-pointer items-center gap-2 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                <Upload className="h-4 w-4" />
                {isUploading ? 'Uploading...' : imagePreview ? 'Change Image' : 'Upload Image'}
              </label>
            </div>
            {!imagePreview && (
              <div className="flex flex-col gap-1.5">
                <label htmlFor="image-url" className="text-xs font-medium text-gray-500">
                  Or enter an image URL
                </label>
                <Input
                  id="image-url"
                  name="image-url"
                  type="url"
                  value={formData.imageUrl}
                  onChange={(e) => {
                    setFormData({ ...formData, imageUrl: e.target.value });
                    setImagePreview(e.target.value || null);
                  }}
                  placeholder="https://example.com/image.jpg"
                  className="w-full"
                />
              </div>
            )}
          </div>
          {errors.image && <p className="text-sm text-red-600">{errors.image}</p>}
        </fieldset>

        <div>
          <label htmlFor="additional-image-upload" className="block text-sm font-medium text-gray-700 mb-2">
            Additional Images
          </label>
          <div className="flex flex-col gap-2">
            {additionalImages.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {additionalImages.map((url, index) => (
                  <div key={index} className="relative inline-block">
                    <img
                      src={url}
                      alt={`Additional ${index + 1}`}
                      className="h-24 w-24 rounded-lg object-cover border border-gray-200"
                    />
                    <div className="absolute -top-2 -right-2 flex gap-1">
                      <button
                        type="button"
                        onClick={() => handleSetAsMainImage(url, index)}
                        className="cursor-pointer rounded-full bg-green-500 p-1 text-white hover:bg-green-600"
                        aria-label={`Set additional image ${index + 1} as main image`}
                        title="Set as Main Image"
                      >
                        <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRemoveAdditionalImage(index)}
                        className="cursor-pointer rounded-full bg-red-500 p-1 text-white hover:bg-red-600"
                        aria-label={`Remove additional image ${index + 1}`}
                        title="Remove Image"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <input
                type="file"
                accept="image/*"
                onChange={handleAddAdditionalImage}
                className="hidden"
                id="additional-image-upload"
                disabled={isUploadingAdditional}
              />
              <label
                htmlFor="additional-image-upload"
                className={`flex cursor-pointer items-center gap-2 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 ${
                  isUploadingAdditional ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              >
                <Upload className="h-4 w-4" />
                {isUploadingAdditional ? 'Uploading...' : 'Upload'}
              </label>
            </div>
            {errors.additionalImages && (
              <p className="text-sm text-red-600">{errors.additionalImages}</p>
            )}
          </div>
        </div>

        <div>
          <label htmlFor="recipe-category" className="block text-sm font-medium text-gray-700 mb-2">
            Category
          </label>
          <select
            id="recipe-category"
            name="recipe-category"
            value={formData.category}
            onChange={(e) => setFormData({ ...formData, category: e.target.value })}
            className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
          >
            <option value="">Select category</option>
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="recipe-difficulty" className="block text-sm font-medium text-gray-700 mb-2">
            Difficulty
          </label>
          <select
            id="recipe-difficulty"
            name="recipe-difficulty"
            value={formData.difficulty}
            onChange={(e) => setFormData({ ...formData, difficulty: e.target.value })}
            className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
          >
            <option value="">Select difficulty</option>
            {difficulties.map((diff) => (
              <option key={diff} value={diff}>
                {diff.charAt(0).toUpperCase() + diff.slice(1)}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="recipe-cuisine" className="block text-sm font-medium text-gray-700 mb-2">
            Cuisine
          </label>
          <select
            id="recipe-cuisine"
            name="recipe-cuisine"
            value={formData.cuisine}
            onChange={(e) => setFormData({ ...formData, cuisine: e.target.value })}
            className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
          >
            <option value="">Select cuisine</option>
            {commonCuisines.map((cuisine) => (
              <option key={cuisine} value={cuisine}>
                {cuisine}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="recipe-lean-role" className="block text-sm font-medium text-gray-700 mb-2">
            Lean Role
          </label>
          <select
            id="recipe-lean-role"
            name="recipe-lean-role"
            value={formData.leanRole}
            onChange={(e) => setFormData({ ...formData, leanRole: e.target.value })}
            className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
          >
            <option value="">Select lean role</option>
            <option value="Infrastructure">Infrastructure</option>
            <option value="Process">Process</option>
            <option value="Daily">Daily</option>
            <option value="Treat">Treat</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="recipe-is-secret"
            name="recipe-is-secret"
            checked={formData.isSecret}
            onChange={(e) => setFormData({ ...formData, isSecret: e.target.checked })}
            className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-600"
          />
          <label htmlFor="recipe-is-secret" className="text-sm font-medium text-gray-700">
            Secret Recipe (Only visible to main admin)
          </label>
        </div>

        {isSuperadmin && (
          <div className="flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 p-3">
            <input
              type="checkbox"
              id="recipe-is-hh-chefs-verified"
              name="recipe-is-hh-chefs-verified"
              checked={formData.isHhChefsVerified}
              onChange={(e) => setFormData({ ...formData, isHhChefsVerified: e.target.checked })}
              className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-600"
            />
            <label htmlFor="recipe-is-hh-chefs-verified" className="text-sm font-medium text-gray-700">
              <span className="font-semibold text-amber-900">HH Chefs Verified</span>
              <span className="ml-2 text-xs text-amber-700">(100% verified by HealthHub)</span>
            </label>
          </div>
        )}

        <div>
          <label htmlFor="recipe-prep-time" className="block text-sm font-medium text-gray-700 mb-2">
            Prep Time (minutes)
          </label>
          <Input
            id="recipe-prep-time"
            name="recipe-prep-time"
            type="number"
            min="0"
            value={formData.prepTime}
            onChange={(e) => setFormData({ ...formData, prepTime: e.target.value })}
          />
        </div>

        <div>
          <label htmlFor="recipe-cook-time" className="block text-sm font-medium text-gray-700 mb-2">
            Cook Time (minutes)
          </label>
          <Input
            id="recipe-cook-time"
            name="recipe-cook-time"
            type="number"
            min="0"
            value={formData.cookTime}
            onChange={(e) => setFormData({ ...formData, cookTime: e.target.value })}
          />
        </div>

        <div>
          <label htmlFor="recipe-servings" className="block text-sm font-medium text-gray-700 mb-2">
            Servings
          </label>
          <Input
            id="recipe-servings"
            name="recipe-servings"
            type="number"
            min="1"
            value={formData.servings}
            onChange={(e) => setFormData({ ...formData, servings: e.target.value })}
          />
        </div>

        <div>
          <label htmlFor="recipe-tags" className="block text-sm font-medium text-gray-700 mb-2">
            Tags (comma-separated)
          </label>
          <Input
            id="recipe-tags"
            name="recipe-tags"
            value={formData.tags}
            onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
            placeholder="healthy, quick, vegetarian"
          />
        </div>

        <div>
          <label htmlFor="recipe-dietary-tags" className="block text-sm font-medium text-gray-700 mb-2">
            Dietary Tags (comma-separated)
          </label>
          <Input
            id="recipe-dietary-tags"
            name="recipe-dietary-tags"
            value={formData.dietaryTags}
            onChange={(e) => setFormData({ ...formData, dietaryTags: e.target.value })}
            placeholder="vegetarian, gluten-free, dairy-free"
          />
        </div>
      </div>
    </div>
  );
}
