export type TimerMode = 'pomodoro' | 'short' | 'long';

export interface DailyStats {
  pomodoro: number;
  short: number;
  long: number;
}

export type HistoryByDate = Record<string, DailyStats>;

export interface Task {
  id: string;
  title: string;
  completed: boolean;
  estPomodoros: number;
  actPomodoros: number; // Actual pomodoros spent
}

