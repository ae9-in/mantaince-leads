import { useState, useEffect, useCallback } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { 
  Plus, 
  Download, 
  Upload, 
  Edit, 
  Trash2, 
  Search, 
  Filter, 
  X, 
  AlertCircle,
  FileSpreadsheet,
  CheckCircle,
  Clock
} from 'lucide-react';

// Secure helper to read properties without prototype pollution vulnerability
const getSafeVal = (obj, key) => {
  if (!obj || typeof obj !== 'object') return undefined;
  if (key === '__proto__' || key === 'constructor' || key === 'prototype') return undefined;
  return obj[key];
};

// Secure helper to write properties without prototype pollution vulnerability
const setSafeVal = (obj, key, val) => {
  if (!obj || typeof obj !== 'object') return;
  if (key === '__proto__' || key === 'constructor' || key === 'prototype') return;
  obj[key] = val;
};

const LeadsView = () => {
  const { user } = useAuth();
  const { currentVertical } = useOutletContext();
  const isAdmin = user?.role === 'super_admin' || user?.role === 'vertical_admin';

  // Leads state
  const [leads, setLeads] = useState([]);
  const [totalLeads, setTotalLeads] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [limit] = useState(15);
  const [totalPages, setTotalPages] = useState(1);

  // Filter & Search states
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [subVerticalFilter, setSubVerticalFilter] = useState('');
  const [agentFilter, setAgentFilter] = useState('');

  // Config states for current vertical
  const [configs, setConfigs] = useState([]);
  const [subVerticals, setSubVerticals] = useState([]);
  const [agents, setAgents] = useState([]);

  // Modals state
  const [leadModalOpen, setLeadModalOpen] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState(null);

  // Form states
  const [leadForm, setLeadForm] = useState({
    name: '',
    phone: '',
    businessName: '',
    subVerticalId: '',
    assignedTo: '',
    status: 'new',
    data: {}
  });
  const [formErrors, setFormErrors] = useState([]);
  const [modalSubmitting, setModalSubmitting] = useState(false);

  // CSV upload state
  const [csvFile, setCsvFile] = useState(null);
  const [uploadingCsv, setUploadingCsv] = useState(false);
  const [csvLogs, setCsvLogs] = useState([]);
  const [uploadError, setUploadError] = useState(null);

  // Fetch leads based on filters
  const fetchLeads = useCallback(async () => {
    if (!currentVertical) return;
    setLoading(true);
    try {
      const qParams = new URLSearchParams({
        verticalId: currentVertical._id,
        page,
        limit,
        status: statusFilter,
        subVerticalId: subVerticalFilter,
        assignedTo: agentFilter,
        q: search
      });
      const data = await api(`/leads?${qParams.toString()}`);
      setLeads(data.leads);
      setTotalLeads(data.pagination.total);
      setTotalPages(data.pagination.pages);
    } catch (err) {
      console.error('Error fetching leads:', err.message);
    } finally {
      setLoading(false);
    }
  }, [currentVertical, page, limit, statusFilter, subVerticalFilter, agentFilter, search]);

  // Fetch reference metadata (configs, subverticals, agents)
  const fetchMetadata = useCallback(async () => {
    if (!currentVertical) return;
    try {
      // Fetch dynamic fields configs
      const fieldConfigs = await api(`/configs/verticals/${currentVertical._id}/configs`);
      setConfigs(fieldConfigs);

      // Fetch sub-verticals
      const subs = await api(`/verticals/${currentVertical._id}/subverticals`);
      setSubVerticals(subs.filter(s => s.isActive));

      // Fetch agents (retrieve users list and filter)
      if (isAdmin) {
        const usersList = await api('/users');
        setAgents(usersList.filter(u => u.isActive && (u.roleId?.name === 'agent' || u.roleId?.name === 'vertical_admin')));
      }
    } catch (err) {
      console.error('Error fetching metadata:', err.message);
    }
  }, [currentVertical, isAdmin]);

  // Fetch CSV upload history
  const fetchCsvLogs = useCallback(async () => {
    if (!currentVertical) return;
    try {
      const logs = await api(`/leads/import/logs?verticalId=${currentVertical._id}`);
      setCsvLogs(logs);
    } catch (err) {
      console.error('Error fetching CSV logs:', err.message);
    }
  }, [currentVertical]);

  // Trigger loading when active vertical changes
  useEffect(() => {
    setPage(1);
    fetchMetadata();
    if (isAdmin) {
      fetchCsvLogs();
    }
  }, [currentVertical, fetchMetadata, fetchCsvLogs, isAdmin]);

  // Trigger load when page/filters change
  useEffect(() => {
    fetchLeads();
  }, [fetchLeads]);

  // Polling for CSV logs if processing
  useEffect(() => {
    let interval = null;
    const hasProcessing = csvLogs.some(log => log.status === 'processing');
    if (hasProcessing && isAdmin) {
      interval = setInterval(() => {
        fetchCsvLogs();
        fetchLeads(); // refresh leads too
      }, 3000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [csvLogs, isAdmin, fetchCsvLogs, fetchLeads]);

  // Handle manual search form submit
  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setPage(1);
    fetchLeads();
  };

  // Open Add Lead modal
  const handleOpenAddModal = () => {
    setSelectedLead(null);
    setFormErrors([]);
    
    // Initialize blank form
    const defaultData = {};
    configs.forEach(c => {
      if (c.fieldType === 'boolean') setSafeVal(defaultData, c.fieldKey, false);
      else setSafeVal(defaultData, c.fieldKey, '');
    });

    setLeadForm({
      name: '',
      phone: '',
      businessName: '',
      subVerticalId: '',
      assignedTo: '',
      status: 'new',
      data: defaultData
    });
    setLeadModalOpen(true);
  };

  // Open Edit Lead modal
  const handleOpenEditModal = (lead) => {
    setSelectedLead(lead);
    setFormErrors([]);

    const leadData = lead.data || {};
    const populatedData = {};
    
    configs.forEach(c => {
      let val = getSafeVal(leadData, c.fieldKey);
      if (c.fieldType === 'date' && val) {
        val = new Date(val).toISOString().split('T')[0];
      }
      setSafeVal(populatedData, c.fieldKey, val !== undefined ? val : (c.fieldType === 'boolean' ? false : ''));
    });

    setLeadForm({
      name: lead.name || '',
      phone: lead.phone || '',
      businessName: lead.businessName || '',
      subVerticalId: lead.subVerticalId?._id || lead.subVerticalId || '',
      assignedTo: lead.assignedTo?._id || lead.assignedTo || '',
      status: lead.status || 'new',
      data: populatedData
    });
    setLeadModalOpen(true);
  };

  // Delete lead handler
  const handleDeleteLead = async (leadId) => {
    if (!window.confirm('Are you sure you want to delete this lead?')) return;
    try {
      await api(`/leads/${leadId}`, { method: 'DELETE' });
      setLeads(leads.filter(l => l._id !== leadId));
    } catch (err) {
      alert(`Delete failed: ${err.message}`);
    }
  };

  // Form input changes
  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setLeadForm(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleCustomFieldChange = (key, value, type) => {
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') return;
    setLeadForm(prev => {
      let val = value;
      if (type === 'boolean') val = value === true || value === 'true';
      const newData = { ...prev.data };
      setSafeVal(newData, key, val);
      return {
        ...prev,
        data: newData
      };
    });
  };

  // Submit Lead creation / edit
  const handleLeadSubmit = async (e) => {
    e.preventDefault();
    setFormErrors([]);
    setModalSubmitting(true);

    try {
      const payload = {
        ...leadForm,
        verticalId: currentVertical._id
      };

      // Sanitize keys: set empty values to null/undefined
      if (!payload.subVerticalId) delete payload.subVerticalId;
      if (!payload.assignedTo) delete payload.assignedTo;

      if (selectedLead) {
        // Edit lead
        await api(`/leads/${selectedLead._id}`, {
          method: 'PUT',
          body: JSON.stringify(payload)
        });
      } else {
        // Add lead
        await api('/leads', {
          method: 'POST',
          body: JSON.stringify(payload)
        });
      }

      setLeadModalOpen(false);
      fetchLeads();
    } catch (err) {
      setFormErrors([err.message]);
    } finally {
      setModalSubmitting(false);
    }
  };

  // Trigger CSV export
  const handleExportCsv = async () => {
    if (!currentVertical) return;
    try {
      const qParams = new URLSearchParams({
        verticalId: currentVertical._id,
        status: statusFilter,
        subVerticalId: subVerticalFilter,
        assignedTo: agentFilter,
        q: search
      });
      const csvData = await api(`/leads/export?${qParams.toString()}`);
      
      const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `leads-export-${currentVertical.slug}-${Date.now()}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      alert(`Export failed: ${err.message}`);
    }
  };

  // Submit CSV Import
  const handleCsvImportSubmit = async (e) => {
    e.preventDefault();
    if (!csvFile) {
      setUploadError('Please select a CSV file.');
      return;
    }

    setUploadError(null);
    setUploadingCsv(true);

    try {
      const formData = new FormData();
      formData.append('file', csvFile);
      formData.append('verticalId', currentVertical._id);

      await api('/leads/import', {
        method: 'POST',
        body: formData
      });

      setCsvFile(null);
      // Success alert
      alert('CSV file uploaded successfully. Processing will run in the background.');
      fetchCsvLogs();
      setImportModalOpen(false);
    } catch (err) {
      setUploadError(err.message);
    } finally {
      setUploadingCsv(false);
    }
  };

  const handleDownloadTemplate = () => {
    // Generate template CSV based on current configurations
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

    const baseExample = [
      'John Doe',
      '+1234567890',
      'Acme Corp',
      'Jane Smith',
      'Calls',
      'New',
      'Acme Corp Office',
      '2026-06-22',
      'https://maps.google.com/?q=12.345,67.890',
      'https://example.com/delivered/report123'
    ];

    const headers = [...baseHeaders];
    const exampleRow = [...baseExample];

    configs.forEach(c => {
      const header = c.isCsvMapped && c.csvHeader ? c.csvHeader : c.label;
      headers.push(header);
      if (c.fieldType === 'number') {
        exampleRow.push('123');
      } else if (c.fieldType === 'boolean') {
        exampleRow.push('True');
      } else if (c.fieldType === 'date') {
        exampleRow.push('2026-06-22');
      } else {
        exampleRow.push('Sample Value');
      }
    });

    const csvContent = [
      headers.map(h => `"${h.replace(/"/g, '""')}"`).join(','),
      exampleRow.map(v => `"${v.replace(/"/g, '""')}"`).join(',')
    ].join('\n') + '\n';

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `leads-template-${currentVertical?.slug}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!currentVertical) {
    return (
      <div className="page-loader">
        <p>No business vertical selected. Please check your admin configuration.</p>
      </div>
    );
  }

  return (
    <>
      <div className="content-header">
        <div>
          <h1>Leads Manager</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '4px' }}>
            Vertical: <strong>{currentVertical.name}</strong> • {totalLeads} total leads found
          </p>
        </div>

        <div className="content-header-actions">
          {isAdmin && (
            <button className="glow-button" onClick={handleOpenAddModal}>
              <Plus size={18} />
              <span>Add Lead</span>
            </button>
          )}
          <button className="glow-button" style={{ background: 'var(--bg-surface)' }} onClick={handleExportCsv}>
            <Download size={18} />
            <span>Export</span>
          </button>
          {isAdmin && (
            <button className="glow-button" style={{ background: 'var(--bg-surface)' }} onClick={() => setImportModalOpen(true)}>
              <Upload size={18} />
              <span>Import CSV</span>
            </button>
          )}
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="glass-panel" style={{ padding: '20px' }}>
        <form onSubmit={handleSearchSubmit} className="table-controls-bar">
          <div className="search-input-wrapper">
            <Search size={18} className="search-icon" />
            <input
              type="text"
              placeholder="Search leads..."
              className="form-control"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="filter-group">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Filter size={16} style={{ color: 'var(--text-muted)' }} />
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Filters:</span>
            </div>

            <select
              className="filter-select"
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            >
              <option value="">All Statuses</option>
              <option value="new">New</option>
              <option value="contacted">Contacted</option>
              <option value="converted">Converted</option>
              <option value="lost">Lost</option>
            </select>

            <select
              className="filter-select"
              value={subVerticalFilter}
              onChange={(e) => { setSubVerticalFilter(e.target.value); setPage(1); }}
            >
              <option value="">All Sub-Verticals</option>
              {subVerticals.map(s => (
                <option key={s._id} value={s._id}>{s.name}</option>
              ))}
            </select>

            {isAdmin && (
              <select
                className="filter-select"
                value={agentFilter}
                onChange={(e) => { setAgentFilter(e.target.value); setPage(1); }}
              >
                <option value="">All Agents</option>
                {agents.map(a => (
                  <option key={a._id} value={a._id}>{a.name}</option>
                ))}
              </select>
            )}

            {(statusFilter || subVerticalFilter || agentFilter || search) && (
              <button 
                type="button" 
                className="action-btn"
                style={{ padding: '8px 12px', background: 'rgba(255,255,255,0.05)', borderRadius: '8px' }}
                onClick={() => {
                  setSearch('');
                  setStatusFilter('');
                  setSubVerticalFilter('');
                  setAgentFilter('');
                  setPage(1);
                }}
              >
                Clear Filters
              </button>
            )}
          </div>
        </form>
      </div>

      {/* Main Table Panel */}
      <div className="glass-panel" style={{ padding: '0' }}>
        {loading ? (
          <div className="page-loader">
            <div className="spinner"></div>
          </div>
        ) : leads.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
            <FileSpreadsheet size={48} style={{ opacity: 0.25, marginBottom: '12px' }} />
            <p style={{ fontSize: '1.1rem' }}>No leads matching your search criteria were found.</p>
          </div>
        ) : (
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Phone</th>
                  <th>Business Name</th>
                  <th>Status</th>
                  <th>Sub-Vertical</th>
                  {isAdmin && <th>Agent</th>}
                  
                  {/* Custom configs headers */}
                  {configs.filter(c => c.isVisible).map(c => (
                    <th key={c._id}>{c.label}</th>
                  ))}

                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {leads.map(lead => (
                  <tr key={lead._id}>
                    <td style={{ fontWeight: 600 }}>{lead.name}</td>
                    <td>{lead.phone || '-'}</td>
                    <td>{lead.businessName || '-'}</td>
                    <td>
                      <span className={`status-pill ${lead.status}`}>
                        {lead.status}
                      </span>
                    </td>
                    <td>{lead.subVerticalId?.name || lead.subVerticalId || '-'}</td>
                    {isAdmin && <td>{lead.assignedTo?.name || <span style={{ color: 'var(--text-dim)', fontStyle: 'italic' }}>Unassigned</span>}</td>}
                    
                    {/* Custom fields values */}
                    {configs.filter(c => c.isVisible).map(c => {
                      const rawVal = getSafeVal(lead.data, c.fieldKey);
                      let formattedVal = '-';
                      
                      if (rawVal !== undefined && rawVal !== null && rawVal !== '') {
                        if (c.fieldType === 'boolean') {
                          formattedVal = rawVal ? 'Yes' : 'No';
                        } else if (c.fieldType === 'date') {
                          formattedVal = new Date(rawVal).toLocaleDateString();
                        } else if (c.fieldType === 'url') {
                          formattedVal = <a href={rawVal} target="_blank" rel="noopener noreferrer">Link</a>;
                        } else {
                          formattedVal = String(rawVal);
                        }
                      }

                      return <td key={c._id}>{formattedVal}</td>;
                    })}

                    <td>
                      <div className="actions-cell">
                        <button className="action-btn" onClick={() => handleOpenEditModal(lead)}>
                          <Edit size={16} />
                        </button>
                        {isAdmin && (
                          <button className="action-btn delete" onClick={() => handleDeleteLead(lead._id)}>
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="pagination-container">
          <span>Showing page <strong>{page}</strong> of <strong>{totalPages}</strong></span>
          <div className="pagination-buttons">
            <button 
              className="pagination-btn" 
              disabled={page <= 1} 
              onClick={() => setPage(prev => Math.max(1, prev - 1))}
            >
              Previous
            </button>
            <button 
              className="pagination-btn" 
              disabled={page >= totalPages} 
              onClick={() => setPage(prev => Math.min(totalPages, prev + 1))}
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Modal: Create or Edit Lead */}
      {leadModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content glass-panel">
            <div className="modal-header">
              <h2>{selectedLead ? 'Modify Lead Details' : 'Add New Lead'}</h2>
              <button className="action-btn" onClick={() => setLeadModalOpen(false)}>
                <X size={20} />
              </button>
            </div>

            {formErrors.length > 0 && (
              <div className="error-banner">
                <AlertCircle size={18} />
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  {formErrors.map((err, i) => <span key={i}>{err}</span>)}
                </div>
              </div>
            )}

            <form onSubmit={handleLeadSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Core fields */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div className="form-group">
                  <label htmlFor="lead-name">Customer Name *</label>
                  <input
                    type="text"
                    id="lead-name"
                    name="name"
                    className="form-control"
                    required
                    value={leadForm.name}
                    onChange={handleFormChange}
                    disabled={modalSubmitting}
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="lead-phone">Phone Number</label>
                  <input
                    type="text"
                    id="lead-phone"
                    name="phone"
                    className="form-control"
                    value={leadForm.phone}
                    onChange={handleFormChange}
                    disabled={modalSubmitting}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div className="form-group">
                  <label htmlFor="lead-business">Business Name</label>
                  <input
                    type="text"
                    id="lead-business"
                    name="businessName"
                    className="form-control"
                    value={leadForm.businessName}
                    onChange={handleFormChange}
                    disabled={modalSubmitting}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="lead-subvertical">Sub-Vertical</label>
                  <select
                    id="lead-subvertical"
                    name="subVerticalId"
                    className="form-control"
                    value={leadForm.subVerticalId}
                    onChange={handleFormChange}
                    disabled={modalSubmitting}
                  >
                    <option value="">Select Sub-Vertical</option>
                    {subVerticals.map(s => (
                      <option key={s._id} value={s._id}>{s.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div className="form-group">
                  <label htmlFor="lead-status">Lead Status</label>
                  <select
                    id="lead-status"
                    name="status"
                    className="form-control"
                    value={leadForm.status}
                    onChange={handleFormChange}
                    disabled={modalSubmitting}
                  >
                    <option value="new">New</option>
                    <option value="contacted">Contacted</option>
                    <option value="converted">Converted</option>
                    <option value="lost">Lost</option>
                  </select>
                </div>

                {isAdmin && (
                  <div className="form-group">
                    <label htmlFor="lead-agent">Assigned Agent</label>
                    <select
                      id="lead-agent"
                      name="assignedTo"
                      className="form-control"
                      value={leadForm.assignedTo}
                      onChange={handleFormChange}
                      disabled={modalSubmitting}
                    >
                      <option value="">Unassigned</option>
                      {agents.map(a => (
                        <option key={a._id} value={a._id}>{a.name} ({a.email})</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* Dynamic Field Configs form inputs */}
              {configs.length > 0 && (
                <>
                  <div style={{ borderTop: '1px solid var(--border-light)', paddingTop: '16px', marginTop: '8px' }}>
                    <h3 style={{ fontSize: '1rem', color: 'var(--text-muted)', marginBottom: '16px' }}>Custom Dynamic Fields</h3>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    {configs.map(c => {
                      const val = getSafeVal(leadForm.data, c.fieldKey) !== undefined ? getSafeVal(leadForm.data, c.fieldKey) : '';
                      
                      return (
                        <div key={c._id} className="form-group" style={{ gridColumn: c.fieldType === 'textarea' ? 'span 2' : 'auto' }}>
                          <label>{c.label} {c.isRequired ? '*' : ''}</label>
                          
                          {c.fieldType === 'select' ? (
                            <select
                              className="form-control"
                              value={val}
                              onChange={(e) => handleCustomFieldChange(c.fieldKey, e.target.value, c.fieldType)}
                              required={c.isRequired}
                              disabled={modalSubmitting}
                            >
                              <option value="">Select Option</option>
                              {c.options.map((opt, i) => (
                                <option key={i} value={opt}>{opt}</option>
                              ))}
                            </select>
                          ) : c.fieldType === 'boolean' ? (
                            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', padding: '10px 0' }}>
                              <input
                                type="checkbox"
                                checked={!!val}
                                onChange={(e) => handleCustomFieldChange(c.fieldKey, e.target.checked, c.fieldType)}
                                disabled={modalSubmitting}
                              />
                              <span>Check if active</span>
                            </label>
                          ) : c.fieldType === 'textarea' ? (
                            <textarea
                              className="form-control"
                              rows={3}
                              value={val}
                              onChange={(e) => handleCustomFieldChange(c.fieldKey, e.target.value, c.fieldType)}
                              required={c.isRequired}
                              disabled={modalSubmitting}
                            />
                          ) : (
                            <input
                              type={c.fieldType === 'number' ? 'number' : c.fieldType === 'date' ? 'date' : 'text'}
                              className="form-control"
                              value={val}
                              onChange={(e) => handleCustomFieldChange(c.fieldKey, e.target.value, c.fieldType)}
                              required={c.isRequired}
                              disabled={modalSubmitting}
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </>
              )}

              <div className="modal-footer">
                <button type="button" className="action-btn" style={{ padding: '10px 20px', borderRadius: '8px', border: '1px solid var(--border-light)' }} onClick={() => setLeadModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="glow-button" disabled={modalSubmitting}>
                  {modalSubmitting ? <span className="spinner" style={{ width: '18px', height: '18px' }}></span> : 'Save Details'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: CSV Upload */}
      {importModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content glass-panel" style={{ maxWidth: '640px' }}>
            <div className="modal-header">
              <h2>Bulk Lead CSV Import</h2>
              <button className="action-btn" onClick={() => setImportModalOpen(false)}>
                <X size={20} />
              </button>
            </div>

            {uploadError && (
              <div className="error-banner">
                <AlertCircle size={18} />
                <span>{uploadError}</span>
              </div>
            )}

            <form onSubmit={handleCsvImportSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                  CSV fields mapping matches configured dynamic keys.
                </span>
                <button type="button" className="action-btn" style={{ textDecoration: 'underline', color: 'var(--accent-secondary)' }} onClick={handleDownloadTemplate}>
                  Download Template
                </button>
              </div>

              <div 
                className="drag-drop-zone"
                onClick={() => document.getElementById('csv-file-input').click()}
              >
                <Upload size={32} />
                {csvFile ? (
                  <div>
                    <strong style={{ color: 'var(--text-main)' }}>{csvFile.name}</strong>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-dim)', marginTop: '4px' }}>
                      {(csvFile.size / 1024).toFixed(2)} KB
                    </p>
                  </div>
                ) : (
                  <div>
                    <strong>Select CSV file</strong>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-dim)', marginTop: '4px' }}>
                      Drag and drop here, or browse.
                    </p>
                  </div>
                )}
                <input 
                  type="file" 
                  id="csv-file-input" 
                  accept=".csv"
                  style={{ display: 'none' }}
                  onChange={(e) => setCsvFile(e.target.files[0])}
                />
              </div>

              <div className="modal-footer">
                <button 
                  type="button" 
                  className="action-btn" 
                  style={{ padding: '10px 20px', borderRadius: '8px', border: '1px solid var(--border-light)' }} 
                  onClick={() => { setCsvFile(null); setImportModalOpen(false); }}
                >
                  Cancel
                </button>
                <button type="submit" className="glow-button" disabled={uploadingCsv || !csvFile}>
                  {uploadingCsv ? <span className="spinner" style={{ width: '18px', height: '18px' }}></span> : 'Start Import'}
                </button>
              </div>
            </form>

            {/* CSV Import History logs in modal */}
            <div style={{ borderTop: '1px solid var(--border-light)', paddingTop: '20px', marginTop: '10px' }}>
              <h3 style={{ fontSize: '1rem', color: 'var(--text-muted)', marginBottom: '12px' }}>Recent Imports Progress</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '200px', overflowY: 'auto' }}>
                {csvLogs.length === 0 ? (
                  <p style={{ color: 'var(--text-dim)', fontSize: '0.85rem' }}>No upload logs found for this vertical.</p>
                ) : (
                  csvLogs.map(log => (
                    <div key={log._id} className="glass-panel" style={{ padding: '12px', background: 'rgba(0,0,0,0.15)', fontSize: '0.85rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                        <strong>{log.fileName}</strong>
                        <span style={{ 
                          display: 'inline-flex', 
                          alignItems: 'center', 
                          gap: '4px',
                          fontWeight: '600',
                          color: log.status === 'done' ? 'var(--color-success)' : log.status === 'failed' ? 'var(--color-danger)' : 'var(--color-warning)'
                        }}>
                          {log.status === 'done' ? <CheckCircle size={14} /> : log.status === 'failed' ? <AlertCircle size={14} /> : <Clock size={14} />}
                          {log.status.toUpperCase()}
                        </span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                        <span>Uploaded by: {log.uploadedBy?.name}</span>
                        <span>
                          Rows: {log.totalRows} • Success: {log.successCount} • Failed: {log.failedCount}
                        </span>
                      </div>
                      {log.errors && log.errors.length > 0 && (
                        <div style={{ marginTop: '8px', padding: '8px', background: 'rgba(239, 68, 68, 0.08)', borderLeft: '2px solid var(--color-danger)', borderRadius: '4px', color: 'hsl(355, 95%, 75%)', fontSize: '0.8rem' }}>
                          <strong>Import Errors:</strong>
                          <ul style={{ paddingLeft: '14px', marginTop: '4px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                            {log.errors.slice(0, 3).map((err, i) => (
                              <li key={i}>Row {err.row}: {err.reason}</li>
                            ))}
                            {log.errors.length > 3 && <li>...and {log.errors.length - 3} more errors</li>}
                          </ul>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default LeadsView;
