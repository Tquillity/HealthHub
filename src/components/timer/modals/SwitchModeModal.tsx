'use client';

import type { TimerMode } from '@/lib/pomo/types';
import { Modal } from '../common/Modal';

interface SwitchModeModalProps {
  isOpen: boolean;
  currentMode: TimerMode;
  targetMode: TimerMode;
  onCancel: () => void;
  onConfirm: () => void;
}

const modeLabels: Record<TimerMode, string> = {
  pomodoro: 'Pomodoro',
  short: 'Short Break',
  long: 'Long Break',
};

export const SwitchModeModal = ({
  isOpen,
  currentMode,
  targetMode,
  onCancel,
  onConfirm,
}: SwitchModeModalProps) => {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onCancel}
      title="Switch Mode?"
    >
      <p className="text-white/80 text-sm sm:text-base leading-relaxed mb-6">
        Are you sure you want to switch to {modeLabels[targetMode]}? Your current
        time spent in {modeLabels[currentMode]} will be removed and not added to
        statistics, but it will still count toward your current Pomodoro cycle
        position.
      </p>

      <div className="flex justify-end gap-3">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 rounded-lg bg-white/10 text-white hover:bg-white/20 transition-colors cursor-pointer"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onConfirm}
          className="px-4 py-2 rounded-lg bg-white text-(--theme-primary) font-semibold hover:bg-gray-100 transition-colors cursor-pointer"
        >
          Switch
        </button>
      </div>
    </Modal>
  );
};

