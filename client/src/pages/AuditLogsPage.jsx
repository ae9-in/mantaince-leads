/* eslint-disable i18next/no-literal-string */
import React, { useState, useEffect } from 'react';
import axios from '../api/axios.js';
import { 
  Terminal, User, Filter, Search, Activity, Clock, RefreshCw, 
  CornerDownRight, Eye, EyeOff, ArrowRight
} from 'lucide-react';
import toast from 'react-hot-toast';

const t = (val) => val;

export const AuditLogsPage = () => {
  const [auditLogs, setAuditLogs] = useState([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [usersList, setUsersList] = useState([]);
  const [selectedOperator, setSelectedOperator] = useState('');
  const [selectedAction, setSelectedAction] = useState('');
  const [auditSearch, setAuditSearch] = useState('');
  const [nextCursor, setNextCursor] = useState(null);
  const [hasMoreLogs, setHasMoreLogs] = useState(false);
  const [expandedLogId, setExpandedLogId] = useState(null);
  const [showRawJsonMap, setShowRawJsonMap] = useState({}); // { [logId]: boolean }

  // Filter states
  const [rangeType, setRangeType] = useState('30'); // '7' | '30' | '90' | 'custom'
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Compute dates based on range selection
  useEffect(() => {
    if (rangeType === 'custom') return;
    
    const to = new Date();
    const from = new Date();
    from.setDate(to.getDate() - parseInt(rangeType, 10));

    setDateFrom(from.toISOString().split('T')[0]);
    setDateTo(to.toISOString().split('T')[0]);
  }, [rangeType]);

  // Fetch users list for audit logs filtering
  useEffect(() => {
    axios.get('/api/v1/users')
      .then(res => setUsersList(res.data.data || []))
      .catch(err => console.error('Failed to fetch users list', err));
  }, []);

  // Fetch audit logs
  const fetchAuditLogs = async (isLoadMore = false) => {
    setAuditLoading(true);
    try {
      const params = {
        limit: 25,
        userId: selectedOperator || undefined,
        action: selectedAction || undefined,
        search: auditSearch || undefined,
        from: dateFrom ? `${dateFrom}T00:00:00.000Z` : undefined,
        to: dateTo ? `${dateTo}T23:59:59.999Z` : undefined,
        cursor: isLoadMore ? nextCursor : undefined
      };

      const response = await axios.get('/api/v1/admin/audit-logs', { params });
      const logs = response.data.data || [];
      const newCursor = response.data.meta?.nextCursor || null;

      if (isLoadMore) {
        setAuditLogs(prev => [...prev, ...logs]);
      } else {
        setAuditLogs(logs);
      }
      setNextCursor(newCursor);
      setHasMoreLogs(!!newCursor);
    } catch (err) {
      toast.error('Failed to load operator audit logs');
      console.error(err);
    } finally {
      setAuditLoading(false);
    }
  };

  useEffect(() => {
    if (dateFrom && dateTo) {
      fetchAuditLogs(false);
    }
  }, [selectedOperator, selectedAction, auditSearch, dateFrom, dateTo]);

  // Helper to color code audit action type badges
  const getActionBadgeStyle = (action) => {
    const act = String(action).toLowerCase();
    if (act.includes('create') || act.includes('insert')) {
      return 'bg-green-50 text-green-700 border-green-200';
    } else if (act.includes('delete') || act.includes('remove')) {
      return 'bg-red-50 text-red-700 border-red-200';
    } else if (act.includes('update') || act.includes('modify') || act.includes('assign') || act.includes('edit')) {
      return 'bg-blue-50 text-blue-700 border-blue-200';
    } else {
      return 'bg-stone-50 text-stone-700 border-stone-200';
    }
  };

  // Format key-value changes inline
  const renderInlineDiff = (log) => {
    if (!log.oldValue && !log.newValue) return null;

    // Creation or Deletion cases
    if (!log.oldValue || !log.newValue) {
      const stateObj = log.newValue || log.oldValue || {};
      const isCreate = !!log.newValue;
      return (
        <div className="bg-stone-50/50 rounded-lg p-3 text-xs font-mono border border-[--border] space-y-1 mt-2">
          <p className="font-bold text-[--text-secondary] text-[9px] uppercase tracking-wider mb-1">
            {isCreate ? 'Created State Details:' : 'Deleted State Details:'}
          </p>
          {Object.entries(stateObj).map(([key, val]) => {
            if (val === null || val === undefined || val === '') return null;
            return (
              <div key={key} className="flex gap-2 py-0.5 border-b border-stone-100 last:border-0 truncate">
                <span className="text-[--text-secondary] font-semibold">{key}:</span>
                <span className={isCreate ? 'text-green-700 font-bold' : 'text-red-700 line-through'}>
                  {typeof val === 'object' ? JSON.stringify(val) : String(val)}
                </span>
              </div>
            );
          })}
        </div>
      );
    }

    // Modification diff cases
    const allKeys = Object.keys({ ...log.oldValue, ...log.newValue });
    const diffEntries = allKeys.filter(key => {
      const oldVal = log.oldValue[key];
      const newVal = log.newValue[key];
      return JSON.stringify(oldVal) !== JSON.stringify(newVal);
    });

    if (diffEntries.length === 0) {
      return (
        <div className="text-[10px] text-[--text-muted] italic mt-1.5 pl-4 flex items-center gap-1.5">
          <CornerDownRight size={10} />
          <span>No fields altered in metadata record.</span>
        </div>
      );
    }

    return (
      <div className="bg-stone-50/50 rounded-lg p-3 text-xs font-mono border border-[--border] space-y-1 mt-2">
        <p className="font-bold text-[--text-secondary] text-[9px] uppercase tracking-wider mb-1.5">Altered Fields Diff:</p>
        {diffEntries.map(key => {
          const oldVal = log.oldValue[key];
          const newVal = log.newValue[key];
          return (
            <div key={key} className="flex flex-wrap items-center gap-1.5 py-0.5 border-b border-stone-100 last:border-0 text-[11px]">
              <span className="text-[--text-secondary] font-bold">{key}:</span>
              {oldVal !== undefined && (
                <span className="text-red-600 line-through bg-red-50 px-1 rounded truncate max-w-[200px]">
                  {typeof oldVal === 'object' ? JSON.stringify(oldVal) : String(oldVal ?? 'null')}
                </span>
              )}
              <ArrowRight size={10} className="text-[--text-muted]" />
              {newVal !== undefined && (
                <span className="text-green-600 bg-green-50 px-1 rounded font-bold truncate max-w-[200px]">
                  {typeof newVal === 'object' ? JSON.stringify(newVal) : String(newVal ?? 'null')}
                </span>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      
      {/* Header bar controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-[--text-primary] uppercase tracking-wider">{t('Operator Audit Trail')}</h2>
          <p className="text-xs text-[--text-secondary] mt-1">{t('Trace user modifications, config edits, and workflow operations')}</p>
        </div>

        {/* Date range picker selector controls */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex bg-[--bg-input] border border-[--border-strong] rounded-lg p-0.5 text-xs font-semibold shadow-sm">
            {['7', '30', '90'].map(days => (
              <button
                key={days}
                onClick={() => setRangeType(days)}
                className={`px-3 py-1.5 rounded-md transition-all uppercase ${
                  rangeType === days ? 'bg-[--accent] text-white font-bold shadow-sm' : 'text-[--text-secondary] hover:text-[--text-primary] hover:bg-stone-50'
                }`}
              >
                {days}D
              </button>
            ))}
            <button
              onClick={() => setRangeType('custom')}
              className={`px-3 py-1.5 rounded-md transition-all uppercase ${
                rangeType === 'custom' ? 'bg-[--accent] text-white font-bold shadow-sm' : 'text-[--text-secondary] hover:text-[--text-primary] hover:bg-stone-50'
              }`}
            >
              {t('Custom')}
            </button>
          </div>

          {rangeType === 'custom' && (
            <div className="flex items-center gap-2 text-xs">
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="bg-[--bg-input] border border-[--border-strong] rounded-lg px-2.5 py-1.5 text-[--text-primary] focus:outline-none focus:border-[--accent] text-xs font-mono"
              />
              <span className="text-[--text-muted]">{t('to')}</span>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="bg-[--bg-input] border border-[--border-strong] rounded-lg px-2.5 py-1.5 text-[--text-primary] focus:outline-none focus:border-[--accent] text-xs font-mono"
              />
            </div>
          )}
        </div>
      </div>

      <div className="glass-panel bg-white shadow-sm border border-[--border] p-6 space-y-4 rounded-xl">
        
        {/* Audit Logs Filter Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 bg-stone-50 p-4 rounded-xl border border-[--border]">
          
          {/* Operator select dropdown */}
          <div className="flex flex-col gap-1.5 text-xs">
            <label className="font-bold text-[--text-secondary] uppercase flex items-center gap-1">
              <User size={12} className="text-[--text-muted]" />
              <span>Operator (Employee)</span>
            </label>
            <select
              value={selectedOperator}
              onChange={(e) => setSelectedOperator(e.target.value)}
              className="bg-white border border-[--border-strong] rounded-lg px-3 py-2 text-[--text-primary] focus:outline-none focus:border-[--accent] text-xs font-semibold"
            >
              <option value="">All Operators</option>
              {usersList.map(u => (
                <option key={u.id} value={u.id}>{u.name} ({u.role_name?.replace('_', ' ')})</option>
              ))}
            </select>
          </div>

          {/* Action select dropdown */}
          <div className="flex flex-col gap-1.5 text-xs">
            <label className="font-bold text-[--text-secondary] uppercase flex items-center gap-1">
              <Filter size={12} className="text-[--text-muted]" />
              <span>Action Performed</span>
            </label>
            <select
              value={selectedAction}
              onChange={(e) => setSelectedAction(e.target.value)}
              className="bg-white border border-[--border-strong] rounded-lg px-3 py-2 text-[--text-primary] focus:outline-none focus:border-[--accent] text-xs font-semibold"
            >
              <option value="">All Actions</option>
              <option value="lead.create">Lead Created</option>
              <option value="lead.update">Lead Updated</option>
              <option value="lead.status_update">Lead Status Changed</option>
              <option value="lead.assign">Lead Assigned</option>
              <option value="lead.delete">Lead Deleted</option>
              <option value="CUSTOM_FIELD_CREATED">Custom Field Created</option>
              <option value="CUSTOM_FIELD_UPDATED">Custom Field Updated</option>
              <option value="CUSTOM_FIELD_DELETED">Custom Field Deleted</option>
              <option value="CUSTOM_FIELD_REORDERED">Custom Fields Reordered</option>
              <option value="STAGE_CREATED">Lead Stage Created</option>
              <option value="STAGE_UPDATED">Lead Stage Updated</option>
              <option value="STAGE_DELETED">Lead Stage Deleted</option>
              <option value="STAGE_REORDERED">Lead Stages Reordered</option>
              <option value="followup.create">Follow-Up Scheduled</option>
              <option value="followup.complete">Follow-Up Completed</option>
              <option value="user.invite">User Invited</option>
              <option value="user.profile_update">User Profile Updated</option>
              <option value="user.logout">User Logged Out</option>
              <option value="user.forgot_password_request">Password Reset Requested</option>
            </select>
          </div>

          {/* Search keywords input */}
          <div className="flex flex-col sm:col-span-2 gap-1.5 text-xs">
            <label className="font-bold text-[--text-secondary] uppercase flex items-center gap-1">
              <Search size={12} className="text-[--text-muted]" />
              <span>Search Logs</span>
            </label>
            <div className="relative">
              <input
                type="text"
                value={auditSearch}
                onChange={(e) => setAuditSearch(e.target.value)}
                className="w-full bg-white border border-[--border-strong] rounded-lg pl-9 pr-3 py-2 text-[--text-primary] focus:outline-none focus:border-[--accent] text-xs font-semibold"
                placeholder="Search by operator name, email or resource ID..."
              />
              <Search size={14} className="absolute left-3 top-2.5 text-[--text-muted]" />
            </div>
          </div>

        </div>

        {/* Audit Logs Results Table */}
        <div className="border border-[--border] rounded-xl overflow-hidden mt-4">
          <div className="overflow-x-auto max-h-[600px]">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-[--border-strong] bg-stone-50 text-[10px] text-[--text-secondary] font-bold uppercase tracking-wider select-none">
                  <th className="px-5 py-3">Timestamp</th>
                  <th className="px-5 py-3">Operator</th>
                  <th className="px-5 py-3">Action Type</th>
                  <th className="px-5 py-3">Entity Resource</th>
                  <th className="px-5 py-3">IP Address</th>
                  <th className="px-5 py-3 text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[--border]">
                {auditLogs.length === 0 && !auditLoading ? (
                  <tr>
                    <td colSpan="6" className="text-center py-12 text-[--text-secondary] text-xs italic">
                      <Activity className="mx-auto mb-2 text-[--text-muted]/30" size={32} />
                      <span>No audit trail entries matched filters in this range.</span>
                    </td>
                  </tr>
                ) : (
                  auditLogs.map(log => {
                    const isExpanded = expandedLogId === log.id;
                    const showRaw = !!showRawJsonMap[log.id];
                    return (
                      <React.Fragment key={log.id}>
                        <tr 
                          onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                          className={`hover:bg-stone-50/50 cursor-pointer transition-all ${isExpanded ? 'bg-stone-50/60 font-medium' : ''}`}
                        >
                          <td className="px-5 py-3.5 text-[--text-secondary] font-mono whitespace-nowrap">
                            <span className="flex items-center gap-1.5">
                              <Clock size={11} className="text-[--text-muted]" />
                              {new Date(log.createdAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                            </span>
                          </td>
                          <td className="px-5 py-3.5 text-[--text-primary] font-bold">
                            <div className="flex items-center gap-2">
                              <div className="w-5 h-5 rounded-full bg-stone-100 border border-stone-200 text-[8px] flex items-center justify-center uppercase font-black text-[--text-secondary]">
                                {log.userName?.slice(0, 2) || 'S'}
                              </div>
                              <div className="flex flex-col">
                                <span>{log.userName || 'System'}</span>
                                <span className="text-[9px] text-[--text-muted] font-mono leading-none mt-0.5">{log.userEmail || 'system@leadsbase.io'}</span>
                              </div>
                            </div>
                          </td>
                          <td className="px-5 py-3.5">
                            <span className={`inline-block px-2 py-0.5 text-[9px] font-bold rounded-md border font-mono uppercase ${getActionBadgeStyle(log.action)}`}>
                              {log.action?.replace('lead.', '')}
                            </span>
                          </td>
                          <td className="px-5 py-3.5 text-[--text-secondary] font-semibold">
                            <div className="flex flex-col">
                              <span className="capitalize">{log.entityType || 'record'}</span>
                              <span className="text-[9px] text-[--text-muted] font-mono leading-none mt-0.5 max-w-[120px] truncate">
                                ID: {log.entityId || 'N/A'}
                              </span>
                            </div>
                          </td>
                          <td className="px-5 py-3.5 text-[--text-secondary] font-mono">
                            {log.ipAddress || '127.0.0.1'}
                          </td>
                          <td className="px-5 py-3.5 text-right">
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                setExpandedLogId(isExpanded ? null : log.id);
                              }}
                              className="px-2.5 py-1.5 border border-[--border-strong] hover:bg-white text-[--text-secondary] rounded-lg transition-all font-semibold select-none flex items-center gap-1.5 ml-auto text-[10px] uppercase shadow-sm"
                            >
                              {isExpanded ? 'Hide' : 'Inspect'}
                            </button>
                          </td>
                        </tr>

                        {/* Expanded detail panel row */}
                        {isExpanded && (
                          <tr className="bg-stone-50/20">
                            <td colSpan="6" className="px-6 py-4 border-t border-b border-stone-200/50">
                              <div className="space-y-4">
                                
                                {/* Inspector Header */}
                                <div className="flex justify-between items-center text-xs">
                                  <div className="flex items-center gap-2 text-[--text-secondary]">
                                    <Terminal size={14} className="text-[--accent]" />
                                    <span className="font-bold uppercase tracking-wider text-[10px]">Audit Inspector: Action details</span>
                                  </div>
                                  
                                  {/* Toggle Diff vs Raw JSON */}
                                  {(log.oldValue || log.newValue) && (
                                    <button
                                      onClick={() => setShowRawJsonMap(prev => ({ ...prev, [log.id]: !prev[log.id] }))}
                                      className="flex items-center gap-1 px-2.5 py-1 text-[10px] text-[--accent] hover:text-[--accent-hover] font-bold uppercase transition-all bg-[--accent-light] hover:bg-[--accent-light]/80 rounded border border-[--accent-border]"
                                    >
                                      {showRaw ? <EyeOff size={11} /> : <Eye size={11} />}
                                      <span>{showRaw ? 'Show Diff' : 'Show JSON'}</span>
                                    </button>
                                  )}
                                </div>

                                {/* Raw JSON View */}
                                {showRaw && (log.oldValue || log.newValue) ? (
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
                                    {log.oldValue && (
                                      <div className="border border-[--border-strong] rounded p-3 bg-red-50/10">
                                        <span className="font-bold text-red-700 block mb-2 font-sans text-[10px] uppercase tracking-wider">Before Change:</span>
                                        <pre className="overflow-x-auto text-[10px] max-h-[300px] whitespace-pre-wrap leading-relaxed">{JSON.stringify(log.oldValue, null, 2)}</pre>
                                      </div>
                                    )}
                                    {log.newValue && (
                                      <div className="border border-[--border-strong] rounded p-3 bg-green-50/10">
                                        <span className="font-bold text-green-700 block mb-2 font-sans text-[10px] uppercase tracking-wider">After Change:</span>
                                        <pre className="overflow-x-auto text-[10px] max-h-[300px] whitespace-pre-wrap leading-relaxed">{JSON.stringify(log.newValue, null, 2)}</pre>
                                      </div>
                                    )}
                                  </div>
                                ) : (
                                  /* Inline formatted key-value diff */
                                  renderInlineDiff(log)
                                )}

                                {/* Execution Stats metadata info */}
                                <div className="flex flex-wrap items-center gap-x-6 gap-y-1.5 text-[10px] text-[--text-secondary] pt-2 border-t border-stone-100 font-mono">
                                  <span>Actor ID: {log.userId || 'system'}</span>
                                  <span>Target Collection: {log.entityType}</span>
                                  {log.userAgent && <span className="truncate max-w-[400px]">Agent: {log.userAgent}</span>}
                                </div>

                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })
                )}
                
                {/* Loading overlay spinner row */}
                {auditLoading && (
                  <tr>
                    <td colSpan="6" className="text-center py-6">
                      <div className="flex justify-center items-center gap-2 text-xs text-[--text-secondary]">
                        <div className="spinner shrink-0"></div>
                        <span>Loading audit trail...</span>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Load More Pagination controls */}
          {hasMoreLogs && !auditLoading && (
            <div className="p-3 border-t border-[--border] bg-stone-50/50 flex justify-center">
              <button
                onClick={() => fetchAuditLogs(true)}
                className="px-4 py-2 bg-white hover:bg-stone-50 border border-[--border-strong] text-[--text-primary] text-xs font-bold rounded-lg transition-all shadow-sm uppercase flex items-center gap-1.5"
              >
                <RefreshCw size={13} className="text-[--accent]" />
                <span>Load More Records</span>
              </button>
            </div>
          )}

        </div>

      </div>

    </div>
  );
};

export default AuditLogsPage;
