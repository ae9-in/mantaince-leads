import React, { useState, useEffect } from 'react';
import axios from '../api/axios.js';
import { FileSpreadsheet } from 'lucide-react';

/**
 * CSV Template Preview component
 * Shows base columns and dynamic columns layout mapping.
 */
export const CsvTemplatePreview = ({ verticalId }) => {
  const [fields, setFields] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!verticalId) return;

    const fetchFields = async () => {
      setLoading(true);
      try {
        const response = await axios.get(`/api/v1/configs/verticals/${verticalId}/fields/csv-template`);
        setFields(response.data.data);
      } catch (err) {
        console.error('Error fetching template fields:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchFields();
  }, [verticalId]);

  if (!verticalId) return null;

  const baseHeaders = [
    'Name',
    'Number',
    'Business',
    'Employee Spoken',
    'Lead Type',
    'Status',
    'Name Business',
    'Date',
    'Delivered Location (Google Maps Location)',
    'Delivered Link'
  ];

  const customHeaders = fields.map(f => f.csvHeader || f.label);
  const allHeaders = [...baseHeaders, ...customHeaders];

  return (
    <div className="glass-panel p-4 bg-black/20">
      <div className="flex items-center gap-2 mb-3 text-[#66fcf1]">
        <FileSpreadsheet size={16} />
        <span className="text-sm font-bold uppercase tracking-wider">CSV Spreadsheet Header Mapping Preview</span>
      </div>

      {loading ? (
        <div className="flex justify-center p-4">
          <div className="spinner" style={{ width: '20px', height: '20px' }}></div>
        </div>
      ) : (
        <div className="overflow-x-auto max-w-full pb-2">
          <div className="flex gap-2 min-w-max">
            {allHeaders.map((header, idx) => {
              const isBase = idx < baseHeaders.length;
              return (
                <div
                  key={header}
                  className={`px-3 py-1.5 rounded text-xs font-mono select-none ${
                    isBase
                      ? 'bg-white/5 border border-white/10 text-[#8b8e95]'
                      : 'bg-[#66fcf1]/10 border border-[#66fcf1]/20 text-[#66fcf1]'
                  }`}
                >
                  {header}
                  {isBase ? (
                    <span className="block text-[9px] uppercase mt-0.5 text-white/30">System base</span>
                  ) : (
                    <span className="block text-[9px] uppercase mt-0.5 text-[#66fcf1]/60">Custom config</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default CsvTemplatePreview;
