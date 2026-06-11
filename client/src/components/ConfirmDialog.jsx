import React, { useState, useEffect } from 'react';
import { X, AlertTriangle } from 'lucide-react';

/**
 * Confirm Dialog
 * Renders a confirmation modal. Supports danger themes and strict input matching confirmations.
 */
export const ConfirmDialog = ({
  isOpen,
  title,
  description,
  confirmLabel = 'Confirm',
  onConfirm,
  onCancel,
  danger = false,
  requireTyping = ''
}) => {
  const [inputVal, setInputVal] = useState('');

  // Clear input on open/close changes
  useEffect(() => {
    if (isOpen) {
      setInputVal('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const isConfirmDisabled = requireTyping && inputVal !== requireTyping;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/40 backdrop-blur-sm p-4">
      <div className="glass-panel w-full max-w-md p-6 bg-white border border-[--border] shadow-xl">
        <div className="flex justify-between items-start mb-4">
          <div className="flex items-center gap-3">
            {danger && <AlertTriangle className="text-red-600" size={24} />}
            <h3 className="text-lg font-bold text-[--text-primary]">{title}</h3>
          </div>
          <button className="text-[--text-secondary] hover:text-[--text-primary] transition-all" onClick={onCancel}>
            <X size={20} />
          </button>
        </div>

        <p className="text-sm text-[--text-secondary] mb-4 leading-relaxed">{description}</p>

        {requireTyping && (
          <div className="mb-4 text-xs">
            <label className="block font-bold text-[--text-secondary] mb-2 uppercase">
              Type <span className="text-[--text-primary] select-all font-mono">"{requireTyping}"</span> to confirm:
            </label>
            <input
              type="text"
              className="w-full bg-[--bg-input] border border-[--border-strong] rounded-lg px-3 py-2 text-[--text-primary] focus:outline-none focus:border-[--accent]"
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value)}
              placeholder="Type matching string here..."
            />
          </div>
        )}

        <div className="flex justify-end gap-3">
          <button
            type="button"
            className="px-4 py-2 border border-[--border-strong] text-[--text-secondary] rounded-lg text-sm hover:bg-stone-50 transition-all bg-white font-semibold"
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={isConfirmDisabled}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all select-none shadow-sm ${
              danger
                ? 'bg-red-600 text-white hover:bg-red-700 disabled:opacity-40'
                : 'bg-[--accent] text-white hover:bg-[--accent-hover] disabled:opacity-40'
            }`}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmDialog;
