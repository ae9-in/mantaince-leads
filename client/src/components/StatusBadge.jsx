import React from 'react';

/**
 * Status Badge Component
 * Uniform pill color matching status flags.
 */
export const StatusBadge = ({ status }) => {
  const getStyles = () => {
    switch (status?.toLowerCase()) {
      case 'new':
        return 'bg-blue-500/10 text-blue-400 border border-blue-500/20';
      case 'contacted':
        return 'bg-amber-500/10 text-amber-400 border border-amber-500/20';
      case 'qualified':
        return 'bg-cyan-500/10 text-cyan-300 border border-cyan-500/20';
      case 'visit_scheduled':
        return 'bg-violet-500/10 text-violet-300 border border-violet-500/20';
      case 'visit_completed':
        return 'bg-indigo-500/10 text-indigo-300 border border-indigo-500/20';
      case 'negotiation':
        return 'bg-orange-500/10 text-orange-300 border border-orange-500/20';
      case 'converted':
        return 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20';
      case 'lost':
        return 'bg-rose-500/10 text-rose-400 border border-rose-500/20';
      case 'invalid':
      default:
        return 'bg-zinc-500/10 text-zinc-400 border border-zinc-500/20';
    }
  };

  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold tracking-wide uppercase select-none ${getStyles()}`}>
      {String(status || '').replace(/_/g, ' ')}
    </span>
  );
};

export default StatusBadge;
