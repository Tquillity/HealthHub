export type TemplateVariant =
  | 'classic'
  | 'minimal'
  | 'tracker'
  | 'chef'
  | 'bubbly'
  | 'retro'
  | 'brutalist'
  | 'botanical'
  | 'bullet'
  | 'index';

export interface DayMeals {
  breakfast?: string;
  lunch?: string;
  dinner?: string;
}

export interface WeeklyPlanData {
  startDate: Date;
  days: Array<{
    dayName: string;
    date: Date;
    meals: DayMeals;
  }>;
}

