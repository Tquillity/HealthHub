'use client';

import { TemplateVariant } from './types';

interface NotesCardProps {
  title?: string;
  variant: TemplateVariant;
  className?: string;
}

export function NotesCard({
  title = 'Notes & Shopping',
  variant = 'classic',
  className = '',
}: NotesCardProps) {
  // Match the aesthetic of DayCard variants
  if (variant === 'classic') {
    return (
      <div
        className={`w-full h-full border-2 border-black flex flex-col ${className}`}
      >
        <div className="border-b-2 border-black bg-gray-100 p-2">
          <h3 className="text-lg font-black uppercase tracking-wider text-black">
            {title}
          </h3>
        </div>
        <div className="flex-1 p-4"></div>
      </div>
    );
  }

  if (variant === 'minimal') {
    return (
      <div className={`w-full h-full p-4 flex flex-col ${className}`}>
        <div className="border-b-4 border-black mb-4 pb-1">
          <h3 className="text-3xl font-serif font-bold text-black tracking-tight">
            {title}
          </h3>
        </div>
        <div className="flex-1"></div>
      </div>
    );
  }

  if (variant === 'tracker') {
    return (
      <div
        className={`w-full h-full border border-black flex flex-col ${className}`}
      >
        <div className="bg-black text-white p-2 text-center">
          <h3 className="text-lg font-bold uppercase tracking-widest">
            {title}
          </h3>
        </div>
        <div className="flex-1 p-2"></div>
      </div>
    );
  }

  if (variant === 'chef') {
    return (
      <div
        className={`w-full h-full border-2 border-black flex flex-col ${className}`}
      >
        <div className="border-b-2 border-black p-2 flex justify-between items-baseline bg-gray-50">
          <h3 className="text-xl font-mono font-bold uppercase text-black">
            {title}
          </h3>
          <span className="text-xs font-mono text-black">NOTES</span>
        </div>
        <div className="flex-1 p-2"></div>
      </div>
    );
  }

  if (variant === 'bubbly') {
    return (
      <div
        className={`w-full h-full border-2 border-dashed border-gray-400 rounded-3xl p-3 flex flex-col gap-2 ${className}`}
      >
        <div className="text-center pb-1 border-b-2 border-dotted border-gray-300">
          <h3 className="text-2xl font-bold text-gray-600 lowercase tracking-tight">
            {title}
          </h3>
        </div>
        <div className="flex-1 bg-gray-50 rounded-xl border border-gray-300 p-2"></div>
      </div>
    );
  }

  if (variant === 'retro') {
    return (
      <div
        className={`w-full h-full border-4 border-double border-black p-2 flex flex-col ${className}`}
      >
        <div className="bg-black text-white transform -skew-x-12 mb-2 w-max px-4">
          <h3 className="text-lg font-black uppercase italic">{title}</h3>
        </div>
        <div className="flex-1 border-2 border-black rounded-lg p-1 relative bg-[repeating-linear-gradient(45deg,transparent,transparent_5px,#f3f4f6_5px,#f3f4f6_10px)]">
          <div className="bg-white h-full w-full border border-black p-1"></div>
        </div>
      </div>
    );
  }

  if (variant === 'brutalist') {
    return (
      <div
        className={`w-full h-full border-4 border-black flex flex-col ${className}`}
      >
        <div className="bg-black p-2 border-b-4 border-black">
          <h3 className="text-4xl font-black text-white uppercase leading-none">
            {title.substring(0, 8).toUpperCase()}
          </h3>
        </div>
        <div className="flex-1 p-1"></div>
      </div>
    );
  }

  if (variant === 'botanical') {
    return (
      <div
        className={`w-full h-full border border-black p-3 flex flex-col ${className}`}
      >
        <div className="h-full border border-black p-2 flex flex-col relative">
          <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-black"></div>
          <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-black"></div>
          <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-black"></div>
          <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-black"></div>
          <div className="text-center border-b border-black pb-2 mb-2">
            <h3 className="text-xl font-serif uppercase tracking-widest">
              {title}
            </h3>
          </div>
          <div className="flex-1"></div>
        </div>
      </div>
    );
  }

  if (variant === 'bullet') {
    return (
      <div className={`w-full h-full p-2 flex flex-col ${className}`}>
        <div className="flex items-center gap-2 mb-2">
          <div className="w-4 h-4 rounded-full bg-black"></div>
          <h3 className="text-2xl font-mono font-bold lowercase">{title}</h3>
        </div>
        <div className="flex-1 bg-[radial-gradient(#000000_1px,transparent_1px)] [background-size:16px_16px] border-l-2 border-black pl-2"></div>
      </div>
    );
  }

  if (variant === 'index') {
    return (
      <div className={`w-full h-full pt-6 relative flex flex-col ${className}`}>
        <div className="absolute top-0 left-0 w-1/2 h-6 border-t-2 border-l-2 border-r-2 border-black rounded-t-lg bg-gray-100 flex items-center px-2">
          <h3 className="text-xs font-bold uppercase">{title}</h3>
        </div>
        <div className="w-full h-full border-2 border-black rounded-b-lg rounded-tr-lg p-2 flex flex-col bg-white">
          <div className="flex-1"></div>
        </div>
      </div>
    );
  }

  return null;
}

