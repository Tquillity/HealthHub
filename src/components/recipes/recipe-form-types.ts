import type { ChangeEvent, Dispatch, RefObject, SetStateAction } from 'react';
import type { RecipeWithDetails } from '@/actions/recipe-actions';

export interface Ingredient {
  name: string;
  quantity: number;
  unit: string;
  notes?: string;
}

export interface Instruction {
  stepNumber: number;
  text: string;
}

export interface RecipeFormProps {
  recipe?: RecipeWithDetails;
  onSuccess?: () => void;
  onCancel?: () => void;
  isSuperadmin?: boolean;
}

export type FormData = {
  name: string;
  description: string;
  imageUrl: string;
  prepTime: string;
  cookTime: string;
  servings: string;
  category: string;
  tags: string;
  difficulty: string;
  cuisine: string;
  leanRole: string;
  dietaryTags: string;
  calories: string;
  protein: string;
  carbs: string;
  fat: string;
  fiber: string;
  sugar: string;
  sodium: string;
  isSecret: boolean;
  isHhChefsVerified: boolean;
};

export const categories = ['Breakfast', 'Lunch', 'Dinner', 'Snack', 'Dessert', 'Beverage'];
export const difficulties = ['easy', 'medium', 'hard'];
/** Include both English and Swedish units to support existing recipes */
export const units = [
  'cup',
  'tbsp',
  'tsp',
  'oz',
  'lb',
  'g',
  'kg',
  'ml',
  'l',
  'piece',
  'slice',
  'clove',
  'bunch',
  'msk',
  'tsk',
  'dl',
  'nypa',
  'st',
];
export const commonCuisines = [
  'Italian',
  'Mexican',
  'Asian',
  'Mediterranean',
  'American',
  'Indian',
  'French',
  'Thai',
  'Chinese',
  'Japanese',
  'Middle Eastern',
];

export interface RecipeFormBasicSectionProps {
  formData: FormData;
  setFormData: Dispatch<SetStateAction<FormData>>;
  errors: Record<string, string>;
  imagePreview: string | null;
  setImagePreview: Dispatch<SetStateAction<string | null>>;
  fileInputRef: RefObject<HTMLInputElement | null>;
  isUploading: boolean;
  isUploadingAdditional: boolean;
  additionalImages: string[];
  isSuperadmin: boolean;
  handleImageSelect: (e: ChangeEvent<HTMLInputElement>) => Promise<void>;
  handleRemoveImage: () => void;
  handleMoveToAdditional: () => void;
  handleAddAdditionalImage: (e: ChangeEvent<HTMLInputElement>) => Promise<void>;
  handleRemoveAdditionalImage: (index: number) => void;
  handleSetAsMainImage: (imageUrl: string, index: number) => void;
}

export interface RecipeFormNutritionSectionProps {
  formData: FormData;
  setFormData: Dispatch<SetStateAction<FormData>>;
}

export interface RecipeFormIngredientsSectionProps {
  ingredients: Ingredient[];
  errors: Record<string, string>;
  ingredientWarnings: Record<number, string>;
  showConverter: Record<number, boolean>;
  setShowConverter: Dispatch<SetStateAction<Record<number, boolean>>>;
  addIngredient: () => void;
  removeIngredient: (index: number) => void;
  updateIngredient: (index: number, field: keyof Ingredient, value: string | number) => void;
  convertToSuggestedUnit: (index: number) => void;
}

export interface RecipeFormInstructionsSectionProps {
  instructions: Instruction[];
  errors: Record<string, string>;
  isSubmitting: boolean;
  isEditing: boolean;
  addInstruction: () => void;
  removeInstruction: (index: number) => void;
  updateInstruction: (index: number, text: string) => void;
  handleCancel: () => void;
}
