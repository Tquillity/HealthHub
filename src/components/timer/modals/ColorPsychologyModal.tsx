'use client';

import { Modal } from '../common/Modal';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export const ColorPsychologyModal = ({ isOpen, onClose }: Props) => {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Color Psychology in the Focus Timer">
      <div className="app-modal-stack app-body-copy">
        <div className="app-subsurface rounded-2xl p-4 sm:p-5">
          <p>
            HealthHub&apos;s Focus Timer deliberately uses different background colors for each timer mode to support your cognitive and emotional state, based on decades of peer-reviewed color psychology research.
          </p>
        </div>

        <ul className="space-y-4">
          <li className="app-subsurface rounded-2xl p-4 sm:p-5">
            <strong className="text-white">Pomodoro (Focus) - Soft warm red (#c15c5c)</strong>
            <p className="mt-2">
              Provides gentle arousal and urgency to overcome procrastination and enter flow, without the anxiety that bright red can trigger. Red is the traditional "tomato" color and increases attention to detail.
            </p>
          </li>
          <li className="app-subsurface rounded-2xl p-4 sm:p-5">
            <strong className="text-white">Short Break - Refreshing mint-teal (#52a89a)</strong>
            <p className="mt-2">
              Quick emotional reset with nature and water associations. Green-blue hues are proven to reduce stress fastest and restore attention rapidly.
            </p>
          </li>
          <li className="app-subsurface rounded-2xl p-4 sm:p-5">
            <strong className="text-white">Long Break - Deep indigo-blue (#2c5578)</strong>
            <p className="mt-2">
              Maximum calm, clarity, and recovery. Blue consistently lowers heart rate and cortisol and is rated the top color for sustained concentration and relaxation in workplace studies.
            </p>
          </li>
        </ul>

        <p className="text-white font-medium">
          This warm {'->'} refreshing {'->'} cool progression mirrors the natural energy cycle of the Pomodoro Technique itself.
        </p>

        <div className="app-subsurface rounded-2xl p-4 sm:p-5">
          <p className="app-modal-section-title">Scientific Sources</p>
          <ul className="text-xs space-y-1 text-white/60">
            <li>• Elliot & Maier (2012). <a href="https://www.sciencedirect.com/science/article/abs/pii/B9780123942869000020" className="text-white underline hover:text-white/80" target="_blank" rel="noopener noreferrer">Color-in-Context Theory</a></li>
            <li>• Gnambs et al. (2015). <a href="https://www.frontiersin.org/journals/psychology/articles/10.3389/fpsyg.2015.00368/full" className="text-white underline hover:text-white/80" target="_blank" rel="noopener noreferrer">Color and psychological functioning review</a></li>
            <li>• YesColours (2024). <a href="https://yescolours.com/blogs/news/science-behind-colours-for-focus-and-calm" className="text-white underline hover:text-white/80" target="_blank" rel="noopener noreferrer">The Science Behind Colours That Boost Focus and Calm</a></li>
          </ul>
        </div>
      </div>
    </Modal>
  );
};
