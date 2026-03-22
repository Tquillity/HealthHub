'use client';

import { useState, useRef, useEffect } from 'react';
import { useTaskStore } from '@/lib/pomo-store/useTaskStore';
import clsx from 'clsx';
import {
  getTaskPlanningSummary,
  getTaskStatusLabel,
  getTaskVariance,
} from '@/lib/pomo/utils/taskInsights';

export const TaskBoard = () => {
  const {
    tasks,
    activeTaskId,
    addTask,
    toggleTask,
    setActiveTask,
    deleteTask,
    clearTasks,
    clearCompletedTasks
  } = useTaskStore();
  const [input, setInput] = useState('');
  const [estimate, setEstimate] = useState(1);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const menuItemsRef = useRef<(HTMLButtonElement | null)[]>([]);
  const planningSummary = getTaskPlanningSummary(tasks);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (!isMenuOpen) return;

      if (event.key === 'Escape') {
        setIsMenuOpen(false);
        menuButtonRef.current?.focus();
        return;
      }

      const menuItems = menuItemsRef.current.filter(Boolean) as HTMLButtonElement[];
      if (menuItems.length === 0) return;

      const currentIndex = menuItems.findIndex(item => item === document.activeElement);

      if (event.key === 'ArrowDown') {
        event.preventDefault();
        const nextIndex = currentIndex < menuItems.length - 1 ? currentIndex + 1 : 0;
        menuItems[nextIndex]?.focus();
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        const prevIndex = currentIndex > 0 ? currentIndex - 1 : menuItems.length - 1;
        menuItems[prevIndex]?.focus();
      } else if (event.key === 'Home') {
        event.preventDefault();
        menuItems[0]?.focus();
      } else if (event.key === 'End') {
        event.preventDefault();
        menuItems[menuItems.length - 1]?.focus();
      }
    };

    if (isMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
      setTimeout(() => {
        const firstItem = menuItemsRef.current[0];
        if (firstItem) firstItem.focus();
      }, 0);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isMenuOpen]);

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    addTask(input, estimate);
    setInput('');
    setEstimate(1);
  };

  return (
    <div className="task-board app-surface w-full max-w-md p-4 sm:p-5 rounded-[28px] backdrop-blur-md flex flex-col relative transition-all">

      {/* Header */}
      <div className="flex justify-between items-center mb-4 shrink-0 z-10">
        <div>
          <p className="app-eyebrow">Task Board</p>
          <h2 className="app-card-title mt-1">Tasks</h2>
        </div>

        <div ref={menuRef} className="relative z-20">
          <button
            ref={menuButtonRef}
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="text-white/70 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors focus:outline-none focus:ring-2 focus:ring-white/50"
            aria-label="Task Options"
            title="Task Options"
            aria-expanded={isMenuOpen}
            aria-controls="task-options-menu"
            aria-haspopup="true"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 12a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0ZM12.75 12a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0ZM18.75 12a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Z" />
            </svg>
          </button>

          {isMenuOpen && (
            <div 
              id="task-options-menu"
              role="menu"
              className="absolute right-0 top-full mt-2 w-48 overflow-hidden rounded-2xl border border-white/10 bg-black/75 text-white shadow-2xl shadow-black/30 backdrop-blur-xl ring-1 ring-white/10"
            >
              <button
                ref={(el) => { menuItemsRef.current[0] = el; }}
                onClick={() => { clearCompletedTasks(); setIsMenuOpen(false); }}
                className="w-full text-left px-4 py-2.5 text-sm transition-colors hover:bg-white/10 focus:outline-none focus:bg-white/10"
                role="menuitem"
                tabIndex={0}
              >
                Clear Completed
              </button>
              <button
                ref={(el) => { menuItemsRef.current[1] = el; }}
                onClick={() => { clearTasks(); setIsMenuOpen(false); }}
                className="w-full border-t border-white/10 px-4 py-2.5 text-left text-sm text-red-200 transition-colors hover:bg-red-500/15 focus:outline-none focus:bg-red-500/15"
                role="menuitem"
                tabIndex={0}
              >
                Clear All
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Current Focus Section */}
      <div className="app-subsurface mb-4 rounded-2xl p-3.5 text-center shrink-0">
        <span className="app-eyebrow block mb-1 text-center">Current Focus</span>
        <div className="text-white text-base sm:text-[1.05rem] font-medium truncate">
            {tasks.find(t => t.id === activeTaskId)?.title || "No active task"}
        </div>
      </div>

      <div className="mb-4 grid grid-cols-3 gap-1.5 sm:gap-2 shrink-0">
        <div className="app-metric-card">
          <div className="app-metric-value truncate text-sm sm:text-base">{planningSummary.totalEstimated}</div>
          <div className="app-metric-label">Planned</div>
        </div>
        <div className="app-metric-card">
          <div className="app-metric-value truncate text-sm sm:text-base">{planningSummary.totalActual}</div>
          <div className="app-metric-label">Actual</div>
        </div>
        <div className="app-metric-card">
          <div className="app-metric-value truncate text-sm sm:text-base">
            {planningSummary.planningAccuracy === null ? '--' : `${planningSummary.planningAccuracy}%`}
          </div>
          <div className="app-metric-label">Accuracy</div>
        </div>
      </div>

      {/* Input Form */}
      <form onSubmit={handleAdd} className="grid grid-cols-[1fr_auto] sm:grid-cols-[1fr_auto_auto] gap-2.5 mb-4 shrink-0">
        <label htmlFor="new-task-input" className="sr-only">New Task Name</label>
        <input
          id="new-task-input"
          name="new-task"
          autoComplete="off"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="New task..."
          maxLength={100}
          className="min-w-0 col-span-2 sm:col-span-1 bg-black/20 text-white placeholder-white/60 px-3.5 py-2.5 rounded-xl text-sm border border-white/5 focus:border-white/25 focus:outline-none focus:bg-black/35 transition-all"
        />
        <label htmlFor="new-task-estimate" className="sr-only">Estimated Pomodoros</label>
        <select
          id="new-task-estimate"
          name="new-task-estimate"
          value={estimate}
          onChange={(e) => setEstimate(parseInt(e.target.value, 10))}
          title="Estimated pomodoros"
          className="w-full sm:w-20 bg-black/20 text-white px-2.5 py-2.5 rounded-xl text-sm border border-white/5 focus:border-white/25 focus:outline-none focus:bg-black/35 transition-all"
        >
          {Array.from({ length: 8 }, (_, index) => index + 1).map((value) => (
            <option key={value} value={value} className="bg-[#1f1f1f] text-white">
              {value}p
            </option>
          ))}
        </select>
        <button type="submit" aria-label="Add Task" title="Add Task" className="bg-white/10 hover:bg-white/20 text-white px-4 py-2.5 rounded-xl font-medium cursor-pointer text-sm transition-colors border border-white/5">
          +
        </button>
      </form>

      {/* Task List */}
      <div className="space-y-2">
        {tasks.length === 0 && (
            <div className="flex min-h-[100px] flex-col items-center justify-center text-white/30 text-sm italic">
                <p>Stay focused.</p>
                <p>Add a task above.</p>
            </div>
        )}
        {tasks.map(task => (
          <div
            key={task.id}
            className={clsx(
              "group w-full p-3 rounded-2xl border transition-all flex flex-col gap-2 sm:flex-row sm:justify-between sm:items-center",
              activeTaskId === task.id
                ? "bg-(--theme-primary)/45 border-white/35 shadow-xl ring-1 ring-white/10"
                : "bg-white/5 border-transparent hover:bg-white/10 hover:border-white/10"
            )}
          >
            <div className="flex items-center gap-3 flex-1 min-w-0 w-full">
               <button
                 onClick={() => toggleTask(task.id)}
                 className={clsx(
                   "w-5 h-5 rounded-full border shrink-0 flex items-center justify-center transition-all focus:outline-none focus:ring-2 focus:ring-white/50",
                   task.completed ? "bg-green-500 border-green-500" : "border-white/30 hover:border-white"
                 )}
                 aria-label={task.completed ? `Mark ${task.title} as incomplete` : `Mark ${task.title} as complete`}
               >
                 {task.completed && <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>}
               </button>
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <button
                  onClick={() => setActiveTask(task.id)}
                  className={clsx(
                    "flex-1 text-left truncate text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-white/50 rounded px-1 -mx-1",
                    task.completed ? "line-through text-white/40" : activeTaskId === task.id ? "font-semibold text-white" : "text-white/90"
                  )}
                  aria-label={activeTaskId === task.id ? `Task: ${task.title}. Selected as active task.` : `Task: ${task.title}. Click to set as active task.`}
                >
                  {task.title}
                </button>
                {activeTaskId === task.id && (
                  <span className="shrink-0 rounded-full border border-white/15 bg-white/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/90">
                    Selected
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between sm:justify-end gap-3 sm:pl-2">
                <div className="flex flex-col items-end gap-1">
                  <div className="text-white/60 text-[10px] font-mono bg-black/20 px-1.5 py-0.5 rounded">
                    {task.actPomodoros}/{task.estPomodoros}
                  </div>
                  <div
                    className={clsx(
                      "text-[10px] font-semibold uppercase tracking-wide",
                      getTaskVariance(task) > 0
                        ? "text-amber-200/80"
                        : getTaskVariance(task) === 0 && task.actPomodoros > 0
                          ? "text-green-200/80"
                          : "text-white/45"
                    )}
                  >
                    {getTaskStatusLabel(task)}
                  </div>
                </div>

                <button
                    onClick={() => deleteTask(task.id)}
                    className="text-white/20 hover:text-red-400 p-1 rounded transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100 focus:text-red-400 focus:outline-none focus:ring-2 focus:ring-white/50"
                    aria-label={`Delete task: ${task.title}`}
                    title={`Delete ${task.title}`}
                >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};