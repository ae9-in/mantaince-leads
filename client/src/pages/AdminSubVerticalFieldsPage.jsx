import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from '../api/axios.js';
import { 
  ArrowLeft, Plus, Check, X, Settings, ListPlus, Trash2, Edit2, 
  AlertTriangle, HelpCircle, ArrowUp, ArrowDown, ListFilter
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useUiStore } from '../store/uiStore.js';

export const AdminSubVerticalFieldsPage = () => {
  const { subVerticalId } = useParams();
  
  const [subVertical, setSubVertical] = useState(null);
  const [vertical, setVertical] = useState(null);
  const [fields, setFields] = useState([]);
  const [loading, setLoading] = useState(true);

  // Field Add Form Drawer state
  const [showAddDrawer, setShowAddDrawer] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const [newKey, setNewKey] = useState('');
  const [newType, setNewType] = useState('text');
  const [newRequired, setNewRequired] = useState(false);
  const [newPlaceholder, setNewPlaceholder] = useState('');
  const [optionsText, setOptionsText] = useState(''); // comma-separated values
  const [savingField, setSavingField] = useState(false);

  // Inline Editing row tracking
  const [editingFieldId, setEditingFieldId] = useState(null);
  const [editingLabel, setEditingLabel] = useState('');
  const [editingType, setEditingType] = useState('');
  const [editingPlaceholder, setEditingPlaceholder] = useState('');
  const [editingOptionsText, setEditingOptionsText] = useState('');

  const fetchFieldMetadata = async () => {
    setLoading(true);
    try {
      // 1. Fetch sub-vertical
      const subRes = await axios.get(`/api/v1/verticals/sub-verticals/${subVerticalId}`);
      const subObj = subRes.data.data;
      setSubVertical(subObj);

      // 2. Fetch vertical
      const vertId = subObj.verticalId || subObj.vertical_id;
      if (vertId) {
        const vertRes = await axios.get(`/api/v1/verticals/${vertId}`);
        setVertical(vertRes.data.data);
      }

      // 3. Fetch custom fields
      const fieldsRes = await axios.get(`/api/v1/admin/sub-verticals/${subVerticalId}/custom-fields`);
      setFields(fieldsRes.data.data);
    } catch (err) {
      toast.error('Failed to load sub-vertical custom fields configuration');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const { leadsRefreshTrigger } = useUiStore();

  useEffect(() => {
    if (subVerticalId) {
      fetchFieldMetadata();
    }
  }, [subVerticalId, leadsRefreshTrigger]);

  // Handle auto-generation of machine key from label
  useEffect(() => {
    if (!editingFieldId) {
      const key = newLabel
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/(^-|_$)/g, '');
      setNewKey(key);
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
      const res = await axios.post(`/api/v1/admin/sub-verticals/${subVerticalId}/custom-fields`, {
        fieldKey: newKey,
        label: newLabel,
        fieldType: newType,
        isRequired: newRequired,
        placeholder: newPlaceholder,
        options
      });

      toast.success('Custom field configured successfully!');
      setShowAddDrawer(false);
      
      // Reset state
      setNewLabel('');
      setNewKey('');
      setNewType('text');
      setNewRequired(false);
      setNewPlaceholder('');
      setOptionsText('');

      setFields([...fields, res.data.data]);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save custom field');
    } finally {
      setSavingField(false);
    }
  };

  const handleStartInlineEdit = (field) => {
    setEditingFieldId(field.id);
    setEditingLabel(field.label);
    setEditingType(field.field_type || field.fieldType);
    setEditingPlaceholder(field.placeholder || '');
    setEditingOptionsText(Array.isArray(field.options) ? field.options.join(', ') : '');
  };

  const handleSaveInlineEdit = async (field) => {
    const options = (editingType === 'select' || editingType === 'multiselect')
      ? editingOptionsText.split(',').map(o => o.trim()).filter(Boolean)
      : [];

    try {
      const res = await axios.patch(`/api/v1/admin/custom-fields/${field.id}`, {
        label: editingLabel,
        fieldType: editingType,
        placeholder: editingPlaceholder,
        options
      });
      toast.success('Field configuration updated');
      setFields(fields.map(f => f.id === field.id ? res.data.data : f));
      setEditingFieldId(null);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update field');
    }
  };

  const handleToggleRequired = async (field) => {
    try {
      const res = await axios.patch(`/api/v1/admin/custom-fields/${field.id}`, {
        isRequired: !field.is_required
      });
      setFields(fields.map(f => f.id === field.id ? res.data.data : f));
      toast.success('Required setting updated');
    } catch {
      toast.error('Failed to change required setting');
    }
  };

  const handleToggleActive = async (field) => {
    try {
      const res = await axios.patch(`/api/v1/admin/custom-fields/${field.id}`, {
        isActive: field.is_active === false ? true : false
      });
      setFields(fields.map(f => f.id === field.id ? res.data.data : f));
      toast.success('Active status updated');
    } catch {
      toast.error('Failed to change active status');
    }
  };

  const handleDeleteField = async (field) => {
    if (window.confirm(`Are you sure you want to delete the field "${field.label}"?\nAll values stored for leads under this sub-vertical will be permanently deleted.`)) {
      try {
        await axios.delete(`/api/v1/admin/custom-fields/${field.id}`);
        toast.success('Field configuration deleted');
        setFields(fields.filter(f => f.id !== field.id));
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
    const temp = list[index];
    list[index] = list[nextIndex];
    list[nextIndex] = temp;

    setFields(list);

    try {
      await axios.patch(`/api/v1/admin/sub-verticals/${subVerticalId}/custom-fields/reorder`, {
        orderedIds: list.map(f => f.id)
      });
      toast.success('Field display order rearranged');
    } catch (err) {
      toast.error('Failed to save fields order');
      // reload from server on failure
      const fieldsRes = await axios.get(`/api/v1/admin/sub-verticals/${subVerticalId}/custom-fields`);
      setFields(fieldsRes.data.data);
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Breadcrumbs and Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[--border] pb-4">
        <div className="flex items-center gap-3">
          <Link
            to="/admin/verticals"
            className="p-1.5 border border-[--border-strong] rounded-lg text-[--text-secondary] hover:text-[--text-primary] transition-all hover:bg-stone-50 bg-white"
          >
            <ArrowLeft size={16} />
          </Link>
          <div>
            <h2 className="text-xl font-black text-[--text-primary] uppercase tracking-wider">Configure Custom Fields</h2>
            <p className="text-xs text-[--text-secondary] mt-0.5">
              Category: <strong className="text-[--accent]">{subVertical?.name}</strong> ({vertical?.name})
            </p>
          </div>
        </div>

        <button
          onClick={() => setShowAddDrawer(true)}
          className="flex items-center gap-1.5 px-3.5 py-2 bg-[--accent] text-white font-black uppercase text-xs rounded-lg hover:bg-[--accent-hover] transition-all shadow-md font-sans"
        >
          <Plus size={14} />
          <span>Add Custom Field</span>
        </button>
      </div>

      {/* Main Table Section list */}
      <div className="glass-panel border border-[--border] bg-white overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="border-b border-[--border-strong] bg-stone-50 text-xs font-bold text-[--text-secondary] uppercase select-none tracking-wider font-sans">
                <th className="px-4 py-4 w-12 text-center">Order</th>
                <th className="px-6 py-4">Display Label</th>
                <th className="px-6 py-4">Database key</th>
                <th className="px-6 py-4">Value type</th>
                <th className="px-6 py-4">Placeholder</th>
                <th className="px-4 py-4 text-center">Required</th>
                <th className="px-4 py-4 text-center">Status</th>
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
                    <td className="px-6 py-4"><div className="h-4 bg-stone-100 rounded w-24"></div></td>
                    <td className="px-4 py-4"><div className="h-4 bg-stone-100 rounded w-8 mx-auto"></div></td>
                    <td className="px-6 py-4"><div className="h-8 bg-stone-100 rounded w-12 ml-auto"></div></td>
                  </tr>
                ))
              ) : fields.length === 0 ? (
                <tr>
                  <td colSpan="7" className="text-center py-12 text-[--text-secondary] text-xs">
                    No custom fields mapped. Click Add Custom Field to introduce data parameters.
                  </td>
                </tr>
              ) : (
                fields.map((field, idx) => (
                  <tr key={field.id} className="hover:bg-stone-50/50 transition-all">
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
                      {editingFieldId === field.id ? (
                        <input
                          type="text"
                          value={editingLabel}
                          onChange={(e) => setEditingLabel(e.target.value)}
                          className="bg-[--bg-input] border border-[--accent-border] rounded px-2 py-1 text-[--text-primary] text-xs focus:outline-none w-full max-w-[150px]"
                        />
                      ) : (
                        <span>{field.label}</span>
                      )}
                    </td>

                    {/* Database Key machine identifier */}
                    <td className="px-6 py-4 font-mono text-[--text-secondary]">
                      {field.field_key}
                    </td>

                    {/* Field Value type edit inline */}
                    <td className="px-6 py-4">
                      {editingFieldId === field.id ? (
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
                        <div className="flex flex-col gap-1 items-start">
                          <span className="capitalize px-2 py-0.5 bg-stone-100 rounded text-[10px] text-[--text-secondary] font-semibold border border-stone-200">
                            {field.field_type}
                          </span>
                          {Array.isArray(field.options) && field.options.length > 0 && (
                            <div className="flex flex-wrap gap-1 max-w-[200px] mt-1">
                              {field.options.map((opt, oIdx) => (
                                <span key={oIdx} className="bg-stone-50 border border-[--border] px-1 py-0.5 rounded text-[8px] text-[--text-muted] font-mono">
                                  {opt}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </td>

                    {/* Placeholder input editable inline */}
                    <td className="px-6 py-4 text-[--text-secondary]">
                      {editingFieldId === field.id ? (
                        <input
                          type="text"
                          value={editingPlaceholder}
                          onChange={(e) => setEditingPlaceholder(e.target.value)}
                          className="bg-[--bg-input] border border-[--accent-border] rounded px-2 py-1 text-[--text-primary] text-xs focus:outline-none w-full max-w-[150px]"
                          placeholder="Placeholder"
                        />
                      ) : (
                        <span>{field.placeholder || <span className="text-[--text-muted] italic">None</span>}</span>
                      )}
                    </td>

                    {/* Required flag toggle switch */}
                    <td className="px-4 py-4 text-center">
                      <input
                        type="checkbox"
                        checked={field.is_required}
                        onChange={() => handleToggleRequired(field)}
                        className="rounded border-[--border-strong] bg-[--bg-input] text-[--accent] focus:ring-0 w-4 h-4 cursor-pointer"
                      />
                    </td>

                    {/* Status flag toggle switch */}
                    <td className="px-4 py-4 text-center">
                      <input
                        type="checkbox"
                        checked={field.is_active !== false}
                        onChange={() => handleToggleActive(field)}
                        className="rounded border-[--border-strong] bg-[--bg-input] text-[--accent] focus:ring-0 w-4 h-4 cursor-pointer"
                      />
                    </td>

                    {/* Action buttons */}
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        {editingFieldId === field.id ? (
                          <div className="flex flex-col gap-1.5 items-end">
                            <div className="flex gap-2">
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
                            </div>
                            {(editingType === 'select' || editingType === 'multiselect') && (
                              <input
                                type="text"
                                value={editingOptionsText}
                                onChange={(e) => setEditingOptionsText(e.target.value)}
                                className="bg-[--bg-input] border border-[--accent-border] rounded px-2 py-0.5 text-[10px] text-[--text-primary] focus:outline-none w-44"
                                placeholder="Edit options (comma separated)"
                              />
                            )}
                          </div>
                        ) : (
                          <>
                            <button
                              onClick={() => handleStartInlineEdit(field)}
                              className="p-1 border border-[--border-strong] text-[--text-secondary] hover:text-[--accent] rounded transition-all bg-white hover:bg-stone-50"
                            >
                              <Edit2 size={12} />
                            </button>
                            <button
                              onClick={() => handleDeleteField(field)}
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
                <h3 className="text-sm font-bold text-[--text-primary] uppercase tracking-wider">Configure Custom Field</h3>
                <p className="text-xs text-[--text-secondary] mt-0.5">Define custom metadata parameter constraints</p>
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
                {/* Label name */}
                <div className="flex flex-col gap-1.5">
                  <label className="font-bold text-[--text-secondary] uppercase">Display Label Name</label>
                  <input
                    type="text"
                    required
                    value={newLabel}
                    onChange={(e) => setNewLabel(e.target.value)}
                    className="bg-[--bg-input] border border-[--border-strong] rounded-lg px-3 py-2 text-[--text-primary] focus:outline-none focus:border-[--accent]"
                    placeholder="e.g. Size SqFt"
                  />
                </div>

                {/* Key machine identifier */}
                <div className="flex flex-col gap-1.5">
                  <label className="font-bold text-[--text-secondary] uppercase">Database Key Identifier</label>
                  <input
                    type="text"
                    required
                    readOnly
                    value={newKey}
                    className="bg-stone-50 border border-[--border] rounded-lg px-3 py-2 text-[--text-muted] font-mono outline-none cursor-not-allowed"
                    placeholder="size_sqft"
                  />
                </div>
              </div>

              {/* Field type selector */}
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
                    placeholder="e.g. 1BHK, 2BHK, 3BHK"
                  />
                  <span className="text-[10px] text-[--text-secondary]">Input possible option values separated by commas.</span>
                </div>
              )}

              {/* Required field checkbox toggle */}
              <div className="bg-stone-50 p-3 rounded-lg border border-[--border]">
                <label className="flex items-center gap-2 cursor-pointer select-none text-[--text-secondary] font-semibold">
                  <input
                    type="checkbox"
                    checked={newRequired}
                    onChange={(e) => setNewRequired(e.target.checked)}
                    className="rounded border-[--border-strong] bg-[--bg-input] text-[--accent] focus:ring-0 w-4 h-4"
                  />
                  <span>Is Required Field (Fills validation check)</span>
                </label>
              </div>

              {/* Placeholder text */}
              <div className="flex flex-col gap-1.5">
                <label className="font-bold text-[--text-secondary] uppercase">Placeholder Text</label>
                <input
                  type="text"
                  value={newPlaceholder}
                  onChange={(e) => setNewPlaceholder(e.target.value)}
                  className="bg-[--bg-input] border border-[--border-strong] rounded-lg px-3 py-2 text-[--text-primary] focus:outline-none focus:border-[--accent]"
                  placeholder="e.g. Enter area in square feet"
                />
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

export default AdminSubVerticalFieldsPage;
