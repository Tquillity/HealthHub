import type { Task } from '@/lib/pomo/types';

export const getTaskVariance = (task: Task) =>
  task.actPomodoros - task.estPomodoros;

export const getTaskStatusLabel = (task: Task) => {
  if (task.actPomodoros === 0) {
    return `Est. ${task.estPomodoros}`;
  }

  const variance = getTaskVariance(task);

  if (variance === 0) {
    return 'On track';
  }

  if (variance < 0) {
    return task.completed ? `${Math.abs(variance)} under` : `${Math.abs(variance)} left`;
  }

  return `+${variance} over`;
};

export const getTaskPlanningSummary = (tasks: Task[]) => {
  const trackedTasks = tasks.filter(
    (task) => task.actPomodoros > 0 || task.completed
  );

  const totalEstimated = tasks.reduce(
    (sum, task) => sum + task.estPomodoros,
    0
  );
  const totalActual = tasks.reduce(
    (sum, task) => sum + task.actPomodoros,
    0
  );

  const trackedEstimated = trackedTasks.reduce(
    (sum, task) => sum + task.estPomodoros,
    0
  );
  const trackedActual = trackedTasks.reduce(
    (sum, task) => sum + task.actPomodoros,
    0
  );

  const planningAccuracy =
    trackedTasks.length === 0 || trackedEstimated === 0 || trackedActual === 0
      ? null
      : Math.round(
          (Math.min(trackedEstimated, trackedActual) /
            Math.max(trackedEstimated, trackedActual)) *
            100
        );

  return {
    totalEstimated,
    totalActual,
    trackedTasks: trackedTasks.length,
    planningAccuracy,
    variance: totalActual - totalEstimated,
  };
};
