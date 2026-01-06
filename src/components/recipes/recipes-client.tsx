'use client';

import { useState, useMemo } from 'react';
import { RecipeCard } from './recipe-card';
import { RecipeListView } from './recipe-list-view';
import { RecipeFiltersEnhanced } from './recipe-filters-enhanced';
import { SafeDeleteModal } from '@/components/ui/safe-delete-modal';
import { deleteRecipe } from '@/actions/recipe-actions';
import { useRouter } from 'next/navigation';
import { useQueryState, parseAsString, parseAsArrayOf } from 'nuqs';
import { Grid, LayoutList } from 'lucide-react';
import type { RecipeWithDetails } from '@/actions/recipe-actions';

interface RecipesClientProps {
  recipes: RecipeWithDetails[];
  categories: string[];
  isAdmin: boolean;
  initialQuery?: string;
  initialCategory?: string;
}

export function RecipesClient({
  recipes: initialRecipes,
  categories,
  isAdmin,
  initialQuery,
  initialCategory,
}: RecipesClientProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'gallery' | 'list'>('gallery');
  
  // Get all filter params from URL
  const [category, setCategory] = useQueryState(
    'category',
    parseAsString.withDefault('all')
  );
  const [query] = useQueryState('q', parseAsString.withDefault('').withOptions({ clearOnDefault: true }));
  const [difficulty] = useQueryState('difficulty', parseAsString);
  const [cuisine] = useQueryState('cuisine', parseAsString);
  const [dietaryTags] = useQueryState('dietaryTags', parseAsArrayOf(parseAsString));
  const [leanRole] = useQueryState('leanRole', parseAsString);
  
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [recipeToDelete, setRecipeToDelete] = useState<RecipeWithDetails | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = (recipe: RecipeWithDetails) => {
    if (!isAdmin) return;
    setRecipeToDelete(recipe);
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    if (!recipeToDelete) return;
    setIsDeleting(true);
    const result = await deleteRecipe(recipeToDelete.id);
    setIsDeleting(false);

    if (result.success) {
      router.refresh();
      setShowDeleteModal(false);
      setRecipeToDelete(null);
    } else {
      alert(result.error || 'Failed to delete recipe');
    }
  };

  const handleEdit = (recipe: RecipeWithDetails) => {
    // Navigate to edit page (to be implemented)
    router.push(`/recipes/${recipe.id}/edit`);
  };

  // Filter recipes client-side based on all active filters
  const filteredRecipes = useMemo(() => {
    return initialRecipes.filter((recipe) => {
      // Category filter
      if (category && category !== 'all') {
        if (recipe.category?.toLowerCase() !== category.toLowerCase()) {
          return false;
        }
      }
      
      // Search query filter
      if (query && query.trim()) {
        const searchLower = query.toLowerCase();
        const matchesName = recipe.name.toLowerCase().includes(searchLower);
        const matchesDescription = recipe.description?.toLowerCase().includes(searchLower) || false;
        const matchesTags = recipe.tags?.some(tag => tag.toLowerCase().includes(searchLower)) || false;
        const matchesIngredients = recipe.ingredients?.some(ing => 
          ing.name.toLowerCase().includes(searchLower)
        ) || false;
        
        if (!matchesName && !matchesDescription && !matchesTags && !matchesIngredients) {
          return false;
        }
      }
      
      // Difficulty filter
      if (difficulty && recipe.difficulty?.toLowerCase() !== difficulty.toLowerCase()) {
        return false;
      }
      
      // Cuisine filter
      if (cuisine && recipe.cuisine?.toLowerCase() !== cuisine.toLowerCase()) {
        return false;
      }
      
      // Dietary tags filter
      if (dietaryTags && dietaryTags.length > 0) {
        const recipeTags = recipe.dietaryTags || [];
        const hasMatchingTag = dietaryTags.some(tag => 
          recipeTags.some(rt => rt.toLowerCase() === tag.toLowerCase())
        );
        if (!hasMatchingTag) {
          return false;
        }
      }
      
      // LEAN role filter
      if (leanRole && recipe.leanRole?.toLowerCase() !== leanRole.toLowerCase()) {
        return false;
      }
      
      return true;
    });
  }, [initialRecipes, category, query, difficulty, cuisine, dietaryTags, leanRole]);

  return (
    <>
      {/* View Type Tab Navigation */}
      <div className="mb-4 border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('gallery')}
            className={`${
              activeTab === 'gallery'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            } whitespace-nowrap border-b-2 px-1 py-4 text-sm font-medium transition-colors cursor-pointer flex items-center gap-2`}
          >
            <Grid className="h-4 w-4" />
            Gallery View
          </button>
          <button
            onClick={() => setActiveTab('list')}
            className={`${
              activeTab === 'list'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            } whitespace-nowrap border-b-2 px-1 py-4 text-sm font-medium transition-colors cursor-pointer flex items-center gap-2`}
          >
            <LayoutList className="h-4 w-4" />
            List View {isAdmin ? '(Management)' : ''}
          </button>
        </nav>
      </div>

      {/* Filters */}
      <div className="mb-6">
        <RecipeFiltersEnhanced categories={categories} />
      </div>

      {/* Results Count */}
      <div className="mb-4 flex items-center justify-between">
        <p className="text-gray-600">
          {filteredRecipes.length} recipe{filteredRecipes.length !== 1 ? 's' : ''} found
        </p>
      </div>

      {/* Category Tabs */}
      <div className="mb-6">
        <div className="flex flex-wrap gap-2 border-b border-gray-200 pb-4">
          <button
            onClick={() => setCategory('all')}
            className={`${
              category === 'all' || !category
                ? 'bg-primary-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            } rounded-full px-4 py-2 text-sm font-medium transition-colors cursor-pointer`}
          >
            All
          </button>
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              className={`${
                category === cat
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              } rounded-full px-4 py-2 text-sm font-medium transition-colors cursor-pointer capitalize`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Content based on active tab */}
      {activeTab === 'gallery' ? (
        <>
          {filteredRecipes.length > 0 ? (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {filteredRecipes.map((recipe) => (
                <RecipeCard key={recipe.id} recipe={recipe} />
              ))}
            </div>
          ) : (
            <div className="flex h-64 flex-col items-center justify-center rounded-lg border border-dashed border-gray-300 bg-gray-50">
              <p className="text-lg font-medium text-gray-900">No recipes found</p>
              <p className="text-sm text-gray-500">
                Try adjusting your search or filters.
              </p>
            </div>
          )}
        </>
      ) : (
        <RecipeListView
          recipes={filteredRecipes}
          isAdmin={isAdmin}
          onDelete={handleDelete}
          onEdit={handleEdit}
        />
      )}

      {/* Admin Notice */}
      {!isAdmin && (
        <div className="mt-6 rounded-lg border border-blue-200 bg-blue-50 p-4">
          <p className="text-sm text-blue-700">
            <span className="font-medium">Note:</span> Only admin users can add, edit, or
            delete recipes. Contact your administrator to add new recipes to the database.
          </p>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <SafeDeleteModal
        isOpen={showDeleteModal}
        onClose={() => {
          setShowDeleteModal(false);
          setRecipeToDelete(null);
        }}
        onConfirm={confirmDelete}
        title="Delete Recipe"
        itemName={recipeToDelete?.name || ''}
        description="This will permanently delete the recipe and all associated ingredients and instructions."
      />
    </>
  );
}

