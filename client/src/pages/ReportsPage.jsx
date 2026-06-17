/* eslint-disable i18next/no-literal-string */
import React, { useState, useEffect } from 'react';
import axios from '../api/axios.js';
import { useUiStore } from '../store/uiStore.js';
import { 
  BarChart3, Calendar, Download, RefreshCw, User, CheckCircle2, 
  TrendingUp, MapPin, Award, ArrowUpRight, Clock, Search, Filter, 
  Activity, ArrowRight, CornerDownRight, ShieldAlert, Terminal, Eye, EyeOff
} from 'lucide-react';
import toast from 'react-hot-toast';

const t = (val) => val;

export const ReportsPage = () => {
  const { activeVertical, leadsRefreshTrigger } = useUiStore();
  const [loading, setLoading] = useState(true);

  // Tabs state
  const [activeTab, setActiveTab] = useState('analytics'); // 'analytics' | 'audit'

  // Filter states
  const [rangeType, setRangeType] = useState('30'); // '7' | '30' | '90' | 'custom'
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Report datasets
  const [statusData, setStatusData] = useState([]);
  const [areaData, setAreaData] = useState([]);
  const [conversionData, setConversionData] = useState([]);
  const [agentData, setEmployeeData] = useState([]);

  // Operator Audit Logs states
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

  // Compute dates based on range selection
  useEffect(() => {
    if (rangeType === 'custom') return;
    
    const to = new Date();
    const from = new Date();
    from.setDate(to.getDate() - parseInt(rangeType, 10));

    setDateFrom(from.toISOString().split('T')[0]);
    setDateTo(to.toISOString().split('T')[0]);
  }, [rangeType]);

  // Aggregated analytics fetch (Optimized: 1 HTTP request instead of 4)
  const fetchReportData = async () => {
    if (!activeVertical) return;
    setLoading(true);
    try {
      const params = {
        verticalId: activeVertical._id,
        dateFrom: dateFrom ? `${dateFrom}T00:00:00.000Z` : undefined,
        dateTo: dateTo ? `${dateTo}T23:59:59.999Z` : undefined
      };

      const response = await axios.get('/api/v1/reports/summary', { params });
      const { statusDistribution, areaDistribution, conversionOverTime, agentPerformance } = response.data.data;

      setStatusData(statusDistribution || []);
      setAreaData(areaDistribution || []);
      setConversionData(conversionOverTime || []);
      setEmployeeData(agentPerformance || []);
    } catch (err) {
      toast.error('Failed to load performance metrics distribution');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeVertical && dateFrom && dateTo && activeTab === 'analytics') {
      fetchReportData();
    }
  }, [activeVertical, dateFrom, dateTo, leadsRefreshTrigger, activeTab]);

  // Fetch users list for audit logs filtering
  useEffect(() => {
    if (activeTab === 'audit' && usersList.length === 0) {
      axios.get('/api/v1/users')
        .then(res => setUsersList(res.data.data || []))
        .catch(err => console.error('Failed to fetch users list', err));
    }
  }, [activeTab, usersList]);

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
    if (activeTab === 'audit') {
      fetchAuditLogs(false);
    }
  }, [activeTab, selectedOperator, selectedAction, auditSearch, dateFrom, dateTo]);

  // Export report datasets as consolidated CSV download
  const handleExportCSV = () => {
    if (!activeVertical) return;

    let csvContent = 'LeadsBase Performance Report\n';
    csvContent += `Vertical: ${activeVertical.name}\n`;
    csvContent += `Date Range: ${dateFrom} to ${dateTo}\n\n`;

    // 1. Status Distribution
    csvContent += '--- LEADS BY STATUS ---\nStatus,Count\n';
    statusData.forEach(s => {
      csvContent += `${s._id},${s.count}\n`;
    });
    csvContent += '\n';

    // 2. Area Distribution
    csvContent += '--- LEADS BY AREA ---\nArea,Count\n';
    areaData.forEach(a => {
      csvContent += `"${a._id}",${a.count}\n`;
    });
    csvContent += '\n';

    // 3. Employee performance
    csvContent += '--- AGENT CONVERSION METRICS ---\nEmployee Name,Email,Assigned,Converted,Conversion Rate (%)\n';
    agentData.forEach(ag => {
      csvContent += `"${ag.name}",${ag.email},${ag.totalAssigned},${ag.converted},${ag.conversionRate.toFixed(2)}\n`;
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `leadsbase-report-${activeVertical.slug}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Report metrics exported successfully');
  };

  // Helper colors for status badges
  const getStatusColor = (status) => {
    switch (status) {
      case 'new': return '#185FA5';
      case 'contacted': return '#f39c12';
      case 'converted': return '#2ecc71';
      case 'lost': return '#e74c3c';
      case 'invalid': return '#7f8c8d';
      default: return '#34495e';
    }
  };

  // 1. Donut Chart Drawing Logic (SVG)
  const renderDonutChart = () => {
    if (statusData.length === 0) {
      return (
        <div className="flex items-center justify-center h-full text-xs text-[--text-secondary]">
          {t('No status distribution data')}
        </div>
      );
    }

    const total = statusData.reduce((sum, item) => sum + item.count, 0);
    let accumulatedAngle = 0;

    return (
      <div className="flex flex-col md:flex-row items-center justify-around gap-6 h-full py-4">
        {/* SVG Circle */}
        <div className="relative w-40 h-40">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 42 42">
            <circle cx="21" cy="21" r="15.915" fill="transparent" stroke="var(--border)" strokeWidth="4" />
            {statusData.map((item, idx) => {
              const percentage = (item.count / total) * 100;
              const strokeDasharray = `${percentage} ${100 - percentage}`;
              const strokeDashoffset = 100 - accumulatedAngle;
              accumulatedAngle += percentage;
              
              return (
                <circle
                  key={item._id}
                  cx="21"
                  cy="21"
                  r="15.915"
                  fill="transparent"
                  stroke={getStatusColor(item._id)}
                  strokeWidth="5"
                  strokeDasharray={strokeDasharray}
                  strokeDashoffset={strokeDashoffset}
                  className="transition-all duration-500 hover:stroke-[6px]"
                />
              );
            })}
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-2xl font-black text-[--text-primary] font-mono">{total}</span>
            <span className="text-[9px] text-[--text-secondary] uppercase font-bold tracking-wider">{t('Total Leads')}</span>
          </div>
        </div>

        {/* Legend */}
        <div className="space-y-2 text-xs w-full max-w-[180px]">
          {statusData.map(item => {
            const pct = ((item.count / total) * 100).toFixed(1);
            return (
              <div key={item._id} className="flex justify-between items-center bg-stone-50 px-2.5 py-1.5 rounded border border-[--border]">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: getStatusColor(item._id) }}></span>
                  <span className="capitalize text-[--text-secondary] font-semibold">{item._id}</span>
                </div>
                <span className="text-[--text-primary] font-bold font-mono">{pct}%</span>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // 2. Horizontal Bar Chart
  const renderHorizontalBars = () => {
    if (areaData.length === 0) {
      return (
        <div className="flex items-center justify-center h-full text-xs text-[--text-secondary]">
          {t('No location distribution data found')}
        </div>
      );
    }

    const maxVal = Math.max(...areaData.map(d => d.count), 1);

    return (
      <div className="space-y-3 py-2 h-full overflow-y-auto max-h-[250px] pr-2">
        {areaData.map((item, idx) => {
          const pct = (item.count / maxVal) * 100;
          return (
            <div key={idx} className="space-y-1">
              <div className="flex justify-between text-xs font-semibold">
                <span className="text-[--text-secondary] truncate max-w-[150px]">{item._id || 'Unknown'}</span>
                <span className="text-[--text-primary] font-mono">{item.count} leads</span>
              </div>
              <div className="w-full bg-stone-100 h-2 rounded-full overflow-hidden">
                <div 
                  className="bg-[--accent] h-full rounded-full transition-all duration-500" 
                  style={{ width: `${pct}%`, backgroundColor: `rgba(200, 149, 108, ${0.4 + (pct / 100) * 0.6})` }}
                ></div>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  // 3. Line Chart for Conversion Rate over Time
  const renderLineChart = () => {
    if (conversionData.length === 0) {
      return (
        <div className="flex items-center justify-center h-full text-xs text-[--text-secondary]">
          {t('No conversion trend metrics available')}
        </div>
      );
    }

    const points = conversionData.map((w, idx) => {
      const rate = w.total > 0 ? (w.converted / w.total) * 100 : 0;
      return { label: `W${w.week ?? w._id?.week ?? idx + 1}`, value: rate };
    });

    const maxVal = 100;
    const width = 450;
    const height = 150;
    const padding = 20;

    const chartWidth = width - padding * 2;
    const chartHeight = height - padding * 2;

    const pointsString = points.map((p, idx) => {
      const x = padding + (idx / Math.max(points.length - 1, 1)) * chartWidth;
      const y = height - padding - (p.value / maxVal) * chartHeight;
      return `${x},${y}`;
    }).join(' ');

    return (
      <div className="py-2 space-y-4">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto overflow-visible">
          {/* Grid lines */}
          <line x1={padding} y1={padding} x2={width - padding} y2={padding} stroke="var(--border)" strokeDasharray="3 3" />
          <line x1={padding} y1={height/2} x2={width - padding} y2={height/2} stroke="var(--border)" strokeDasharray="3 3" />
          <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="var(--border-strong)" />

          {/* Graph line */}
          {points.length > 1 && (
            <polyline
              fill="transparent"
              stroke="var(--accent)"
              strokeWidth="2.5"
              points={pointsString}
            />
          )}

          {/* Graph points */}
          {points.map((p, idx) => {
            const x = padding + (idx / Math.max(points.length - 1, 1)) * chartWidth;
            const y = height - padding - (p.value / maxVal) * chartHeight;
            return (
              <g key={idx} className="group cursor-pointer">
                <circle
                  cx={x}
                  cy={y}
                  r="4"
                  fill="white"
                  stroke="var(--accent)"
                  strokeWidth="2"
                  className="hover:r-6 hover:fill-[--accent] transition-all"
                />
                <text
                  x={x}
                  y={y - 8}
                  fill="#2d2520"
                  fontSize="8"
                  textAnchor="middle"
                  className="opacity-0 group-hover:opacity-100 font-mono transition-all font-bold bg-white"
                >
                  {p.value.toFixed(0)}%
                </text>
              </g>
            );
          })}

          {/* Axis Labels */}
          {points.map((p, idx) => {
            if (points.length > 8 && idx % 2 !== 0) return null;
            const x = padding + (idx / Math.max(points.length - 1, 1)) * chartWidth;
            return (
              <text
                key={idx}
                x={x}
                y={height - padding + 12}
                fill="var(--text-muted)"
                fontSize="7"
                textAnchor="middle"
                className="font-mono"
              >
                {p.label}
              </text>
            );
          })}
        </svg>

        <div className="flex justify-between items-center text-[10px] text-[--text-secondary] px-2">
          <span>{t('Weekly dynamic conversion tracking')}</span>
          <span className="flex items-center gap-1 text-[--accent]"><TrendingUp size={10} /> {t('Goal rate target: 100%')}</span>
        </div>
      </div>
    );
  };

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

  if (!activeVertical) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-[--text-secondary] text-sm">
        <span>{t('No workspace active. Choose a Vertical to inspect reports.')}</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      
      {/* Header bar controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-[--text-primary] uppercase tracking-wider">{t('Reports & Analytics')}</h2>
          <p className="text-xs text-[--text-secondary] mt-1">{t('Lead processing KPIs, conversion rates, and employee activity audit logs')}</p>
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

          {activeTab === 'analytics' && (
            <button
              onClick={handleExportCSV}
              className="flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-stone-50 border border-[--border-strong] text-[--text-secondary] font-semibold text-xs rounded-lg transition-all shadow-sm"
            >
              <Download size={14} />
              <span>{t('Export CSV')}</span>
            </button>
          )}
        </div>
      </div>

      {/* Tabs Switcher Navigation */}
      <div className="border-b border-[--border] flex gap-6 text-xs font-bold uppercase tracking-wider select-none">
        <button
          onClick={() => setActiveTab('analytics')}
          className={`pb-3 border-b-2 transition-all flex items-center gap-2 ${
            activeTab === 'analytics' ? 'border-[--accent] text-[--accent] font-black' : 'border-transparent text-[--text-secondary] hover:text-[--text-primary]'
          }`}
        >
          <BarChart3 size={15} />
          <span>Analytics Dashboard</span>
        </button>
        <button
          onClick={() => setActiveTab('audit')}
          className={`pb-3 border-b-2 transition-all flex items-center gap-2 ${
            activeTab === 'audit' ? 'border-[--accent] text-[--accent] font-black' : 'border-transparent text-[--text-secondary] hover:text-[--text-primary]'
          }`}
        >
          <Terminal size={15} />
          <span>Operator Audit Logs</span>
        </button>
      </div>

      {/* TAB CONTENT 1: ANALYTICS DASHBOARD */}
      {activeTab === 'analytics' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* Panel 1: Leads by Status */}
          <div className="glass-panel bg-white shadow-sm border border-[--border] p-6 space-y-4 rounded-xl">
            <div className="flex justify-between items-center border-b border-[--border] pb-3">
              <h3 className="text-sm font-bold text-[--text-primary] uppercase tracking-wider flex items-center gap-2">
                <CheckCircle2 size={16} className="text-[#2ecc71]" />
                <span>{t('Leads by Status')}</span>
              </h3>
              <span className="text-[10px] text-[--text-secondary] uppercase font-bold tracking-wider">{t('Donut Breakdown')}</span>
            </div>
            {loading ? (
              <div className="flex justify-center items-center h-48"><div className="spinner"></div></div>
            ) : (
              renderDonutChart()
            )}
          </div>

          {/* Panel 2: Leads by Area */}
          <div className="glass-panel bg-white shadow-sm border border-[--border] p-6 space-y-4 rounded-xl">
            <div className="flex justify-between items-center border-b border-[--border] pb-3">
              <h3 className="text-sm font-bold text-[--text-primary] uppercase tracking-wider flex items-center gap-2">
                <MapPin size={16} className="text-amber-500" />
                <span>{t('Top 10 Lead Locations (Area)')}</span>
              </h3>
              <span className="text-[10px] text-[--text-secondary] uppercase font-bold tracking-wider">{t('Horizontal distribution')}</span>
            </div>
            {loading ? (
              <div className="flex justify-center items-center h-48"><div className="spinner"></div></div>
            ) : (
              renderHorizontalBars()
            )}
          </div>

          {/* Panel 3: Conversion Rate Over Time */}
          <div className="glass-panel bg-white shadow-sm border border-[--border] p-6 space-y-4 rounded-xl">
            <div className="flex justify-between items-center border-b border-[--border] pb-3">
              <h3 className="text-sm font-bold text-[--text-primary] uppercase tracking-wider flex items-center gap-2">
                <TrendingUp size={16} className="text-[--accent]" />
                <span>{t('Weekly Conversion Trend')}</span>
              </h3>
              <span className="text-[10px] text-[--text-secondary] uppercase font-bold tracking-wider">{t('Last 90 Days')}</span>
            </div>
            {loading ? (
              <div className="flex justify-center items-center h-48"><div className="spinner"></div></div>
            ) : (
              renderLineChart()
            )}
          </div>

          {/* Panel 4: Operator Conversion Performance ranking */}
          <div className="glass-panel bg-white shadow-sm border border-[--border] p-6 space-y-4 rounded-xl">
            <div className="flex justify-between items-center border-b border-[--border] pb-3">
              <h3 className="text-sm font-bold text-[--text-primary] uppercase tracking-wider flex items-center gap-2">
                <Award size={16} className="text-[--accent]" />
                <span>{t('Operator Conversion Performance')}</span>
              </h3>
              <span className="text-[10px] text-[--text-secondary] uppercase font-bold tracking-wider">{t('Ranked Conversion')}</span>
            </div>

            <div className="overflow-x-auto h-48 overflow-y-auto pr-1">
              {loading ? (
                <div className="flex justify-center items-center h-full"><div className="spinner"></div></div>
              ) : agentData.length === 0 ? (
                <div className="flex items-center justify-center h-full text-xs text-[--text-secondary]">
                  {t('No operators performance recorded in range')}
                </div>
              ) : (
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-[--border-strong] bg-stone-50 text-[10px] text-[--text-secondary] font-bold uppercase tracking-wider">
                      <th className="px-4 py-2.5">{t('Employee Name')}</th>
                      <th className="px-4 py-2.5">{t('Spoken To')}</th>
                      <th className="px-4 py-2.5">{t('Converted')}</th>
                      <th className="px-4 py-2.5 text-right">{t('Conversion Ratio')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[--border]">
                    {agentData.map(ag => (
                      <tr key={ag._id} className="hover:bg-stone-50/50 transition-all">
                        <td className="px-4 py-2.5 font-bold text-[--text-primary] flex items-center gap-2 max-w-[150px] truncate">
                          <div className="w-6 h-6 rounded-full bg-[--accent-light] flex items-center justify-center text-[10px] uppercase text-[--accent] border border-[--accent-border] shrink-0">
                            {ag.name.slice(0, 2)}
                          </div>
                          <div className="flex flex-col truncate">
                            <span className="truncate">{ag.name}</span>
                            <span className="text-[9px] text-[--text-muted] font-mono leading-none truncate">{ag.email}</span>
                          </div>
                        </td>
                        <td className="px-4 py-2.5 font-mono text-[--text-primary]">{ag.totalAssigned}</td>
                        <td className="px-4 py-2.5 font-mono text-[#2ecc71] font-semibold">{ag.converted}</td>
                        <td className="px-4 py-2.5 text-right">
                          <div className="flex items-center justify-end gap-2 font-mono">
                            <span className="text-[--text-primary] font-bold">{ag.conversionRate.toFixed(1)}%</span>
                            {/* Tiny spark bar */}
                            <div className="w-10 bg-stone-100 h-1.5 rounded-full overflow-hidden hidden md:block">
                              <div className="bg-[--accent] h-full" style={{ width: `${ag.conversionRate}%` }}></div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

        </div>
      )}

      {/* TAB CONTENT 2: OPERATOR AUDIT LOGS */}
      {activeTab === 'audit' && (
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
                <option value="STAGE_CREATED">Lead Stage Created</option>
                <option value="STAGE_UPDATED">Lead Stage Updated</option>
                <option value="STAGE_DELETED">Lead Stage Deleted</option>
                <option value="followup.create">Follow-Up Scheduled</option>
                <option value="followup.complete">Follow-Up Completed</option>
                <option value="user.invite">User Invited</option>
                <option value="user.profile_update">User Profile Updated</option>
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
      )}

    </div>
  );
};

export default ReportsPage;
