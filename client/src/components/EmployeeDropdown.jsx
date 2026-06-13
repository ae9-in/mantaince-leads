import React, { useState } from 'react';

export const EmployeeDropdown = ({ employees = [], value, onChange, placeholder = 'Search employees...' }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isOpen, setIsOpen] = useState(false);

  const filtered = employees.filter(emp =>
    emp.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const selectedEmployee = employees.find(emp => emp.id === value);

  return (
    <div className="relative w-full" style={{ minHeight: '48px' }}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between border border-stone-300 rounded-lg px-3 py-2 bg-white text-xs text-[--text-primary]"
        style={{ minHeight: '48px' }}
        aria-label="employee"
      >
        <span>{selectedEmployee ? `${selectedEmployee.name} (${selectedEmployee.role})` : placeholder}</span>
        <span className="text-stone-400">▼</span>
      </button>

      {isOpen && (
        <div className="absolute left-0 right-0 mt-1 bg-white border border-stone-200 rounded-lg shadow-lg z-50 max-h-60 overflow-y-auto p-2">
          <input
            type="text"
            className="w-full border border-stone-300 rounded px-2 py-1 mb-2 text-xs focus:outline-none focus:border-[--accent]"
            placeholder="Search employees"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <div className="space-y-1">
            {filtered.map(emp => (
              <div
                key={emp.id}
                onClick={() => {
                  onChange(emp.id);
                  setIsOpen(false);
                }}
                className="px-2 py-1.5 hover:bg-stone-50 rounded cursor-pointer text-xs flex justify-between items-center"
              >
                <span>{emp.name}</span>
                <span className="text-[10px] bg-stone-100 border border-stone-200 px-1 py-0.2 rounded text-stone-500 font-bold uppercase">
                  {emp.role === 'AGENT' ? 'Agent' : emp.role}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default EmployeeDropdown;
