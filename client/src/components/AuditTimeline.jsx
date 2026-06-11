import React, { useState, useEffect } from 'react';
import axios from '../api/axios.js';
import { Clock, User, ArrowRight, Activity } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

/**
 * Audit Timeline component
 * Displays database mutations and events for a target resource.
 */
export const AuditTimeline = ({ targetId }) => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!targetId) return;

    const fetchLogs = async () => {
      setLoading(true);
      try {
        const response = await axios.get(`/api/v1/audit-logs?targetId=${targetId}`);
        setLogs(response.data.data);
      } catch (err) {
        console.error('Error fetching audit logs:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchLogs();
  }, [targetId]);

  if (loading) {
    return (
      <div className="flex justify-center p-6">
        <div className="spinner"></div>
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <div className="text-center p-6 text-[--text-secondary] italic text-sm">
        <Activity className="mx-auto mb-2 text-[--text-muted]/30" size={32} />
        <span>No activity recorded yet for this lead.</span>
      </div>
    );
  }

  return (
    <div className="relative border-l border-[--border-strong] pl-4 ml-2 space-y-6">
      {logs.map((log) => {
        const timeAgo = formatDistanceToNow(new Date(log.createdAt), { addSuffix: true });
        
        return (
          <div key={log._id} className="relative group text-xs">
            {/* Timeline node */}
            <div className="absolute -left-[22px] top-1.5 w-3.5 h-3.5 rounded-full bg-white border-2 border-[--accent] group-hover:bg-[--accent] transition-all"></div>

            <div className="flex justify-between items-start text-[--text-secondary] mb-1">
              <div className="flex items-center gap-1">
                <User size={12} className="text-[--accent]" />
                <span className="font-semibold text-[--text-primary]">{log.actorId?.name || 'System / Auto'}</span>
                <span className="text-[10px] text-[--text-muted]">({log.actorEmail})</span>
              </div>
              <div className="flex items-center gap-1 text-[10px] text-[--text-muted]">
                <Clock size={10} />
                <span>{timeAgo}</span>
              </div>
            </div>

            <div className="text-sm font-semibold text-[--text-primary] mb-2">
              <span className="audit-action">{log.action}</span>
            </div>

            {/* Change logs diff viewer */}
            {log.before && log.after && (
              <div className="bg-stone-50 rounded p-2 text-xs font-mono border border-[--border] space-y-1">
                {Object.keys(log.after).map(key => {
                  const oldVal = log.before[key];
                  const newVal = log.after[key];
                  if (JSON.stringify(oldVal) === JSON.stringify(newVal)) return null;

                  return (
                    <div key={key} className="flex flex-wrap items-center gap-1.5 py-0.5">
                      <span className="text-[--text-secondary] font-bold">{key}:</span>
                      <span className="text-[#ff4d4d] line-through max-w-[150px] truncate">{String(oldVal ?? 'null')}</span>
                      <ArrowRight size={10} className="text-[--text-muted]" />
                      <span className="text-[#2ecc71] max-w-[150px] truncate">{String(newVal ?? 'null')}</span>
                    </div>
                  );
                })}
              </div>
            )}

            {log.ip && (
              <div className="text-[10px] text-[--text-muted] mt-1 italic">
                IP: {log.ip}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default AuditTimeline;
