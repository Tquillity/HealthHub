'use client';

import { useState } from 'react';
import { Modal } from '../common/Modal';
import { cn } from '@/lib/pomo/utils/cn';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

type Tab = 'guide' | 'science';

export const PomodoroGuideModal = ({ isOpen, onClose }: Props) => {
  const [activeTab, setActiveTab] = useState<Tab>('guide');

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="The Pomodoro Technique">
      
      {/* Tab Navigation */}
      <div className="app-segmented flex mb-6 sticky top-0 backdrop-blur-sm z-10">
        <button
          onClick={() => setActiveTab('guide')}
          className={cn(
            "min-w-0 flex-1 py-2 text-xs sm:text-sm font-medium rounded-md transition-all duration-200",
            activeTab === 'guide' 
              ? "bg-white/10 text-white shadow-sm" 
              : "text-white/50 hover:text-white hover:bg-white/5"
          )}
        >
          Guide
        </button>
        <button
          onClick={() => setActiveTab('science')}
          className={cn(
            "min-w-0 flex-1 py-2 px-2 text-xs sm:text-sm font-medium rounded-md transition-all duration-200",
            activeTab === 'science' 
              ? "bg-white/10 text-white shadow-sm" 
              : "text-white/50 hover:text-white hover:bg-white/5"
          )}
        >
          The Science of Pauses
        </button>
      </div>

      <div className="app-modal-stack app-body-copy">
        
        {/* TAB 1: GUIDE (Original Content) */}
        {activeTab === 'guide' && (
          <div className="app-modal-stack animate-in fade-in slide-in-from-bottom-2 duration-300">
        <div className="app-subsurface rounded-2xl p-4 sm:p-5">
          <p className="app-modal-section-title">What is the Focus Timer?</p>
          <p>
            HealthHub&apos;s Focus Timer is a customizable, privacy-first focus timer designed to help you enter flow state.
                It is inspired by the <a href="https://www.pomodorotechnique.com/" target="_blank" rel="noopener noreferrer" className="text-white underline font-bold decoration-white/50 hover:text-white/90">Pomodoro Technique®</a>,
            a time management method developed by Francesco Cirillo.
          </p>
        </div>

        <div className="app-subsurface rounded-2xl p-4 sm:p-5">
          <p className="app-modal-section-title">What is the Pomodoro Technique?</p>
          <p>
            The Pomodoro Technique is a time management method developed by Francesco Cirillo in the late 1980s. It uses a timer to break work into intervals, traditionally 25 minutes in length, separated by short breaks.
          </p>
        </div>

        <div className="app-subsurface rounded-2xl p-4 sm:p-5">
          <p className="app-modal-section-title">How to use the Focus Timer</p>
              <ul className="space-y-2">
                <li className="flex gap-2 rounded-xl bg-white/5 px-3 py-2.5">
                  <span className="text-white font-bold">•</span>
                  <span><strong className="text-white">Add a Task:</strong> Use the task input to define what you want to work on.</span>
                </li>
                <li className="flex gap-2 rounded-xl bg-white/5 px-3 py-2.5">
                  <span className="text-white font-bold">•</span>
                  <span><strong className="text-white">Start the Timer:</strong> Click Start to begin your 25-minute focus session.</span>
                </li>
                <li className="flex gap-2 rounded-xl bg-white/5 px-3 py-2.5">
                  <span className="text-white font-bold">•</span>
                  <span><strong className="text-white">Work until the Alarm:</strong> Focus exclusively on the task. No distractions.</span>
                </li>
                <li className="flex gap-2 rounded-xl bg-white/5 px-3 py-2.5">
                  <span className="text-white font-bold">•</span>
                  <span><strong className="text-white">Take a Break:</strong> When the alarm rings, take a 5-minute break.</span>
                </li>
                <li className="flex gap-2 rounded-xl bg-white/5 px-3 py-2.5">
                  <span className="text-white font-bold">•</span>
                  <span><strong className="text-white">Repeat:</strong> After 4 cycles, take a longer 15-minute break.</span>
                </li>
          </ul>
        </div>

        <div className="app-subsurface rounded-2xl p-4 sm:p-5">
          <p className="app-modal-section-title">Why choose this timer?</p>
          <p>
            Unlike other timers, this one works entirely offline. Your data is stored in your browser&apos;s Local Storage, ensuring 100% privacy. With built-in features like Zen Mode (ambient soundscapes) and history tracking, it&apos;s designed to help you enter a flow state faster.
          </p>
        </div>
          </div>
        )}

        {/* TAB 2: SCIENCE (New Content) */}
        {activeTab === 'science' && (
          <div className="app-modal-stack animate-in fade-in slide-in-from-bottom-2 duration-300">
            
            {/* Key Benefits */}
            <section className="app-subsurface rounded-2xl p-4 sm:p-5">
              <h3 className="app-modal-section-title">Key Benefits of Incorporating Pauses</h3>
              <ul className="space-y-3">
                <li className="bg-white/5 p-3 rounded-lg border border-white/5">
                  <strong className="text-white block mb-1">🧠 Mental Freshness</strong>
                  Research suggests that regular short pauses help maintain mental freshness by reducing fatigue and restoring energy levels, potentially leading to better focus over time.
                </li>
                <li className="bg-white/5 p-3 rounded-lg border border-white/5">
                  <strong className="text-white block mb-1">👀 Eye Health</strong>
                  Repeated breaks support eye health by alleviating digital eye strain. Strategies like the <span className="text-white font-medium">20-20-20 rule</span> (every 20 mins, look 20 ft away for 20 secs) show promise in reducing dryness and discomfort.
                </li>
                <li className="bg-white/5 p-3 rounded-lg border border-white/5">
                  <strong className="text-white block mb-1">😌 Stress Handling</strong>
                  Evidence leans toward pauses aiding stress handling by promoting psychological detachment from work, which may lower chronic stress and prevent burnout.
                </li>
              </ul>
            </section>

            {/* In-App Context */}
            <section className="app-subsurface rounded-2xl p-4 sm:p-5">
              <h3 className="app-modal-section-title">The Science Behind Pauses in the Focus Timer</h3>
              <p className="mb-4">
                Pauses are more than just downtime—they're essential for staying fresh and productive. Studies show that short, repeated breaks help restore mental energy, reduce fatigue, and keep you in a flow state longer. 
              </p>
              <p className="mb-4">
                For your eyes, regular pauses combat digital eye strain by allowing your visual system to relax. In terms of stress, these intervals promote detachment from tasks, helping to manage cortisol levels. By incorporating ambient sounds in <strong className="text-white">Zen Mode</strong>, this timer makes breaks restorative, aligning with research on mindful recovery.
              </p>
            </section>

            {/* Deep Dive / Research Data */}
            <section className="app-subsurface rounded-2xl p-4 sm:p-5">
              <h3 className="app-modal-section-title">Research Highlights</h3>
              
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-white/20">
                      <th className="py-2 pr-4 text-white font-bold">Study/Source</th>
                      <th className="py-2 px-4 text-white font-bold">Key Finding</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/10">
                    <tr>
                      <td className="py-2 pr-4 font-medium text-white/90">Meta-analysis on micro-breaks (2022)</td>
                      <td className="py-2 px-4">Increases vigor, reduces fatigue (effect size d = 0.36)</td>
                    </tr>
                    <tr>
                      <td className="py-2 pr-4 font-medium text-white/90">APA article on breaks (2019)</td>
                      <td className="py-2 px-4">5-min break boosts attention in 45-min tasks</td>
                    </tr>
                    <tr>
                      <td className="py-2 pr-4 font-medium text-white/90">Cornell Health</td>
                      <td className="py-2 px-4">5-60 minute purposeful rests increase energy & productivity</td>
                    </tr>
                    <tr>
                      <td className="py-2 pr-4 font-medium text-white/90">Huberman Lab (Vision)</td>
                      <td className="py-2 px-4">Distance viewing maintains lens elasticity, prevents headaches</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>

            {/* Podcast Resources */}
            <section className="app-subsurface rounded-2xl p-4 sm:p-5">
              <h3 className="app-modal-section-title">Relevant Podcasts</h3>
              <ul className="space-y-3 text-xs">
                <li>
                  <a href="https://podcasts.apple.com/us/podcast/break-free-from-burnout-how-to-accomplish-more-by-doing/id1333552422?i=1000660936092" target="_blank" rel="noopener noreferrer" className="block p-3 rounded bg-white/5 hover:bg-white/10 transition-colors border border-white/5 group">
                    <span className="font-bold text-white block mb-1 group-hover:underline">Dr. Rangan Chatterjee: Break Free from Burnout</span>
                    Discusses working at a natural pace with intentional rest to reduce overwhelm.
                  </a>
                </li>
                <li>
                  <a href="https://zoe.com/learn/podcast-beat-stress-with-science" target="_blank" rel="noopener noreferrer" className="block p-3 rounded bg-white/5 hover:bg-white/10 transition-colors border border-white/5 group">
                    <span className="font-bold text-white block mb-1 group-hover:underline">ZOE Podcast: Beat Stress with Science</span>
                    Emphasizes daily pauses, like device-free walks, to interrupt stress buildup.
                  </a>
                </li>
                <li>
                  <a href="https://www.hubermanlab.com/episode/the-science-of-vision-eye-health-and-seeing-better" target="_blank" rel="noopener noreferrer" className="block p-3 rounded bg-white/5 hover:bg-white/10 transition-colors border border-white/5 group">
                    <span className="font-bold text-white block mb-1 group-hover:underline">Huberman Lab: The Science of Vision</span>
                    Covers breaks for eye strain and the physiological benefits of distance viewing.
                  </a>
                </li>
                <li>
                  <a href="https://www.hubermanlab.com/episode/how-to-control-your-cortisol-overcome-burnout" target="_blank" rel="noopener noreferrer" className="block p-3 rounded bg-white/5 hover:bg-white/10 transition-colors border border-white/5 group">
                    <span className="font-bold text-white block mb-1 group-hover:underline">Huberman Lab: Control Cortisol & Overcome Burnout</span>
                    Highlights non-sleep deep rest (NSDR) protocols to lower stress.
                  </a>
                </li>
              </ul>
            </section>
          </div>
        )}
      </div>
    </Modal>
  );
};
