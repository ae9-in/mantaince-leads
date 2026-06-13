// @vitest-environment jsdom
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { describe, it, expect, vi } from 'vitest';
import { FollowUpCalendar } from '../../../../client/src/components/FollowUpCalendar.jsx';

describe('FollowUpCalendar', () => {
  const mockCalendarData = {
    '2026-06-12': { pending: 3, completed: 1, missed: 0, total: 4 },
    '2026-06-15': { pending: 0, completed: 5, missed: 0, total: 5 },
    '2026-06-20': { pending: 2, completed: 0, missed: 1, total: 3 },
  };

  it('renders all 30 days of the month', () => {
    render(
      <FollowUpCalendar
        calendarData={mockCalendarData}
        selectedDate={new Date('2026-06-12')}
        onDateClick={(() => {})}
      />
    );
    expect(screen.getAllByRole('gridcell')).toHaveLength(30);
  });

  it('shows correct count badge on dates with follow-ups', () => {
    render(
      <FollowUpCalendar
        calendarData={mockCalendarData}
        selectedDate={new Date('2026-06-12')}
        onDateClick={(() => {})}
      />
    );

    const june12Cell = screen.getByTestId('calendar-cell-2026-06-12');
    expect(june12Cell.textContent).toContain('4');
  });

  it('applies orange class for pending follow-ups', () => {
    render(
      <FollowUpCalendar
        calendarData={mockCalendarData}
        selectedDate={new Date('2026-06-12')}
        onDateClick={(() => {})}
      />
    );

    const june12Cell = screen.getByTestId('calendar-cell-2026-06-12');
    expect(june12Cell.className).toMatch(/pending/);
  });

  it('applies green class for all-completed days', () => {
    render(
      <FollowUpCalendar
        calendarData={mockCalendarData}
        selectedDate={new Date('2026-06-12')}
        onDateClick={(() => {})}
      />
    );

    const june15Cell = screen.getByTestId('calendar-cell-2026-06-15');
    expect(june15Cell.className).toMatch(/completed/);
  });

  it('opens follow-up modal on date click', () => {
    const onDateClickMock = vi.fn();
    render(
      <FollowUpCalendar
        calendarData={mockCalendarData}
        selectedDate={new Date('2026-06-12')}
        onDateClick={onDateClickMock}
      />
    );

    fireEvent.click(screen.getByTestId('calendar-cell-2026-06-12'));
    expect(onDateClickMock).toHaveBeenCalledWith('2026-06-12');
  });

  it('renders as list view on mobile viewport (375px)', () => {
    Object.defineProperty(window, 'innerWidth', { value: 375, writable: true });
    window.dispatchEvent(new Event('resize'));

    render(
      <FollowUpCalendar
        calendarData={mockCalendarData}
        selectedDate={new Date('2026-06-12')}
        onDateClick={(() => {})}
      />
    );
    expect(screen.getByTestId('calendar-list-view')).toBeInTheDocument();
    expect(screen.queryByTestId('calendar-grid-view')).not.toBeInTheDocument();

    // Reset window width
    Object.defineProperty(window, 'innerWidth', { value: 1024, writable: true });
  });
});
