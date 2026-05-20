/**
 * Build groceries URL for the meal planner week in view.
 */
export function groceriesUrlForWeek(startDate: Date): string {
  return `/groceries?week=${encodeURIComponent(startDate.toISOString())}`;
}
