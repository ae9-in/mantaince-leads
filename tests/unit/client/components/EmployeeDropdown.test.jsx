// @vitest-environment jsdom
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { describe, it, expect, vi } from 'vitest';
import { EmployeeDropdown } from '../../../../client/src/components/EmployeeDropdown.jsx';

const mockEmployees = [
  { id: 'e1', name: 'Ji Arora', email: 'ji@test.com', role: 'AGENT' },
  { id: 'e2', name: 'Rahul Sharma', email: 'r@test.com', role: 'ADMIN' },
];

describe('EmployeeDropdown', () => {
  it('renders placeholder when no value is selected', () => {
    render(
      <EmployeeDropdown
        employees={mockEmployees}
        value={null}
        onChange={(() => {})}
        placeholder="Search employees..."
      />
    );
    expect(screen.getByText('Search employees...')).toBeInTheDocument();
  });

  it('opens list and filters employees when search term typed', () => {
    render(
      <EmployeeDropdown
        employees={mockEmployees}
        value={null}
        onChange={(() => {})}
        placeholder="Search employees..."
      />
    );

    // Open dropdown
    fireEvent.click(screen.getByRole('button', { name: /employee/i }));

    const searchInput = screen.getByPlaceholderText('Search employees');
    expect(searchInput).toBeInTheDocument();

    // Type query
    fireEvent.change(searchInput, { target: { value: 'Rahul' } });

    expect(screen.queryByText('Ji Arora')).not.toBeInTheDocument();
    expect(screen.getByText('Rahul Sharma')).toBeInTheDocument();
  });

  it('calls onChange when employee row clicked', () => {
    const onChangeMock = vi.fn();
    render(
      <EmployeeDropdown
        employees={mockEmployees}
        value={null}
        onChange={onChangeMock}
      />
    );

    fireEvent.click(screen.getByRole('button'));
    fireEvent.click(screen.getByText('Ji Arora'));

    expect(onChangeMock).toHaveBeenCalledWith('e1');
  });

  it('meets minimum touch target height of 48px', () => {
    render(
      <EmployeeDropdown
        employees={mockEmployees}
        value={null}
        onChange={(() => {})}
      />
    );
    const button = screen.getByRole('button');
    const style = window.getComputedStyle(button);
    expect(style.minHeight).toBe('48px');
  });
});
