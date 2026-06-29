import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ChevronDown, Search, User, X } from 'lucide-react';

/**
 * SearchableOperatorSelect
 * Props:
 *  - agents: Array<{ id|_id, name, role? }>
 *  - value: string  (the selected agent id)
 *  - onChange: (id: string) => void
 *  - placeholder?: string
 *  - className?: string
 *  - label?: string  (optional label rendered above)
 */
const SearchableOperatorSelect = ({ agents = [], value, onChange, placeholder = '-- Unassigned --', className = '', label }) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [visibleCount, setVisibleCount] = useState(5);
  const containerRef = useRef(null);
  const inputRef = useRef(null);

  const selectedAgent = agents.find(a => (a.id || a._id) === value);

  const filtered = query.trim()
    ? agents.filter(a => a.name?.toLowerCase().includes(query.trim().toLowerCase()))
    : agents;

  const visibleAgents = filtered.slice(0, visibleCount);

  // Close on outside click
  useEffect(() => {
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
        setQuery('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Focus search input when dropdown opens
  useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.focus();
    }
  }, [open]);

  // Reset pagination count when search query or open status changes
  useEffect(() => {
    setVisibleCount(5);
  }, [query, open]);

  const handleSelect = useCallback((id) => {
    onChange(id);
    setOpen(false);
    setQuery('');
  }, [onChange]);

  const handleScroll = (e) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    // Load 5 more when user scrolls within 15px of bottom
    if (scrollHeight - scrollTop <= clientHeight + 15) {
      setVisibleCount(prev => Math.min(prev + 5, filtered.length));
    }
  };

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      {label && (
        <span className="block text-[10px] font-black uppercase text-stone-500 mb-1">{label}</span>
      )}

      {/* Trigger button */}
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between gap-2 bg-[--bg-input] border border-[--border-strong] rounded-lg px-3 py-2 text-xs font-semibold focus:outline-none focus:border-[--accent] hover:border-[--accent]/60 transition-colors text-left"
      >
        <span className="flex items-center gap-2 min-w-0">
          {selectedAgent ? (
            <>
              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-[--accent]/15 text-[--accent] text-[9px] font-black flex-shrink-0">
                {selectedAgent.name?.slice(0, 1)?.toUpperCase() || '?'}
              </span>
              <span className="truncate text-[--text-primary]">{selectedAgent.name}</span>
            </>
          ) : (
            <>
              <User size={12} className="text-[--text-muted] flex-shrink-0" />
              <span className="text-[--text-muted]">{placeholder}</span>
            </>
          )}
        </span>
        <ChevronDown
          size={13}
          className={`text-[--text-muted] flex-shrink-0 transition-transform duration-150 ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {/* Dropdown panel */}
      {open && (
        <div className="absolute z-[200] mt-1 w-full min-w-[200px] bg-white border border-[--border-strong] rounded-xl shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
          {/* Search bar */}
          <div className="flex items-center gap-2 px-3 py-2 border-b border-stone-100">
            <Search size={13} className="text-stone-400 flex-shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search operator..."
              className="flex-1 text-xs bg-transparent border-0 outline-none text-[--text-primary] placeholder:text-stone-400"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                className="text-stone-400 hover:text-stone-600 bg-transparent border-0 p-0 cursor-pointer"
              >
                <X size={11} />
              </button>
            )}
          </div>

          {/* Options list */}
          <div 
            className="max-h-48 overflow-y-auto"
            onScroll={handleScroll}
          >
            {/* Unassigned option */}
            <button
              type="button"
              onClick={() => handleSelect('')}
              className={`w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-stone-50 transition-colors text-left ${!value ? 'bg-[--accent-light] text-[--accent] font-bold' : 'text-[--text-secondary]'}`}
            >
              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-stone-100 text-stone-400 text-[9px] font-black flex-shrink-0">
                —
              </span>
              <span>Unassigned</span>
            </button>

            {filtered.length === 0 ? (
              <div className="px-3 py-4 text-center text-xs text-stone-400">
                No operators found
              </div>
            ) : (
              visibleAgents.map(agent => {
                const id = agent.id || agent._id;
                const isSelected = id === value;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => handleSelect(id)}
                    className={`w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-stone-50 transition-colors text-left ${isSelected ? 'bg-[--accent-light] font-bold' : ''}`}
                  >
                    <span className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-[9px] font-black flex-shrink-0 ${isSelected ? 'bg-[--accent] text-white' : 'bg-stone-100 text-stone-500'}`}>
                      {agent.name?.slice(0, 1)?.toUpperCase() || '?'}
                    </span>
                    <div className="flex flex-col min-w-0">
                      <span className={`truncate ${isSelected ? 'text-[--accent]' : 'text-[--text-primary]'}`}>
                        {agent.name}
                      </span>
                      {agent.role_name || agent.role ? (
                        <span className="text-[9px] text-stone-400 truncate capitalize">
                          {agent.role_name || agent.role}
                        </span>
                      ) : null}
                    </div>
                    {isSelected && (
                      <span className="ml-auto text-[--accent] flex-shrink-0">✓</span>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default SearchableOperatorSelect;
