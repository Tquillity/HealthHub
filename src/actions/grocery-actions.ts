/**
 * Grocery actions — public barrel only (no logic).
 *
 * - Queries + aggregation: `./grocery-queries.ts` (`getGroceryList`, `getMealPlans`)
 * - Mutations: `./grocery-list-mutations.ts` (toggle / add / scaler)
 * - Pure merge helpers: `@/lib/grocery-aggregate`
 *
 * Import from `@/actions/grocery-actions` in app code; do not add Prisma or session
 * logic here — keep this file a stable re-export surface after S2-4 split.
 */
export { getGroceryList, getMealPlans } from './grocery-queries';
export {
  toggleShoppingItem,
  addShoppingItem,
  addScaledIngredientsToGroceryList,
} from './grocery-list-mutations';
export type { GroceryItem, GroceryListResult } from '@/lib/grocery-aggregate';
