import { useState, useEffect, useCallback } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { 
  Plus, 
  Edit, 
  Trash2, 
  X, 
  AlertCircle,
  Settings,
  ListPlus,
  Sliders,
  Check,
  EyeOff,
  Eye
} from 'lucide-react';

const VerticalConfigsView = () => {
  const { user } = useAuth();
  const { currentVertical, verticals, reloadVerticals } = useOutletContext();
  const isSuperAdmin = user?.role === 'super_admin';

  // SubVerticals state
  const [subVerticals, setSubVerticals] = useState([]);
  const [loadingSubs, setLoadingSubs] = useState(true);
  const [newSubName, setNewSubName] = useState('');
  const [subSubmitting, setSubSubmitting] = useState(false);

  // FieldConfigs state
  const [configs, setConfigs] = useState([]);
  const [loadingConfigs, setLoadingConfigs] = useState(true);
  const [fieldModalOpen, setFieldModalOpen] = useState(false);
  const [selectedField, setSelectedField] = useState(null);

  // Vertical CRUD state (Super Admin only)
  const [verticalModalOpen, setVerticalModalOpen] = useState(false);
  const [selectedVertical, setSelectedVertical] = useState(null);
  const [verticalForm, setVerticalForm] = useState({
    name: '',
    description: ''
  });
  const [verticalSubmitting, setVerticalSubmitting] = useState(false);

  // Field Config Form state
  const [fieldForm, setFieldForm] = useState({
    fieldKey: '',
    label: '',
    fieldType: 'text',
    optionsText: '', // text version of select options separated by comma
    isRequired: false,
    isCsvMapped: false,
    csvHeader: '',
    displayOrder: 0,
    isVisible: true
  });
  const [fieldErrors, setFieldErrors] = useState([]);
  const [fieldSubmitting, setFieldSubmitting] = useState(false);

  // Load sub-verticals and field configs
  const fetchData = useCallback(async () => {
    if (!currentVertical) return;
    setLoadingSubs(true);
    setLoadingConfigs(true);
    try {
      const [subsList, configsList] = await Promise.all([
        api(`/verticals/${currentVertical._id}/subverticals`),
        api(`/configs/verticals/${currentVertical._id}/configs`)
      ]);
      setSubVerticals(subsList);
      setConfigs(configsList);
    } catch (err) {
      console.error('Error loading config metadata:', err.message);
    } finally {
      setLoadingSubs(false);
      setLoadingConfigs(false);
    }
  }, [currentVertical]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Create subvertical
  const handleCreateSub = async (e) => {
    e.preventDefault();
    if (!newSubName.trim()) return;
    setSubSubmitting(true);
    try {
      const sub = await api(`/verticals/${currentVertical._id}/subverticals`, {
        method: 'POST',
        body: JSON.stringify({ name: newSubName })
      });
      setSubVerticals(prev => [...prev, sub].sort((a,b) => a.name.localeCompare(b.name)));
      setNewSubName('');
    } catch (err) {
      alert(`Sub-vertical creation failed: ${err.message}`);
    } finally {
      setSubSubmitting(false);
    }
  };

  // Toggle subvertical status
  const handleToggleSubStatus = async (sub) => {
    try {
      const updated = await api(`/verticals/subverticals/${sub._id}`, {
        method: 'PUT',
        body: JSON.stringify({ isActive: !sub.isActive })
      });
      setSubVerticals(prev => prev.map(s => s._id === sub._id ? updated : s));
    } catch (err) {
      alert(`Status update failed: ${err.message}`);
    }
  };

  // Open add/edit field config modal
  const handleOpenFieldModal = (field = null) => {
    setSelectedField(field);
    setFieldErrors([]);

    if (field) {
      setFieldForm({
        fieldKey: field.fieldKey,
        label: field.label,
        fieldType: field.fieldType,
        optionsText: field.options?.join(', ') || '',
        isRequired: field.isRequired,
        isCsvMapped: field.isCsvMapped,
        csvHeader: field.csvHeader || '',
        displayOrder: field.displayOrder,
        isVisible: field.isVisible !== undefined ? field.isVisible : true
      });
    } else {
      setFieldForm({
        fieldKey: '',
        label: '',
        fieldType: 'text',
        optionsText: '',
        isRequired: false,
        isCsvMapped: false,
        csvHeader: '',
        displayOrder: configs.length,
        isVisible: true
      });
    }
    setFieldModalOpen(true);
  };

  // Delete field config
  const handleDeleteField = async (fieldId) => {
    if (!window.confirm('Are you sure you want to delete this custom field? This will stop displaying data for this key on existing leads.')) return;
    try {
      await api(`/configs/${fieldId}`, { method: 'DELETE' });
      setConfigs(prev => prev.filter(c => c._id !== fieldId));
    } catch (err) {
      alert(`Delete failed: ${err.message}`);
    }
  };

  // Submit field config form
  const handleFieldSubmit = async (e) => {
    e.preventDefault();
    setFieldErrors([]);
    setFieldSubmitting(true);

    try {
      // Split options text by comma
      const options = fieldForm.optionsText
        ? fieldForm.optionsText.split(',').map(s => s.trim()).filter(s => s.length > 0)
        : [];

      const payload = {
        ...fieldForm,
        options,
        verticalId: currentVertical._id
      };

      if (selectedField) {
        payload.id = selectedField._id;
      }

      await api(`/configs/verticals/${currentVertical._id}/configs`, {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      setFieldModalOpen(false);
      fetchData();
    } catch (err) {
      setFieldErrors([err.message]);
    } finally {
      setFieldSubmitting(false);
    }
  };

  // Open Vertical Modal (Super Admin only)
  const handleOpenVerticalModal = (vert = null) => {
    setSelectedVertical(vert);
    if (vert) {
      setVerticalForm({ name: vert.name, description: vert.description || '' });
    } else {
      setVerticalForm({ name: '', description: '' });
    }
    setVerticalModalOpen(true);
  };

  // Submit Vertical CRUD (Super Admin only)
  const handleVerticalSubmit = async (e) => {
    e.preventDefault();
    if (!verticalForm.name.trim()) return;
    setVerticalSubmitting(true);
    try {
      if (selectedVertical) {
        await api(`/verticals/${selectedVertical._id}`, {
          method: 'PUT',
          body: JSON.stringify(verticalForm)
        });
      } else {
        await api('/verticals', {
          method: 'POST',
          body: JSON.stringify(verticalForm)
        });
      }
      setVerticalModalOpen(false);
      reloadVerticals(); // trigger update in shell dropdown
    } catch (err) {
      alert(`Vertical operation failed: ${err.message}`);
    } finally {
      setVerticalSubmitting(false);
    }
  };

  const handleToggleVerticalStatus = async (vert) => {
    try {
      await api(`/verticals/${vert._id}`, {
        method: 'PUT',
        body: JSON.stringify({ isActive: !vert.isActive })
      });
      reloadVerticals();
    } catch (err) {
      alert(`Failed to update status: ${err.message}`);
    }
  };

  if (!currentVertical) {
    return (
      <div className="page-loader">
        <p>No business vertical selected. Please check your configuration.</p>
      </div>
    );
  }

  return (
    <>
      <div className="content-header">
        <div>
          <h1>Workspace Settings</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '4px' }}>
            Configure fields and structural definitions for <strong>{currentVertical.name}</strong>
          </p>
        </div>

        {isSuperAdmin && (
          <div className="content-header-actions">
            <button className="glow-button" onClick={() => handleOpenVerticalModal()}>
              <Plus size={18} />
              <span>Create Vertical</span>
            </button>
            <button className="glow-button" style={{ background: 'var(--bg-surface)' }} onClick={() => handleOpenVerticalModal(currentVertical)}>
              <Edit size={18} />
              <span>Edit Vertical</span>
            </button>
          </div>
        )}
      </div>

      {/* Super Admin Vertical Overview Summary Card */}
      {isSuperAdmin && (
        <div className="glass-panel" style={{ padding: '20px' }}>
          <h3 style={{ fontSize: '1rem', color: 'var(--text-muted)', marginBottom: '12px' }}>System Verticals Overview (Super Admin)</h3>
          <div className="badge-list" style={{ gap: '12px' }}>
            {verticals.map(v => (
              <div 
                key={v._id} 
                className="glass-panel" 
                style={{ 
                  padding: '10px 16px', 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '12px',
                  background: v._id === currentVertical._id ? 'var(--border-focus)' : 'rgba(255,255,255,0.03)',
                  border: v._id === currentVertical._id ? '1px solid var(--accent-primary)' : 'var(--glass-border)'
                }}
              >
                <div>
                  <strong style={{ display: 'block', fontSize: '0.9rem' }}>{v.name}</strong>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>slug: {v.slug}</span>
                </div>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button 
                    className="action-btn" 
                    title="Edit name/description" 
                    onClick={() => handleOpenVerticalModal(v)}
                    style={{ padding: '4px' }}
                  >
                    <Edit size={14} />
                  </button>
                  <button 
                    className="action-btn" 
                    title={v.isActive ? 'Deactivate' : 'Activate'}
                    onClick={() => handleToggleVerticalStatus(v)}
                    style={{ padding: '4px', color: v.isActive ? 'var(--color-success)' : 'var(--text-dim)' }}
                  >
                    {v.isActive ? <Check size={14} /> : <X size={14} />}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Two Column Layout: SubVerticals and Custom Fields */}
      <div className="dashboard-grid" style={{ gridTemplateColumns: '1fr 2fr' }}>
        
        {/* Column 1: Sub-Verticals List */}
        <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ListPlus size={20} style={{ color: 'var(--accent-secondary)' }} />
            <h2 style={{ fontSize: '1.2rem' }}>Sub-Verticals</h2>
          </div>

          <form onSubmit={handleCreateSub} style={{ display: 'flex', gap: '8px' }}>
            <input
              type="text"
              className="form-control"
              placeholder="New Sub-vertical name"
              required
              value={newSubName}
              onChange={(e) => setNewSubName(e.target.value)}
              disabled={subSubmitting}
              style={{ flexGrow: 1 }}
            />
            <button type="submit" className="glow-button" style={{ padding: '10px 14px' }} disabled={subSubmitting || !newSubName.trim()}>
              <Plus size={16} />
            </button>
          </form>

          {loadingSubs ? (
            <div style={{ textAlign: 'center', padding: '20px 0' }}><span className="spinner"></span></div>
          ) : subVerticals.length === 0 ? (
            <p style={{ color: 'var(--text-dim)', fontStyle: 'italic', fontSize: '0.9rem' }}>No sub-verticals created yet.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '400px', overflowY: 'auto' }}>
              {subVerticals.map(sub => (
                <div 
                  key={sub._id} 
                  className="glass-panel" 
                  style={{ 
                    padding: '12px 16px', 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center',
                    background: sub.isActive ? 'rgba(0,0,0,0.15)' : 'rgba(239, 68, 68, 0.05)',
                    opacity: sub.isActive ? 1 : 0.6
                  }}
                >
                  <div>
                    <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{sub.name}</span>
                    <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-dim)' }}>slug: {sub.slug}</span>
                  </div>
                  
                  <button 
                    className="action-btn"
                    onClick={() => handleToggleSubStatus(sub)}
                    style={{ color: sub.isActive ? 'var(--color-success)' : 'var(--text-dim)' }}
                    title={sub.isActive ? 'Deactivate sub-vertical' : 'Activate sub-vertical'}
                  >
                    {sub.isActive ? <Check size={16} /> : <X size={16} />}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Column 2: Custom Field Configs List */}
        <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Sliders size={20} style={{ color: 'var(--accent-primary)' }} />
              <h2 style={{ fontSize: '1.2rem' }}>Dynamic Field configurations</h2>
            </div>
            <button className="glow-button" style={{ padding: '8px 16px', fontSize: '0.85rem' }} onClick={() => handleOpenFieldModal()}>
              <Plus size={16} />
              <span>Add Field Config</span>
            </button>
          </div>

          {loadingConfigs ? (
            <div style={{ textAlign: 'center', padding: '40px 0' }}><span className="spinner"></span></div>
          ) : configs.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
              <Settings size={36} style={{ opacity: 0.15, marginBottom: '8px' }} />
              <p>No custom fields configured for this vertical yet.</p>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-dim)', marginTop: '4px' }}>Click Add Field Config to declare dynamic lead parameters.</p>
            </div>
          ) : (
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Display Order</th>
                    <th>Label</th>
                    <th>Key</th>
                    <th>Type</th>
                    <th>Required</th>
                    <th>CSV Header</th>
                    <th>Visible</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {configs.map(field => (
                    <tr key={field._id}>
                      <td style={{ textAlign: 'center', fontWeight: 600 }}>{field.displayOrder}</td>
                      <td style={{ fontWeight: 600 }}>{field.label}</td>
                      <td style={{ fontFamily: 'monospace', fontSize: '0.8rem', color: 'var(--accent-secondary)' }}>{field.fieldKey}</td>
                      <td>
                        <span className="role-badge agent">{field.fieldType}</span>
                      </td>
                      <td>
                        {field.isRequired ? (
                          <span style={{ color: 'var(--color-danger)', fontWeight: 600, fontSize: '0.85rem' }}>YES</span>
                        ) : (
                          <span style={{ color: 'var(--text-dim)' }}>Optional</span>
                        )}
                      </td>
                      <td style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                        {field.isCsvMapped ? (
                          <span style={{ fontFamily: 'monospace' }}>{field.csvHeader || field.label}</span>
                        ) : (
                          <span style={{ color: 'var(--text-dim)', fontStyle: 'italic' }}>Not mapped</span>
                        )}
                      </td>
                      <td>
                        {field.isVisible !== false ? (
                          <span style={{ color: 'var(--color-success)', display: 'flex', alignContent: 'center' }}><Eye size={16} /></span>
                        ) : (
                          <span style={{ color: 'var(--text-dim)', display: 'flex', alignContent: 'center' }}><EyeOff size={16} /></span>
                        )}
                      </td>
                      <td>
                        <div className="actions-cell">
                          <button className="action-btn" onClick={() => handleOpenFieldModal(field)}>
                            <Edit size={14} />
                          </button>
                          <button className="action-btn delete" onClick={() => handleDeleteField(field._id)}>
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>

      {/* Modal: Create/Update Field Config */}
      {fieldModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content glass-panel">
            <div className="modal-header">
              <h2>{selectedField ? 'Edit Field Configuration' : 'Add Custom Field'}</h2>
              <button className="action-btn" onClick={() => setFieldModalOpen(false)}>
                <X size={20} />
              </button>
            </div>

            {fieldErrors.length > 0 && (
              <div className="error-banner">
                <AlertCircle size={18} />
                <span>{fieldErrors[0]}</span>
              </div>
            )}

            <form onSubmit={handleFieldSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="form-group">
                <label htmlFor="field-label">Field Label * (e.g. Budget size, City)</label>
                <input
                  type="text"
                  id="field-label"
                  className="form-control"
                  required
                  placeholder="e.g. Budget Size"
                  value={fieldForm.label}
                  onChange={(e) => {
                    const l = e.target.value;
                    // Auto-fill fieldKey if not editing
                    setFieldForm(prev => ({
                      ...prev,
                      label: l,
                      fieldKey: selectedField ? prev.fieldKey : l.toLowerCase().replace(/[^a-z0-9_]/g, '')
                    }));
                  }}
                  disabled={fieldSubmitting}
                />
              </div>

              <div className="form-group">
                <label htmlFor="field-key">Field Identifier Key * (unique lowercase string, e.g. budget_size)</label>
                <input
                  type="text"
                  id="field-key"
                  className="form-control"
                  required
                  placeholder="e.g. budget_size"
                  value={fieldForm.fieldKey}
                  onChange={(e) => setFieldForm(prev => ({ ...prev, fieldKey: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '') }))}
                  disabled={fieldSubmitting || !!selectedField} // Lock key on update
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div className="form-group">
                  <label htmlFor="field-type">Field Type *</label>
                  <select
                    id="field-type"
                    className="form-control"
                    value={fieldForm.fieldType}
                    onChange={(e) => setFieldForm(prev => ({ ...prev, fieldType: e.target.value }))}
                    disabled={fieldSubmitting}
                  >
                    <option value="text">Short Text</option>
                    <option value="number">Number</option>
                    <option value="select">Dropdown Select</option>
                    <option value="boolean">Boolean Checkbox</option>
                    <option value="date">Date</option>
                    <option value="url">URL Link</option>
                    <option value="textarea">Paragraph Textarea</option>
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="field-order">Display Position Order</label>
                  <input
                    type="number"
                    id="field-order"
                    className="form-control"
                    value={fieldForm.displayOrder}
                    onChange={(e) => setFieldForm(prev => ({ ...prev, displayOrder: parseInt(e.target.value, 10) }))}
                    disabled={fieldSubmitting}
                  />
                </div>
              </div>

              {/* Options for dropdown select */}
              {fieldForm.fieldType === 'select' && (
                <div className="form-group">
                  <label htmlFor="field-options">Select Dropdown Options (comma-separated list)</label>
                  <textarea
                    id="field-options"
                    className="form-control"
                    rows={2}
                    placeholder="e.g. Seattle, New York, Miami"
                    required
                    value={fieldForm.optionsText}
                    onChange={(e) => setFieldForm(prev => ({ ...prev, optionsText: e.target.value }))}
                    disabled={fieldSubmitting}
                  />
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', padding: '10px 0' }}>
                  <input
                    type="checkbox"
                    checked={fieldForm.isRequired}
                    onChange={(e) => setFieldForm(prev => ({ ...prev, isRequired: e.target.checked }))}
                    disabled={fieldSubmitting}
                  />
                  <span>Is Required Field</span>
                </label>

                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', padding: '10px 0' }}>
                  <input
                    type="checkbox"
                    checked={fieldForm.isVisible}
                    onChange={(e) => setFieldForm(prev => ({ ...prev, isVisible: e.target.checked }))}
                    disabled={fieldSubmitting}
                  />
                  <span>Show Column in Table</span>
                </label>
              </div>

              <div style={{ borderTop: '1px solid var(--border-light)', paddingTop: '16px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', marginBottom: '12px' }}>
                  <input
                    type="checkbox"
                    checked={fieldForm.isCsvMapped}
                    onChange={(e) => setFieldForm(prev => ({ ...prev, isCsvMapped: e.target.checked }))}
                    disabled={fieldSubmitting}
                  />
                  <strong>Enable CSV File Mapping</strong>
                </label>

                {fieldForm.isCsvMapped && (
                  <div className="form-group">
                    <label htmlFor="field-csv-header">CSV File Header Key (e.g. "Estimated Budget", defaults to Label if empty)</label>
                    <input
                      type="text"
                      id="field-csv-header"
                      className="form-control"
                      placeholder={fieldForm.label || 'CSV column header'}
                      value={fieldForm.csvHeader}
                      onChange={(e) => setFieldForm(prev => ({ ...prev, csvHeader: e.target.value }))}
                      disabled={fieldSubmitting}
                    />
                  </div>
                )}
              </div>

              <div className="modal-footer">
                <button type="button" className="action-btn" style={{ padding: '10px 20px', borderRadius: '8px', border: '1px solid var(--border-light)' }} onClick={() => setFieldModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="glow-button" disabled={fieldSubmitting}>
                  {fieldSubmitting ? <span className="spinner" style={{ width: '18px', height: '18px' }}></span> : 'Save Config'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Create/Edit Vertical (Super Admin only) */}
      {verticalModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content glass-panel">
            <div className="modal-header">
              <h2>{selectedVertical ? 'Edit Business Vertical' : 'Create Business Vertical'}</h2>
              <button className="action-btn" onClick={() => setVerticalModalOpen(false)}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleVerticalSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="form-group">
                <label htmlFor="vert-name">Vertical Name *</label>
                <input
                  type="text"
                  id="vert-name"
                  className="form-control"
                  required
                  placeholder="e.g. Real Estate, Healthcare"
                  value={verticalForm.name}
                  onChange={(e) => setVerticalForm(prev => ({ ...prev, name: e.target.value }))}
                  disabled={verticalSubmitting}
                />
              </div>

              <div className="form-group">
                <label htmlFor="vert-desc">Description</label>
                <textarea
                  id="vert-desc"
                  className="form-control"
                  rows={3}
                  placeholder="Brief description of this business segment..."
                  value={verticalForm.description}
                  onChange={(e) => setVerticalForm(prev => ({ ...prev, description: e.target.value }))}
                  disabled={verticalSubmitting}
                />
              </div>

              <div className="modal-footer">
                <button type="button" className="action-btn" style={{ padding: '10px 20px', borderRadius: '8px', border: '1px solid var(--border-light)' }} onClick={() => setVerticalModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="glow-button" disabled={verticalSubmitting || !verticalForm.name.trim()}>
                  {verticalSubmitting ? <span className="spinner" style={{ width: '18px', height: '18px' }}></span> : 'Save Vertical'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};

export default VerticalConfigsView;
