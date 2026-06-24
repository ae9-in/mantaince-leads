import React from 'react';
import { Layers } from 'lucide-react';

export const VerticalSelectionBar = ({
  verticals = [],
  activeVerticalId = null,
  onSelect = () => {},
}) => {
  if (!verticals || verticals.length === 0) return null;

  return (
    <div className="mb-6 animate-in fade-in duration-300">
      <h3 className="text-[10px] font-black text-[--text-secondary] uppercase tracking-widest mb-3 flex items-center gap-1.5">
        <Layers size={11} className="text-[--accent]" />
        <span>Business Verticals</span>
      </h3>
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
        {verticals.map((v) => {
          if (['__proto__', 'constructor', 'prototype'].includes(v._id)) return null;
          const isActive = activeVerticalId === v._id;
          return (
            <button
              key={v._id}
              type="button"
              onClick={() => onSelect(v)}
              className={`flex flex-col items-center justify-center p-3.5 rounded-xl border text-center transition-all duration-300 relative overflow-hidden select-none hover:-translate-y-0.5 ${
                isActive
                  ? 'shadow-md border-transparent scale-[1.02]'
                  : 'bg-white border-[--border] hover:border-[--accent-border] hover:bg-stone-50/50'
              }`}
              style={{
                background: isActive
                  ? `linear-gradient(135deg, ${v.color || 'var(--accent)'}1C, ${v.color || 'var(--accent)'}0A)`
                  : undefined,
                boxShadow: isActive
                  ? `0 4px 14px -4px ${v.color || 'var(--accent)'}40, inset 0 0 0 1.5px ${v.color || 'var(--accent)'}35`
                  : undefined,
              }}
            >
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center mb-2 transition-all duration-300"
                style={{
                  background: isActive ? v.color : `${v.color || '#c8956c'}15`,
                  color: isActive ? '#fff' : v.color || 'var(--accent)',
                }}
              >
                <Layers size={15} />
              </div>
              <span
                className={`text-[11px] font-bold truncate w-full ${
                  isActive ? 'text-[--text-primary] font-black' : 'text-[--text-secondary]'
                }`}
              >
                {v.name}
              </span>
              {isActive && (
                <div
                  className="absolute bottom-0 left-0 right-0 h-1"
                  style={{ backgroundColor: v.color }}
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default VerticalSelectionBar;
