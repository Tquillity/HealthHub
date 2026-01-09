'use client';

import { TemplateVariant } from './types';

interface DayCardProps {
  dayName: string;
  variant: TemplateVariant;
  meals?: {
    breakfast?: string;
    lunch?: string;
    dinner?: string;
  };
  className?: string;
}

function SectionClassic({
  label,
  isLast,
  content,
}: {
  label: string;
  isLast?: boolean;
  content?: string;
}) {
  return (
    <div
      className={`relative p-2 ${!isLast ? 'border-b-2 border-black' : ''}`}
    >
      <span className="absolute top-1 left-2 text-[10px] font-bold uppercase tracking-widest text-black bg-white px-1">
        {label}
      </span>
      <div className="w-full h-full pt-4">{content || ''}</div>
    </div>
  );
}

export function DayCard({
  dayName,
  variant,
  meals,
  className = '',
}: DayCardProps) {
  // 1. CLASSIC
  if (variant === 'classic') {
    return (
      <div
        className={`w-full h-full border-2 border-black grid grid-rows-[auto_1fr_1.2fr_1.5fr] ${className}`}
      >
        <div className="border-b-2 border-black bg-gray-100 p-2 flex items-center justify-center">
          <h2 className="text-xl font-black uppercase tracking-wider text-black">
            {dayName}
          </h2>
        </div>
        <SectionClassic label="BREAKFAST" content={meals?.breakfast} />
        <SectionClassic label="LUNCH" content={meals?.lunch} />
        <SectionClassic label="DINNER" isLast content={meals?.dinner} />
      </div>
    );
  }

  // 2. MINIMAL
  if (variant === 'minimal') {
    return (
      <div className={`w-full h-full p-4 flex flex-col ${className}`}>
        <div className="border-b-4 border-black mb-4 pb-1">
          <h2 className="text-3xl font-serif font-bold text-black tracking-tight">
            {dayName}
          </h2>
        </div>
        <div className="flex-1 border-b border-gray-300 mb-2 relative">
          <span className="font-serif italic text-gray-500 text-sm absolute top-0 right-0">
            Morning
          </span>
          <div className="pt-4">{meals?.breakfast || ''}</div>
        </div>
        <div className="flex-1 border-b border-gray-300 mb-2 relative">
          <span className="font-serif italic text-gray-500 text-sm absolute top-0 right-0">
            Midday
          </span>
          <div className="pt-4">{meals?.lunch || ''}</div>
        </div>
        <div className="flex-1 relative">
          <span className="font-serif italic text-gray-500 text-sm absolute top-0 right-0">
            Evening
          </span>
          <div className="pt-4">{meals?.dinner || ''}</div>
        </div>
      </div>
    );
  }

  // 3. TRACKER
  if (variant === 'tracker') {
    return (
      <div
        className={`w-full h-full border border-black flex flex-col ${className}`}
      >
        <div className="bg-black text-white p-2 text-center">
          <h2 className="text-lg font-bold uppercase tracking-widest">
            {dayName}
          </h2>
        </div>
        <div className="flex-1 p-2 border-b border-black">
          <h3 className="text-xs font-bold text-black mb-1">AM FUEL</h3>
          <div className="text-xs">{meals?.breakfast || ''}</div>
        </div>
        <div className="flex-1 p-2 border-b border-black">
          <h3 className="text-xs font-bold text-black mb-1">PM FUEL</h3>
          <div className="text-xs">{meals?.lunch || ''}</div>
        </div>
        <div className="flex-1 p-2 border-b border-black">
          <h3 className="text-xs font-bold text-black mb-1">
            EVENING REFUEL
          </h3>
          <div className="text-xs">{meals?.dinner || ''}</div>
        </div>
        <div className="h-16 bg-gray-100 border-t border-black p-2 flex flex-col justify-center gap-2">
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase font-bold text-black w-12">
              H2O
            </span>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                <div
                  key={i}
                  className="w-3 h-3 rounded-full border border-black bg-white"
                ></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 4. CHEF
  if (variant === 'chef') {
    return (
      <div
        className={`w-full h-full border-2 border-black flex flex-col ${className}`}
      >
        <div className="border-b-2 border-black p-2 flex justify-between items-baseline bg-gray-50">
          <h2 className="text-xl font-mono font-bold uppercase text-black">
            {dayName}
          </h2>
          <span className="text-xs font-mono text-black">MISE EN PLACE</span>
        </div>
        <div className="flex flex-1">
          <div className="w-[70%] border-r-2 border-black flex flex-col">
            <div className="flex-1 border-b border-black p-1">
              <span className="text-[10px] font-mono bg-black text-white px-1">
                B
              </span>
              <div className="text-xs mt-1">{meals?.breakfast || ''}</div>
            </div>
            <div className="flex-1 border-b border-black p-1">
              <span className="text-[10px] font-mono bg-black text-white px-1">
                L
              </span>
              <div className="text-xs mt-1">{meals?.lunch || ''}</div>
            </div>
            <div className="flex-1 p-1">
              <span className="text-[10px] font-mono bg-black text-white px-1">
                D
              </span>
              <div className="text-xs mt-1">{meals?.dinner || ''}</div>
            </div>
          </div>
          <div className="w-[30%] bg-gray-100 p-2">
            <div className="w-full h-full border-dashed border border-black rounded p-1">
              <span className="text-[9px] text-gray-500 block text-center uppercase">
                Prep
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 5. BUBBLY
  if (variant === 'bubbly') {
    return (
      <div
        className={`w-full h-full border-2 border-dashed border-gray-400 rounded-3xl p-3 flex flex-col gap-2 ${className}`}
      >
        <div className="text-center pb-1 border-b-2 border-dotted border-gray-300">
          <h2 className="text-2xl font-bold text-gray-600 lowercase tracking-tight">
            {dayName}
          </h2>
        </div>
        <div className="flex-1 bg-gray-50 rounded-xl border border-gray-300 relative p-2">
          <span className="absolute -top-2 left-3 bg-white px-2 text-xs font-bold text-gray-400">
            b-fast
          </span>
          <div className="text-xs pt-2">{meals?.breakfast || ''}</div>
        </div>
        <div className="flex-1 bg-gray-50 rounded-xl border border-gray-300 relative p-2">
          <span className="absolute -top-2 left-3 bg-white px-2 text-xs font-bold text-gray-400">
            lunch
          </span>
          <div className="text-xs pt-2">{meals?.lunch || ''}</div>
        </div>
        <div className="flex-1 bg-gray-50 rounded-xl border border-gray-300 relative p-2">
          <span className="absolute -top-2 left-3 bg-white px-2 text-xs font-bold text-gray-400">
            dinner
          </span>
          <div className="text-xs pt-2">{meals?.dinner || ''}</div>
        </div>
      </div>
    );
  }

  // 6. RETRO
  if (variant === 'retro') {
    return (
      <div
        className={`w-full h-full border-4 border-double border-black p-2 flex flex-col ${className}`}
      >
        <div className="bg-black text-white transform -skew-x-12 mb-2 w-max px-4">
          <h2 className="text-lg font-black uppercase italic">{dayName}</h2>
        </div>
        <div className="flex-1 flex flex-col gap-2">
          <div className="flex-1 border-2 border-black rounded-lg p-1 relative bg-[repeating-linear-gradient(45deg,transparent,transparent_5px,#f3f4f6_5px,#f3f4f6_10px)]">
            <div className="bg-white h-full w-full border border-black p-1">
              <span className="text-[10px] font-bold bg-white px-1">
                DINER B-FAST
              </span>
              <div className="text-xs mt-1">{meals?.breakfast || ''}</div>
            </div>
          </div>
          <div className="flex-1 border-2 border-black rounded-lg p-1 relative bg-[repeating-linear-gradient(45deg,transparent,transparent_5px,#f3f4f6_5px,#f3f4f6_10px)]">
            <div className="bg-white h-full w-full border border-black p-1">
              <span className="text-[10px] font-bold bg-white px-1">LUNCH</span>
              <div className="text-xs mt-1">{meals?.lunch || ''}</div>
            </div>
          </div>
          <div className="flex-1 border-2 border-black rounded-lg p-1 relative bg-[repeating-linear-gradient(45deg,transparent,transparent_5px,#f3f4f6_5px,#f3f4f6_10px)]">
            <div className="bg-white h-full w-full border border-black p-1">
              <span className="text-[10px] font-bold bg-white px-1">DINNER</span>
              <div className="text-xs mt-1">{meals?.dinner || ''}</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 7. BRUTALIST
  if (variant === 'brutalist') {
    return (
      <div
        className={`w-full h-full border-4 border-black flex flex-col ${className}`}
      >
        <div className="bg-black p-2 border-b-4 border-black">
          <h2 className="text-4xl font-black text-white uppercase leading-none">
            {dayName.substring(0, 3)}
          </h2>
        </div>
        <div className="flex-1 border-b-4 border-black p-1">
          <h3 className="bg-black text-white text-xs inline-block px-1 font-bold mb-1">
            BREAKFAST
          </h3>
          <div className="text-xs">{meals?.breakfast || ''}</div>
        </div>
        <div className="flex-1 border-b-4 border-black p-1">
          <h3 className="bg-black text-white text-xs inline-block px-1 font-bold mb-1">
            LUNCH
          </h3>
          <div className="text-xs">{meals?.lunch || ''}</div>
        </div>
        <div className="flex-1 p-1">
          <h3 className="bg-black text-white text-xs inline-block px-1 font-bold mb-1">
            DINNER
          </h3>
          <div className="text-xs">{meals?.dinner || ''}</div>
        </div>
      </div>
    );
  }

  // 8. BOTANICAL
  if (variant === 'botanical') {
    return (
      <div
        className={`w-full h-full border border-black p-3 flex flex-col ${className}`}
      >
        <div className="h-full border border-black p-2 flex flex-col relative">
          {/* Corners */}
          <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-black"></div>
          <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-black"></div>
          <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-black"></div>
          <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-black"></div>
          <div className="text-center border-b border-black pb-2 mb-2">
            <h2 className="text-xl font-serif uppercase tracking-widest">
              {dayName}
            </h2>
          </div>
          <div className="flex-1 border-b border-dotted border-gray-400 mb-2">
            <div className="text-xs pt-2">{meals?.breakfast || ''}</div>
          </div>
          <div className="flex-1 border-b border-dotted border-gray-400 mb-2">
            <div className="text-xs pt-2">{meals?.lunch || ''}</div>
          </div>
          <div className="flex-1">
            <div className="text-xs pt-2">{meals?.dinner || ''}</div>
          </div>
        </div>
      </div>
    );
  }

  // 9. BULLET
  if (variant === 'bullet') {
    return (
      <div className={`w-full h-full p-2 flex flex-col ${className}`}>
        <div className="flex items-center gap-2 mb-2">
          <div className="w-4 h-4 rounded-full bg-black"></div>
          <h2 className="text-2xl font-mono font-bold lowercase">{dayName}</h2>
        </div>
        <div className="flex-1 bg-[radial-gradient(#000000_1px,transparent_1px)] [background-size:16px_16px] border-l-2 border-black pl-2 flex flex-col gap-4">
          <div className="flex-1 border-b border-black border-dashed relative">
            <span className="absolute -left-3 top-2 text-xs font-mono bg-white">
              B
            </span>
            <div className="text-xs pt-4">{meals?.breakfast || ''}</div>
          </div>
          <div className="flex-1 border-b border-black border-dashed relative">
            <span className="absolute -left-3 top-2 text-xs font-mono bg-white">
              L
            </span>
            <div className="text-xs pt-4">{meals?.lunch || ''}</div>
          </div>
          <div className="flex-1 relative">
            <span className="absolute -left-3 top-2 text-xs font-mono bg-white">
              D
            </span>
            <div className="text-xs pt-4">{meals?.dinner || ''}</div>
          </div>
        </div>
      </div>
    );
  }

  // 10. INDEX
  if (variant === 'index') {
    return (
      <div className={`w-full h-full pt-6 relative flex flex-col ${className}`}>
        <div className="absolute top-0 left-0 w-1/2 h-6 border-t-2 border-l-2 border-r-2 border-black rounded-t-lg bg-gray-100 flex items-center px-2">
          <h2 className="text-xs font-bold uppercase">{dayName}</h2>
        </div>
        <div className="w-full h-full border-2 border-black rounded-b-lg rounded-tr-lg p-2 flex flex-col bg-white">
          <div className="flex-1 border-b border-black flex flex-col">
            <span className="text-[10px] uppercase text-gray-500">
              Ref: Breakfast
            </span>
            <div className="text-xs pt-1">{meals?.breakfast || ''}</div>
          </div>
          <div className="flex-1 border-b border-black flex flex-col">
            <span className="text-[10px] uppercase text-gray-500">
              Ref: Lunch
            </span>
            <div className="text-xs pt-1">{meals?.lunch || ''}</div>
          </div>
          <div className="flex-1 flex flex-col">
            <span className="text-[10px] uppercase text-gray-500">
              Ref: Dinner
            </span>
            <div className="text-xs pt-1">{meals?.dinner || ''}</div>
          </div>
        </div>
      </div>
    );
  }

  return null;
}

