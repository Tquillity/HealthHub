'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { SafeDeleteModal } from '@/components/ui/safe-delete-modal';
import { Edit, Trash2 } from 'lucide-react';
import { deleteRecipe } from '@/actions/recipe-actions';

interface RecipeDetailClientProps {
  recipeId: string;
}

export function RecipeDetailClient({ recipeId }: RecipeDetailClientProps) {
  const router = useRouter();
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    setIsDeleting(true);
    const result = await deleteRecipe(recipeId);
    setIsDeleting(false);

    if (result.success) {
      router.push('/recipes');
      router.refresh();
    } else {
      alert(result.error || 'Failed to delete recipe');
    }
  };

  const handleEdit = () => {
    router.push(`/recipes/${recipeId}/edit`);
  };

  return (
    <>
      <div className="mt-8 flex justify-end gap-3 border-t border-gray-200 pt-6">
        <Button variant="outline" onClick={handleEdit} className="gap-2">
          <Edit className="h-4 w-4" />
          Edit Recipe
        </Button>
        <Button
          variant="destructive"
          onClick={() => setShowDeleteModal(true)}
          className="gap-2"
        >
          <Trash2 className="h-4 w-4" />
          Delete Recipe
        </Button>
      </div>

      <SafeDeleteModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={handleDelete}
        title="Delete Recipe"
        itemName="this recipe"
        description="This will permanently delete the recipe and all associated ingredients and instructions."
      />
    </>
  );
}

