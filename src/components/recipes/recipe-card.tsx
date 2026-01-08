'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Clock, Users, ChefHat } from 'lucide-react';
import { type RecipeWithDetails } from '@/actions/recipe-actions';

interface RecipeCardProps {
  recipe: RecipeWithDetails;
}

export function RecipeCard({ recipe }: RecipeCardProps) {
  const [imageError, setImageError] = useState(false);
  
  // Fallback if numbers are missing
  const prepTime = recipe.prepTime || 0;
  const cookTime = recipe.cookTime || 0;
  const totalTime = prepTime + cookTime;

  return (
    <Link
      href={`/recipes/${recipe.id}`}
      className="group flex flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm transition-all hover:shadow-md"
    >
      {/* Recipe Image */}
      <div className="relative h-48 w-full bg-gray-100 overflow-hidden">
        {recipe.imageUrl && !imageError ? (
          <img
            src={recipe.imageUrl}
            alt={recipe.name}
            className="h-full w-full object-cover"
            onError={() => setImageError(true)}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-gray-300">
            <ChefHat className="h-12 w-12" />
          </div>
        )}

        {/* Badges */}
        <div className="absolute right-2 top-2 flex gap-1">
          {recipe.isSystem && (
            <span className="rounded-full bg-blue-100 px-2 py-1 text-xs font-medium text-blue-700">
              Official
            </span>
          )}
          {recipe.category && (
            <span className="rounded-full bg-green-100 px-2 py-1 text-xs font-medium text-green-700 capitalize">
              {recipe.category}
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-1 flex-col p-4">
        <h3 
          className="line-clamp-1 text-lg font-semibold text-gray-900 group-hover:text-blue-600"
          title={recipe.name}
        >
          {recipe.name}
        </h3>

        <p className="mt-1 line-clamp-2 flex-1 text-sm text-gray-500">
          {recipe.description || 'No description available.'}
        </p>

        <div className="mt-4 flex items-center justify-between border-t pt-4 text-xs text-gray-500">
          <div className="flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" />
            <span>{totalTime > 0 ? `${totalTime}m` : '-'}</span>
          </div>
          <div className="flex items-center gap-1">
            <Users className="h-3.5 w-3.5" />
            <span>{recipe.servings || '-'} ppl</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="font-medium">{recipe.ingredients.length}</span>
            <span>ingr.</span>
          </div>
        </div>
      </div>
    </Link>
  );
}
