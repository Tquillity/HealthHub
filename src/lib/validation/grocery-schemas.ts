import { z } from 'zod';

export const AddShoppingItemSchema = z.object({
  name: z.string().min(1),
  quantity: z.number().positive(),
  unit: z.string().min(1),
});

export const ToggleShoppingItemSchema = z.object({
  itemKey: z.string().min(1),
  isChecked: z.boolean(),
});
