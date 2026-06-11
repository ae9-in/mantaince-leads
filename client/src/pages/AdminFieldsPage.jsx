import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from '../api/axios.js';
import { 
  ArrowLeft, Plus, Check, X, Settings, ListPlus, Trash2, Edit2, 
  AlertTriangle, HelpCircle, Save, Download, ArrowUp, ArrowDown, ListFilter
} from 'lucide-react';
import toast from 'react-hot-toast';

export const AdminFieldsPage = () => {
  const { id: verticalId } = useParams();
  
  const [vertical, setVertical] = useState(null);
  const [fields, setFields] = useState([]);
  const [loading, setLoading] = useState(true);

  // Field Add Form Panel state
  const [showAddDrawer, setShowAddDrawer] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const [newKey, setNewKey] = useState('');
  const [newType, setNewType] = useState('text');
  const [newRequired, setNewRequired] = useState(false);
  const [newVisible, setNewVisible] = useState(true);
  const [newIsTableColumn, setNewIsTableColumn] = useState(true);
  const [newIsCsvMapped, setNewIsCsvMapped] = useState(true);
  const [newCsvHeader, setNewCsvHeader] = useState('');
  const [newPlaceholder, setNewPlaceholder] = useState('');
  const [newDefaultValue, setNewDefaultValue] = useState('');
  const [newRegex, setNewRegex] = useState('');
  const [newRegexMessage, setNewRegexMessage] = useState('');
  const [optionsText, setOptionsText] = useState(''); // comma-separated select values
  const [savingField, setSavingField] = useState(false);

  // Inline Editing row tracking
  const [editingFieldId, setEditingFieldId] = useState(null);
  const [editingLabel, setEditingLabel] = useState('');
  const [editingType, setEditingType] = useState('');
  const [editingCsvHeader, setEditingCsvHeader] = useState('');

  const fetchFieldMetadata = async () => {
    setLoading(true);
    try {
      const [vertRes, fieldsRes] = await Promise.all([
        axios.get(`/api/v1/verticals/${verticalId}`),
        axios.get(`/api/v1/configs/verticals/${verticalId}/fields`)
      ]);
      setVertical(vertRes.data.data);
      setFields(fieldsRes.data.data);
    } catch {
      toast.error('Failed to load vertical field configuration data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (verticalId) {
      fetchFieldMetadata();
    }
  }, [verticalId]);

  // Handle auto-generation of machine key from label
  useEffect(() => {
    if (!editingFieldId) {
      const key = newLabel
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/(^-|_$)/g, '');
      setNewKey(key);
      setNewCsvHeader(newLabel);
    }
  }, [newLabel, editingFieldId]);

  const handleAddField = async (e) => {
    e.preventDefault();
    if (!newLabel.trim() || !newKey.trim()) return;
    setSavingField(true);

    const options = (newType === 'select' || newType === 'multiselect')
      ? optionsText.split(',').map(o => o.trim()).filter(Boolean)
      : [];

    try {
      await axios.post(`/api/v1/configs/verticals/${verticalId}/fields`, {
        fieldKey: newKey,
        label: newLabel,
        fieldType: newType,
        options,
        placeholder: newPlaceholder,
        defaultValue: newDefaultValue,
        isRequired: newRequired,
        isVisible: newVisible,
        isTableColumn: newIsTableColumn,
        isCsvMapped: newIsCsvMapped,
        csvHeader: newIsCsvMapped ? newCsvHeader : undefined,
        validationRegex: newRegex || undefined,
        validationMessage: newRegex ? newRegexMessage : undefined,
        displayOrder: fields.length
      });

      toast.success('Dynamic field config mapped successfully!');
      setShowAddDrawer(false);
      // Reset state
      setNewLabel('');
      setNewKey('');
      setNewType('text');
      setNewRequired(false);
      setNewVisible(true);
      setNewIsTableColumn(true);
      setNewIsCsvMapped(true);
      setNewCsvHeader('');
      setNewPlaceholder('');
      setNewDefaultValue('');
      setNewRegex('');
      setNewRegexMessage('');
      setOptionsText('');

      await fetchFieldMetadata();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save field mapping');
    } finally {
      setSavingField(false);
    }
  };

  const handleStartInlineEdit = (field) => {
    setEditingFieldId(field._id);
    setEditingLabel(field.label);
    setEditingType(field.fieldType);
    setEditingCsvHeader(field.csvHeader || '');
  };

  const handleSaveInlineEdit = async (field) => {
    try {
      const res = await axios.patch(`/api/v1/configs/verticals/${verticalId}/fields/${field._id}`, {
        label: editingLabel,
        fieldType: editingType,
        csvHeader: editingCsvHeader || undefined
      });
      toast.success('Field profile updated');
      setFields(fields.map(f => f._id === field._id ? res.data.data : f));
      setEditingFieldId(null);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update field');
    }
  };

  const handleToggleBoolean = async (field, key, currentValue) => {
    try {
      const res = await axios.patch(`/api/v1/configs/verticals/${verticalId}/fields/${field._id}`, {
        [key]: !currentValue
      });
      setFields(fields.map(f => f._id === field._id ? res.data.data : f));
      toast.success('Setting toggled');
    } catch {
      toast.error('Failed to change toggle setting');
    }
  };

  const handleDeleteField = async (fieldId) => {
    if (window.confirm('Delete field key? This operation is rejected if leads already store values for this field key.')) {
      try {
        await axios.delete(`/api/v1/configs/verticals/${verticalId}/fields/${fieldId}`);
        toast.success('Field config removed');
        setFields(fields.filter(f => f._id !== fieldId));
      } catch (err) {
        toast.error(err.response?.data?.error || 'Delete failed');
      }
    }
  };

  // Move display orders
  const moveField = async (index, direction) => {
    const nextIndex = direction === 'up' ? index - 1 : index + 1;
    if (nextIndex < 0 || nextIndex >= fields.length) return;

    const list = [...fields];
    // swap
    const temp = list[index];
    list[index] = list[nextIndex];
    list[nextIndex] = temp;

    const payload = list.map((item, idx) => ({
      id: item._id,
      displayOrder: idx
    }));

    setFields(list);

    try {
      await axios.patch(`/api/v1/configs/verticals/${verticalId}/fields/reorder`, payload);
      toast.success('Field display order rearranged');
    } catch {
      toast.error('Failed to reorder field layout');
      fetchFieldMetadata();
    }
  };

  const handleDownloadTemplatePreview = async () => {
    try {
      const response = await axios.get(`/api/v1/leads/csv/template/${verticalId}`);
      const blob = new Blob([response.data], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `leads-template-${vertical?.slug}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch {
      toast.error('Failed to download CSV template');
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Breadcrumbs Top Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[--border] pb-4">
        <div className="flex items-center gap-3">
          <Link
            to="/admin/verticals"
            className="p-1.5 border border-[--border-strong] rounded-lg text-[--text-secondary] hover:text-[--text-primary] transition-all hover:bg-stone-50 bg-white"
          >
            <ArrowLeft size={16} />
          </Link>
          <div>
            <h2 className="text-xl font-black text-[--text-primary] uppercase tracking-wider">Configure Dynamic Fields</h2>
            <p className="text-xs text-[--text-secondary] mt-0.5">Workspace Profile: <strong className="text-[--accent]">{vertical?.name}</strong></p>
          </div>
        </div>

        <div className="flex gap-2.5">
          <button
            onClick={handleDownloadTemplatePreview}
            className="flex items-center gap-1.5 px-3.5 py-2 border border-[--border-strong] hover:bg-stone-50 text-[--text-secondary] text-xs font-bold uppercase tracking-wider rounded-lg transition-all bg-white shadow-sm"
          >
            <Download size={13} />
            <span>Download CSV Template</span>
          </button>
          
          <button
            onClick={() => setShowAddDrawer(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-[--accent] text-white font-black uppercase text-xs rounded-lg hover:bg-[--accent-hover] transition-all shadow-md font-sans"
          >
            <Plus size={14} />
            <span>Add Configuration Field</span>
          </button>
        </div>
      </div>

      {/* Main Table Section list */}
      <div className="glass-panel border border-[--border] bg-white overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="border-b border-[--border-strong] bg-stone-50 text-xs font-bold text-[--text-secondary] uppercase select-none tracking-wider">
                <th className="px-4 py-4 w-12 text-center">Order</th>
                <th className="px-6 py-4">Display Label</th>
                <th className="px-6 py-4">Database key</th>
                <th className="px-6 py-4">Value type</th>
                <th className="px-4 py-4 text-center">Required</th>
                <th className="px-4 py-4 text-center">Show Table</th>
                <th className="px-4 py-4 text-center">CSV Mapping</th>
                <th className="px-4 py-4 text-center">Visible</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[--border] text-xs">
              {loading ? (
                Array.from({ length: 4 }).map((_, idx) => (
                  <tr key={idx} className="animate-pulse">
                    <td className="px-4 py-4"><div className="h-6 bg-stone-100 rounded w-6 mx-auto"></div></td>
                    <td className="px-6 py-4"><div className="h-4 bg-stone-100 rounded w-24"></div></td>
                    <td className="px-6 py-4"><div className="h-4 bg-stone-100 rounded w-32 font-mono"></div></td>
                    <td className="px-6 py-4"><div className="h-4 bg-stone-100 rounded w-16"></div></td>
                    <td className="px-4 py-4"><div className="h-4 bg-stone-100 rounded w-8 mx-auto"></div></td>
                    <td className="px-4 py-4"><div className="h-4 bg-stone-100 rounded w-8 mx-auto"></div></td>
                    <td className="px-4 py-4"><div className="h-4 bg-stone-100 rounded w-8 mx-auto"></div></td>
                    <td className="px-4 py-4"><div className="h-4 bg-stone-100 rounded w-8 mx-auto"></div></td>
                    <td className="px-6 py-4"><div className="h-8 bg-stone-100 rounded w-12 ml-auto"></div></td>
                  </tr>
                ))
              ) : fields.length === 0 ? (
                <tr>
                  <td colSpan="9" className="text-center py-12 text-[--text-secondary] text-xs">
                    No custom fields mapped. Click Add to introduce data parameters.
                  </td>
                </tr>
              ) : (
                fields.map((field, idx) => (
                  <tr key={field._id} className="hover:bg-stone-50/50 transition-all">
                    {/* Sort reorder triggers */}
                    <td className="px-4 py-4 text-center">
                      <div className="flex flex-col items-center gap-0.5">
                        <button
                          onClick={() => moveField(idx, 'up')}
                          disabled={idx === 0}
                          className="text-[--text-muted] hover:text-[--accent] disabled:opacity-10"
                        >
                          <ArrowUp size={12} />
                        </button>
                        <button
                          onClick={() => moveField(idx, 'down')}
                          disabled={idx === fields.length - 1}
                          className="text-[--text-muted] hover:text-[--accent] disabled:opacity-10"
                        >
                          <ArrowDown size={12} />
                        </button>
                      </div>
                    </td>

                    {/* Display label inline editable */}
                    <td className="px-6 py-4 font-semibold text-[--text-primary]">
                      {editingFieldId === field._id ? (
                        <input
                          type="text"
                          value={editingLabel}
                          onChange={(e) => setEditingLabel(e.target.value)}
                          className="bg-[--bg-input] border border-[--accent-border] rounded px-2 py-1 text-[--text-primary] text-xs focus:outline-none"
                        />
                      ) : (
                        <span>{field.label}</span>
                      )}
                    </td>

                    {/* Database Key machine identifier */}
                    <td className="px-6 py-4 font-mono text-[--text-secondary]">
                      {field.fieldKey}
                    </td>

                    {/* Field Value type edit inline */}
                    <td className="px-6 py-4">
                      {editingFieldId === field._id ? (
                        <select
                          value={editingType}
                          onChange={(e) => setEditingType(e.target.value)}
                          className="bg-[--bg-input] border border-[--accent-border] rounded px-2 py-1 text-[--text-primary] text-xs focus:outline-none"
                        >
                          {['text','number','phone','email','url','boolean','select','multiselect','date','textarea'].map(t => (
                            <option key={t} value={t}>{t}</option>
                          ))}
                        </select>
                      ) : (
                        <span className="capitalize px-2 py-0.5 bg-stone-100 rounded text-[10px] text-[--text-secondary] font-semibold border border-stone-200">
                          {field.fieldType}
                        </span>
                      )}
                    </td>

                    {/* Required flag toggle switch */}
                    <td className="px-4 py-4 text-center">
                      <input
                        type="checkbox"
                        checked={field.isRequired}
                        onChange={() => handleToggleBoolean(field, 'isRequired', field.isRequired)}
                        className="rounded border-[--border-strong] bg-[--bg-input] text-[--accent] focus:ring-0 w-4 h-4 cursor-pointer"
                      />
                    </td>

                    {/* Table column flag toggle switch */}
                    <td className="px-4 py-4 text-center">
                      <input
                        type="checkbox"
                        checked={field.isTableColumn}
                        onChange={() => handleToggleBoolean(field, 'isTableColumn', field.isTableColumn)}
                        className="rounded border-[--border-strong] bg-[--bg-input] text-[--accent] focus:ring-0 w-4 h-4 cursor-pointer"
                      />
                    </td>

                    {/* CSV Mapped toggle switch */}
                    <td className="px-4 py-4 text-center">
                      <div className="flex flex-col items-center gap-1.5">
                        <input
                          type="checkbox"
                          checked={field.isCsvMapped}
                          onChange={() => handleToggleBoolean(field, 'isCsvMapped', field.isCsvMapped)}
                          className="rounded border-[--border-strong] bg-[--bg-input] text-[--accent] focus:ring-0 w-4 h-4 cursor-pointer"
                        />
                        {field.isCsvMapped && (
                          <div className="text-[9px] text-[--text-secondary]">
                            {editingFieldId === field._id ? (
                              <input
                                type="text"
                                value={editingCsvHeader}
                                onChange={(e) => setEditingCsvHeader(e.target.value)}
                                className="bg-[--bg-input] border border-[--border-strong] text-[9px] rounded px-1.5 py-0.5 text-[--text-primary] focus:outline-none w-20 text-center"
                                placeholder="Header label"
                              />
                            ) : (
                              <span className="font-mono bg-stone-100 border border-stone-200 px-1 rounded truncate block max-w-[80px]" title={field.csvHeader}>
                                {field.csvHeader || field.label}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </td>

                    {/* Visible flag toggle */}
                    <td className="px-4 py-4 text-center">
                      <input
                        type="checkbox"
                        checked={field.isVisible}
                        onChange={() => handleToggleBoolean(field, 'isVisible', field.isVisible)}
                        className="rounded border-[--border-strong] bg-[--bg-input] text-[--accent] focus:ring-0 w-4 h-4 cursor-pointer"
                      />
                    </td>

                    {/* Action buttons */}
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        {editingFieldId === field._id ? (
                          <>
                            <button
                              onClick={() => handleSaveInlineEdit(field)}
                              className="p-1 border border-[#2ecc71]/20 bg-[#2ecc71]/10 text-[#2ecc71] hover:bg-[#2ecc71]/20 rounded transition-all"
                            >
                              <Check size={12} />
                            </button>
                            <button
                              onClick={() => setEditingFieldId(null)}
                              className="p-1 border border-[--border-strong] text-[--text-secondary] hover:text-[--text-primary] rounded transition-all bg-white"
                            >
                              <X size={12} />
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => handleStartEditSub(field)} // reuse parent start inline edit
                              className="p-1 border border-[--border-strong] text-[--text-secondary] hover:text-[--accent] rounded transition-all bg-white hover:bg-stone-50"
                            >
                              <Edit2 size={12} />
                            </button>
                            <button
                              onClick={() => handleDeleteField(field._id)}
                              className="p-1 border border-[--border-strong] text-[--text-secondary] hover:text-[#ff4d4d] rounded transition-all bg-white hover:bg-stone-50"
                            >
                              <Trash2 size={12} />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Slide-over field add configuration drawer panel */}
      {showAddDrawer && (
        <div className="fixed inset-0 z-50 flex justify-end bg-stone-900/40 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-white h-full shadow-2xl border-l border-[--border] flex flex-col justify-between">
            
            {/* Drawer Header */}
            <div className="p-6 border-b border-[--border] flex items-center justify-between bg-stone-50">
              <div>
                <h3 className="text-sm font-bold text-[--text-primary] uppercase tracking-wider">Configure Dynamic Field Schema</h3>
                <p className="text-xs text-[--text-secondary] mt-0.5">Define metadata constraints and mapping properties</p>
              </div>
              <button 
                onClick={() => setShowAddDrawer(false)}
                className="p-1.5 border border-[--border-strong] rounded-lg text-[--text-secondary] hover:text-[--text-primary] bg-white transition-all shadow-sm"
              >
                <X size={16} />
              </button>
            </div>

            {/* Scrollable Form Body */}
            <form onSubmit={handleAddField} className="flex-1 overflow-y-auto p-6 space-y-4 text-xs bg-white">
              
              <div className="grid grid-cols-2 gap-3">
                {/* 1. Label name */}
                <div className="flex flex-col gap-1.5">
                  <label className="font-bold text-[--text-secondary] uppercase">Display Label Name</label>
                  <input
                    type="text"
                    required
                    value={newLabel}
                    onChange={(e) => setNewLabel(e.target.value)}
                    className="bg-[--bg-input] border border-[--border-strong] rounded-lg px-3 py-2 text-[--text-primary] focus:outline-none focus:border-[--accent]"
                    placeholder="e.g. Employee Count"
                  />
                </div>

                {/* 2. Key machine identifier */}
                <div className="flex flex-col gap-1.5">
                  <label className="font-bold text-[--text-secondary] uppercase">Database Key Identifier</label>
                  <input
                    type="text"
                    required
                    readOnly
                    value={newKey}
                    className="bg-stone-50 border border-[--border] rounded-lg px-3 py-2 text-[--text-muted] font-mono outline-none cursor-not-allowed"
                    placeholder="employee_count"
                  />
                </div>
              </div>

              {/* 3. Field type selector */}
              <div className="flex flex-col gap-1.5">
                <label className="font-bold text-[--text-secondary] uppercase">Value Type Constraints</label>
                <select
                  value={newType}
                  onChange={(e) => setNewType(e.target.value)}
                  className="bg-[--bg-input] border border-[--border-strong] rounded-lg px-3 py-2 text-[--text-primary] focus:outline-none focus:border-[--accent]"
                >
                  <option value="text">Plain Text</option>
                  <option value="number">Number</option>
                  <option value="phone">Phone Number</option>
                  <option value="email">Email Address</option>
                  <option value="url">URL Hyperlink</option>
                  <option value="boolean">Boolean (Yes/No)</option>
                  <option value="select">Dropdown Choice Menu (Select)</option>
                  <option value="multiselect">Multi-select Menu</option>
                  <option value="date">Date picker</option>
                  <option value="textarea">Textarea Block</option>
                </select>
              </div>

              {/* Tag options for select / multiselect */}
              {(newType === 'select' || newType === 'multiselect') && (
                <div className="flex flex-col gap-1.5 bg-stone-50 p-3 rounded-lg border border-[--border]">
                  <label className="font-bold text-[--accent] uppercase">Comma-separated Options</label>
                  <input
                    type="text"
                    required
                    value={optionsText}
                    onChange={(e) => setOptionsText(e.target.value)}
                    className="bg-white border border-[--accent-border] rounded-lg px-3 py-2 text-[--text-primary] focus:outline-none focus:border-[--accent]"
                    placeholder="e.g. Small, Medium, Large"
                  />
                  <span className="text-[10px] text-[--text-secondary]">Input possible option values separated by commas.</span>
                </div>
              )}

              {/* Toggles checks layout grid */}
              <div className="grid grid-cols-2 gap-3 bg-stone-50 p-3 rounded-lg border border-[--border]">
                <label className="flex items-center gap-2 cursor-pointer select-none text-[--text-secondary] font-semibold">
                  <input
                    type="checkbox"
                    checked={newRequired}
                    onChange={(e) => setNewRequired(e.target.checked)}
                    className="rounded border-[--border-strong] bg-[--bg-input] text-[--accent] focus:ring-0 w-4 h-4"
                  />
                  <span>Is Required</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer select-none text-[--text-secondary] font-semibold">
                  <input
                    type="checkbox"
                    checked={newVisible}
                    onChange={(e) => setNewVisible(e.target.checked)}
                    className="rounded border-[--border-strong] bg-[--bg-input] text-[--accent] focus:ring-0 w-4 h-4"
                  />
                  <span>Is Form Visible</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer select-none text-[--text-secondary] font-semibold">
                  <input
                    type="checkbox"
                    checked={newIsTableColumn}
                    onChange={(e) => setNewIsTableColumn(e.target.checked)}
                    className="rounded border-[--border-strong] bg-[--bg-input] text-[--accent] focus:ring-0 w-4 h-4"
                  />
                  <span>Show in Leads Table</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer select-none text-[--text-secondary] font-semibold">
                  <input
                    type="checkbox"
                    checked={newIsCsvMapped}
                    onChange={(e) => setNewIsCsvMapped(e.target.checked)}
                    className="rounded border-[--border-strong] bg-[--bg-input] text-[--accent] focus:ring-0 w-4 h-4"
                  />
                  <span>Mapped to CSV Template</span>
                </label>
              </div>

              {/* CSV header override input */}
              {newIsCsvMapped && (
                <div className="flex flex-col gap-1.5">
                  <label className="font-bold text-[--text-secondary] uppercase">CSV Template Column Header</label>
                  <input
                    type="text"
                    required
                    value={newCsvHeader}
                    onChange={(e) => setNewCsvHeader(e.target.value)}
                    className="bg-[--bg-input] border border-[--border-strong] rounded-lg px-3 py-2 text-[--text-primary] focus:outline-none focus:border-[--accent]"
                    placeholder="Defaults to Display Label"
                  />
                </div>
              )}

              {/* Placeholder and Defaults */}
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="font-bold text-[--text-secondary] uppercase">Placeholder Text</label>
                  <input
                    type="text"
                    value={newPlaceholder}
                    onChange={(e) => setNewPlaceholder(e.target.value)}
                    className="bg-[--bg-input] border border-[--border-strong] rounded-lg px-3 py-2 text-[--text-primary] focus:outline-none"
                    placeholder="e.g. Enter employee count"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="font-bold text-[--text-secondary] uppercase">Default Value</label>
                  <input
                    type="text"
                    value={newDefaultValue}
                    onChange={(e) => setNewDefaultValue(e.target.value)}
                    className="bg-[--bg-input] border border-[--border-strong] rounded-lg px-3 py-2 text-[--text-primary] focus:outline-none"
                    placeholder="e.g. 10"
                  />
                </div>
              </div>

              {/* Advanced Validation regex constraints */}
              <div className="border border-[--border] bg-stone-50 p-3 rounded-lg space-y-3">
                <h4 className="font-bold text-[--text-primary] uppercase text-[10px] tracking-wider flex items-center gap-1.5">
                  <AlertTriangle size={12} className="text-amber-500" />
                  <span>Validation Regex Constraints (Optional)</span>
                </h4>
                
                <div className="grid grid-cols-2 gap-2">
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-[--text-secondary] uppercase">Javascript Regex Query</label>
                    <input
                      type="text"
                      value={newRegex}
                      onChange={(e) => setNewRegex(e.target.value)}
                      className="bg-white border border-[--border-strong] rounded px-2.5 py-1.5 text-[--text-primary] focus:outline-none font-mono"
                      placeholder="e.g. ^[0-9]{1,4}$"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-[--text-secondary] uppercase">Validation Error Msg</label>
                    <input
                      type="text"
                      value={newRegexMessage}
                      onChange={(e) => setNewRegexMessage(e.target.value)}
                      className="bg-white border border-[--border-strong] rounded px-2.5 py-1.5 text-[--text-primary] focus:outline-none"
                      placeholder="Must be number 1 to 9999"
                    />
                  </div>
                </div>
              </div>

              {/* Form Buttons */}
              <div className="flex justify-end gap-3 pt-4 border-t border-[--border] bg-white">
                <button
                  type="button"
                  onClick={() => setShowAddDrawer(false)}
                  className="px-4 py-2 border border-[--border-strong] rounded-lg text-[--text-secondary] hover:bg-stone-50 font-semibold text-xs transition-all bg-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingField}
                  className="px-4 py-2 bg-[--accent] text-white font-black uppercase text-xs rounded-lg hover:bg-[--accent-hover] transition-all flex items-center gap-1.5 shadow-sm"
                >
                  {savingField ? 'Saving...' : 'Save Configuration'}
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

    </div>
  );
};

export default AdminFieldsPage;
