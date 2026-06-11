import React, { useState, useEffect } from 'react';
import { X, ChevronRight, ChevronDown, Check, RefreshCw } from 'lucide-react';
import axios from '../api/axios.js';
import toast from 'react-hot-toast';

const UserAssignmentPanel = ({ user, verticals, onClose, onSaveSuccess }) => {
  const [subVerticalsByVertical, setSubVerticalsByVertical] = useState({});
  const [loading, setLoading] = useState(true);
  const [expandedVerticals, setExpandedVerticals] = useState({});
  const [pendingAssignments, setPendingAssignments] = useState(new Set());
  const [savedAssignments, setSavedAssignments] = useState(new Set());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        // Sub-verticals are already pre-embedded in the verticals prop
        const subsMap = {};
        verticals.forEach((v) => {
          subsMap[v._id] = v.subVerticals || [];
        });
        setSubVerticalsByVertical(subsMap);

        // Set initial assignments
        const initialData = user.assignedSubVerticals || [];
        const initial = new Set(initialData.map(item => item._id || item));
        setSavedAssignments(initial);
        setPendingAssignments(new Set(initial));

        // Auto-expand verticals that have assignments
        const expandMap = {};
        verticals.forEach(v => {
          const hasAssignment = subsMap[v._id]?.some(sv => initial.has(sv._id));
          if (hasAssignment) expandMap[v._id] = true;
        });
        setExpandedVerticals(expandMap);

      } catch (err) {
        toast.error('Failed to load sub-vertical structures');
      } finally {
        setLoading(false);
      }
    };

    if (user && verticals.length > 0) {
      fetchData();
    }
  }, [user, verticals]);

  const toggleExpand = (id) => {
    setExpandedVerticals(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const toggleAssignment = (subId) => {
    const next = new Set(pendingAssignments);
    if (next.has(subId)) {
      next.delete(subId);
    } else {
      next.add(subId);
    }
    setPendingAssignments(next);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await axios.post('/api/v1/assignments/bulk', {
        userId: user._id,
        subVerticalIds: Array.from(pendingAssignments)
      });
      toast.success('Assignments updated successfully');
      setSavedAssignments(new Set(pendingAssignments));
      onSaveSuccess();
    } catch (err) {
      toast.error('Failed to save assignments');
    } finally {
      setSaving(false);
    }
  };

  const hasChanges = () => {
    if (pendingAssignments.size !== savedAssignments.size) return true;
    for (let id of pendingAssignments) {
      if (!savedAssignments.has(id)) return true;
    }
    return false;
  };

  return (
    <div className="flex flex-col h-full bg-white border-l border-[--border] shadow-xl">
      <div className="p-6 border-b border-[--border] flex justify-between items-center bg-stone-50">
        <div>
          <h3 className="text-lg font-black text-[--text-primary] uppercase tracking-wider flex items-center gap-2">
            Assignments: <span className="text-[--accent]">{user.name}</span>
          </h3>
          <p className="text-[10px] text-[--text-secondary] uppercase font-bold mt-1">Manage Scoped Sub-Vertical Permissions</p>
        </div>
        <button onClick={onClose} className="p-2 hover:bg-stone-100 rounded-full text-[--text-secondary] hover:text-[--text-primary] transition-all">
          <X size={20} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 opacity-50">
            <RefreshCw className="animate-spin text-[--accent]" size={32} />
            <span className="text-xs uppercase font-bold tracking-widest text-[--text-muted]">Mapping Structures...</span>
          </div>
        ) : verticals.map(vert => {
          const subs = subVerticalsByVertical[vert._id] || [];
          const isExpanded = expandedVerticals[vert._id];
          const selectedCount = subs.filter(s => pendingAssignments.has(s._id)).length;

          return (
            <div key={vert._id} className="border border-[--border] rounded-xl overflow-hidden bg-stone-50/50">
              <div 
                className={`p-3 flex items-center justify-between cursor-pointer hover:bg-stone-100 transition-all ${
                  isExpanded ? 'bg-stone-100/50' : ''
                }`}
                onClick={() => toggleExpand(vert._id)}
              >
                <div className="flex items-center gap-3">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: vert.color || 'var(--accent)' }} />
                  <span className="text-sm font-bold text-[--text-primary] uppercase tracking-tight">{vert.name}</span>
                  {selectedCount > 0 && (
                    <span className="px-1.5 py-0.5 bg-[--accent-light] text-[--accent] text-[10px] font-black rounded border border-[--accent-border]">
                      {selectedCount} / {subs.length}
                    </span>
                  )}
                </div>
                {isExpanded ? <ChevronDown size={16} className="text-[--text-secondary]" /> : <ChevronRight size={16} className="text-[--text-secondary]" />}
              </div>

              {isExpanded && (
                <div className="p-2 divide-y divide-[--border] bg-white">
                  {subs.length === 0 ? (
                    <div className="p-4 text-center text-[10px] text-[--text-secondary] uppercase font-bold italic">No sub-verticals defined</div>
                  ) : subs.map(sub => (
                    <label 
                      key={sub._id} 
                      className="flex items-center justify-between p-2.5 hover:bg-stone-50/50 cursor-pointer group transition-all"
                    >
                      <div className="flex flex-col">
                        <span className={`text-sm transition-all ${pendingAssignments.has(sub._id) ? 'text-[--accent] font-bold' : 'text-[--text-primary]'}`}>
                          {sub.name}
                        </span>
                        <span className="text-[9px] text-[--text-muted] font-mono">{sub.slug}</span>
                      </div>
                      <div className="relative flex items-center">
                        <input
                          type="checkbox"
                          checked={pendingAssignments.has(sub._id)}
                          onChange={() => toggleAssignment(sub._id)}
                          className="w-5 h-5 rounded border-[--border-strong] bg-[--bg-input] text-[--accent] focus:ring-0 cursor-pointer appearance-none checked:bg-[--accent-light] transition-all"
                        />
                        {pendingAssignments.has(sub._id) && (
                          <Check className="absolute pointer-events-none text-[--accent]" size={14} style={{ left: '3px' }} />
                        )}
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="p-6 border-t border-[--border] bg-stone-50 space-y-3">
        <div className="flex justify-between items-center">
          <span className="text-xs text-[--text-secondary] font-bold uppercase">Pending Changes: {pendingAssignments.size - savedAssignments.size}</span>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-[--accent] animate-pulse" />
            <span className="text-[10px] text-[--accent] font-black uppercase tracking-widest">Live Sync Active</span>
          </div>
        </div>
        
        <button
          onClick={handleSave}
          disabled={saving || !hasChanges()}
          className={`w-full py-3 rounded-xl font-black uppercase tracking-widest text-xs transition-all flex items-center justify-center gap-2 shadow-sm ${
            hasChanges() 
              ? 'bg-[--accent] text-white hover:bg-[--accent-hover] hover:scale-[1.01]' 
              : 'bg-stone-100 text-[--text-muted] cursor-not-allowed border border-[--border]'
          }`}
        >
          {saving ? <RefreshCw className="animate-spin" size={16} /> : <Check size={16} />}
          <span>{saving ? 'Synchronizing...' : 'Apply Assignments'}</span>
        </button>
      </div>
    </div>
  );
};

export default UserAssignmentPanel;
