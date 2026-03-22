'use client';

import { useRef } from 'react';
import { exportData, importData } from '@/lib/pomo/services/storage.service';

export const TimerFooter = () => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    const success = await importData(file);
    if (success && fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <footer className="app-footer mt-auto flex w-full flex-col items-center pb-3 sm:pb-4 z-20">
      <div className="w-full px-4 sm:px-6">
        <div className="mx-auto flex max-w-3xl flex-col items-center justify-between gap-4 rounded-2xl border border-white/10 bg-black/40 px-4 py-3 shadow-2xl backdrop-blur-md sm:flex-row sm:rounded-full sm:px-6">
          <div className="flex flex-wrap items-center justify-center gap-2 text-white/60">
            <span className="font-bold tracking-wide text-white">
              HealthHub Focus Timer
            </span>
            <span className="rounded border border-white/20 px-1.5 text-xs text-white/40">
              v1
            </span>
            <span className="hidden text-xs sm:inline">Offline First</span>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4">
            <button
              onClick={exportData}
              className="flex items-center gap-1 text-xs font-medium text-white/70 transition-colors hover:text-white"
              title="Export timer data"
              aria-label="Export timer data"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
                className="h-4 w-4"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5"
                />
              </svg>
              Export
            </button>

            <div className="h-4 w-px bg-white/20" />

            <label
              className="flex cursor-pointer items-center gap-1 text-xs font-medium text-white/70 transition-colors hover:text-white"
              title="Import timer data"
              aria-label="Import timer data"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
                className="h-4 w-4"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5"
                  className="origin-center rotate-180"
                />
              </svg>
              Import
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                onChange={handleFileChange}
                className="hidden"
              />
            </label>
          </div>
        </div>
      </div>
    </footer>
  );
};
