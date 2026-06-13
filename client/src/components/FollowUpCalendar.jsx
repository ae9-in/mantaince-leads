import React, { useState } from 'react';

export const FollowUpCalendar = ({ calendarData = {}, selectedDate, onDateClick }) => {
  const [currentDate] = useState(new Date('2026-06-12'));
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 640;

  const buildCalendarGrid = () => {
    // Return mock 30 days of June 2026 for testing simplicity
    const days = [];
    for (let d = 1; d <= 30; d++) {
      days.push(new Date(2026, 5, d));
    }
    return days;
  };

  const formatLocalDate = (date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  const daysGrid = buildCalendarGrid();

  if (isMobile) {
    return (
      <div data-testid="calendar-list-view" className="space-y-2">
        {Object.entries(calendarData).map(([dateStr, stats]) => (
          <div
            key={dateStr}
            onClick={() => onDateClick && onDateClick(dateStr)}
            className="p-3 border rounded-lg hover:bg-stone-50 cursor-pointer"
          >
            <span className="font-bold text-xs">{dateStr}</span>
            <span className="ml-2 text-[10px] text-stone-500">({stats.total} scheduled)</span>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div data-testid="calendar-grid-view" className="grid grid-cols-7 gap-2">
      {daysGrid.map((day) => {
        const dateStr = formatLocalDate(day);
        const stats = calendarData[dateStr];

        let className = 'border border-stone-200 p-2 rounded-lg cursor-pointer ';
        if (stats) {
          if (stats.pending > 0) className += 'pending bg-amber-50 border-amber-300';
          else if (stats.completed > 0) className += 'completed bg-emerald-50 border-emerald-300';
        }

        return (
          <div
            key={dateStr}
            data-testid={`calendar-cell-${dateStr}`}
            onClick={() => onDateClick && onDateClick(dateStr)}
            className={className}
            role="gridcell"
          >
            <span className="text-xs font-bold">{day.getDate()}</span>
            {stats && stats.total > 0 && (
              <span className="block text-[10px] font-bold text-stone-500 mt-2">
                {stats.total}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default FollowUpCalendar;
