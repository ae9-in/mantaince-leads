/* eslint-disable i18next/no-literal-string */
import React, { useState, useEffect } from 'react';
import axios from '../api/axios.js';
import { useUiStore } from '../store/uiStore.js';
import { 
  BarChart3, Calendar, Download, RefreshCw, User, CheckCircle2, 
  TrendingUp, MapPin, Award, ArrowUpRight, Clock
} from 'lucide-react';
import toast from 'react-hot-toast';

const t = (val) => val;

export const ReportsPage = () => {
  const { activeVertical, leadsRefreshTrigger } = useUiStore();
  const [loading, setLoading] = useState(true);

  // Filter states
  const [rangeType, setRangeType] = useState('30'); // '7' | '30' | '90' | 'custom'
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Report datasets
  const [statusData, setStatusData] = useState([]);
  const [areaData, setAreaData] = useState([]);
  const [conversionData, setConversionData] = useState([]);
  const [agentData, setEmployeeData] = useState([]);

  // Compute dates based on range selection
  useEffect(() => {
    if (rangeType === 'custom') return;
    
    const to = new Date();
    const from = new Date();
    from.setDate(to.getDate() - parseInt(rangeType, 10));

    setDateFrom(from.toISOString().split('T')[0]);
    setDateTo(to.toISOString().split('T')[0]);
  }, [rangeType]);

  const fetchReportData = async () => {
    if (!activeVertical) return;
    setLoading(true);
    try {
      const params = {
        verticalId: activeVertical._id,
        dateFrom: dateFrom ? `${dateFrom}T00:00:00.000Z` : undefined,
        dateTo: dateTo ? `${dateTo}T23:59:59.999Z` : undefined
      };

      const [statusRes, areaRes, conversionRes, agentRes] = await Promise.all([
        axios.get('/api/v1/reports/status-distribution', { params }),
        axios.get('/api/v1/reports/area-distribution', { params }),
        axios.get('/api/v1/reports/conversion-over-time', { params }),
        axios.get('/api/v1/reports/agent-performance', { params })
      ]);

      setStatusData(statusRes.data.data);
      setAreaData(areaRes.data.data);
      setConversionData(conversionRes.data.data);
      setEmployeeData(agentRes.data.data);
    } catch (err) {
      toast.error('Failed to load performance metrics distribution');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeVertical && dateFrom && dateTo) {
      fetchReportData();
    }
  }, [activeVertical, dateFrom, dateTo, leadsRefreshTrigger]);

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

  // 2. Horizontal Bar Chart (SVG or clean standard bars)
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

  // 3. Line Chart for Conversion Rate over Time (SVG line graph)
  const renderLineChart = () => {
    if (conversionData.length === 0) {
      return (
        <div className="flex items-center justify-center h-full text-xs text-[--text-secondary]">
          {t('No conversion trend metrics available')}
        </div>
      );
    }

    // Map rates: weekly conversion rates (%)
    const points = conversionData.map(w => {
      const rate = w.total > 0 ? (w.converted / w.total) * 100 : 0;
      return { label: `W${w.week ?? w._id?.week}`, value: rate };
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
            if (points.length > 8 && idx % 2 !== 0) return null; // simplify labels
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
          <p className="text-xs text-[--text-secondary] mt-1">{t('Lead processing KPIs, conversion rates, and agent metrics dashboards')}</p>
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

          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-stone-50 border border-[--border-strong] text-[--text-secondary] font-semibold text-xs rounded-lg transition-all shadow-sm"
          >
            <Download size={14} />
            <span>{t('Export CSV')}</span>
          </button>
        </div>
      </div>

      {/* Grid of four main analytical cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Panel 1: Leads by Status */}
        <div className="glass-panel bg-white shadow-sm border border-[--border] p-6 space-y-4">
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
        <div className="glass-panel bg-white shadow-sm border border-[--border] p-6 space-y-4">
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
        <div className="glass-panel bg-white shadow-sm border border-[--border] p-6 space-y-4">
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

        {/* Panel 4: Top Employees Performance Table */}
        <div className="glass-panel bg-white shadow-sm border border-[--border] p-6 space-y-4">
          <div className="flex justify-between items-center border-b border-[--border] pb-3">
            <h3 className="text-sm font-bold text-[--text-primary] uppercase tracking-wider flex items-center gap-2">
              <Award size={16} className="text-[--accent]" />
              <span>{t('Operator Conversion Performance')}</span>
            </h3>
            <span className="text-[10px] text-[--text-secondary] uppercase font-bold tracking-wider">{t('Ranked Conversion')}</span>
          </div>

          <div className="overflow-x-auto h-48 overflow-y-auto">
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
                    <tr key={ag.id} className="hover:bg-stone-50/50 transition-all">
                      <td className="px-4 py-2.5 font-bold text-[--text-primary] flex items-center gap-2 max-w-[150px] truncate">
                        <div className="w-6 h-6 rounded-full bg-[--accent-light] flex items-center justify-center text-[10px] uppercase text-[--accent] border border-[--accent-border]">
                          {ag.name.slice(0, 2)}
                        </div>
                        <div className="flex flex-col">
                          <span>{ag.name}</span>
                          <span className="text-[9px] text-[--text-muted] font-mono leading-none">{ag.email}</span>
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

    </div>
  );
};

export default ReportsPage;
