import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { 
  ArrowLeft, Edit3, Save, X, User as UserIcon, Calendar, CheckSquare, Briefcase, ChevronRight
} from 'lucide-react';
import axios from '../api/axios.js';
import StatusBadge from '../components/StatusBadge.jsx';
import AuditTimeline from '../components/AuditTimeline.jsx';
import DynamicFieldRenderer from '../components/DynamicFieldRenderer.jsx';
import toast from 'react-hot-toast';

const BASE_DYNAMIC_FIELDS = [
  { key: 'nameBusiness', label: 'Name Business', type: 'text' },
  { key: 'date', label: 'Date', type: 'date' },
  { key: 'employeeSpoken', label: 'Employee Spoken', type: 'text' },
  { key: 'convertedStatus', label: 'Converted Status', type: 'text' },
  { key: 'deliveredLocation', label: 'Delivered Location', type: 'text' },
  { key: 'deliveredLink', label: 'Delivered Link', type: 'url' },
];

const BASE_DYNAMIC_FIELD_KEYS = new Set(BASE_DYNAMIC_FIELDS.map((field) => field.key));

const formatDateInputValue = (value) => {
  if (!value) return '';
  try {
    return new Date(value).toISOString().split('T')[0];
  } catch {
    return '';
  }
};

export const LeadDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [lead, setLead] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);

  // Metadata dropdown lists
  const [configs, setConfigs] = useState([]);
  const [subVerticals, setSubVerticals] = useState([]);
  const [agents, setAgents] = useState([]);

  // React Hook Form initialization
  const { register, handleSubmit, control, reset, formState: { errors, isSubmitting } } = useForm();

  // Load Lead details
  const fetchLeadDetail = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`/api/v1/leads/${id}`);
      const leadData = response.data.data;
      setLead(leadData);
      
      // Load dropdowns based on vertical
      const [configsRes, subsRes, usersRes] = await Promise.all([
        axios.get(`/api/v1/configs/verticals/${leadData.verticalId._id}/fields`),
        axios.get(`/api/v1/verticals/${leadData.verticalId._id}/sub-verticals`),
        axios.get('/api/v1/users')
      ]);

      setConfigs(configsRes.data.data);
      setSubVerticals(subsRes.data.data.filter(s => s.isActive));
      setAgents(usersRes.data.data.filter(u => u.isActive && (u.roleId?.name === 'agent' || u.roleId?.name === 'vertical_admin')));

      // Prepopulate form fields
      reset({
        name: leadData.name,
        phone: leadData.phone || '',
        businessName: leadData.businessName || '',
        status: leadData.status,
        subVerticalId: leadData.subVerticalId?._id || leadData.subVerticalId || '',
        assignedTo: leadData.assignedTo?._id || leadData.assignedTo || '',
        data: leadData.data ? {
          ...leadData.data,
          date: formatDateInputValue(leadData.data.date),
        } : {}
      });
    } catch (err) {
      console.error('Error fetching lead details:', err);
      toast.error('Failed to load lead details.');
      navigate('/leads');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeadDetail();
  }, [id]);

  const onSubmit = async (formData) => {
    try {
      const payload = {
        name: formData.name,
        phone: formData.phone,
        businessName: formData.businessName,
        subVerticalId: formData.subVerticalId || null,
        assignedTo: formData.assignedTo || null,
        status: formData.status,
        data: formData.data
      };

      const response = await axios.patch(`/api/v1/leads/${id}`, payload);
      setLead(response.data.data);
      setEditMode(false);
      toast.success('Lead updated successfully.');
      fetchLeadDetail(); // refresh timeline history
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update lead settings.');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="spinner"></div>
      </div>
    );
  }

  if (!lead) return null;

  const customConfigs = configs.filter((config) => !BASE_DYNAMIC_FIELD_KEYS.has(config.fieldKey));

  // Allowed status transition flags checks
  const allowedTransitions = (() => {
    const curr = lead.status;
    if (curr === 'converted') return []; // terminal

    const base = [curr];
    if (curr === 'new') return [...base, 'contacted', 'invalid'];
    if (curr === 'contacted') return [...base, 'converted', 'lost', 'new'];
    if (curr === 'lost' || curr === 'invalid') return [...base, 'new'];
    return base;
  })();

  return (
    <div className="space-y-6">
      
      {/* Header bar */}
      <div className="flex items-center justify-between">
        <button 
          onClick={() => navigate('/leads')} 
          className="flex items-center gap-1.5 text-xs text-[--text-secondary] hover:text-[--accent] transition-all uppercase tracking-wider"
        >
          <ArrowLeft size={16} />
          <span>Back to manager</span>
        </button>

        {!editMode ? (
          <button 
            onClick={() => setEditMode(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-[--accent] text-white rounded-lg text-sm font-bold transition-all hover:bg-[--accent-hover] shadow-sm"
          >
            <Edit3 size={16} />
            <span>Edit Profile</span>
          </button>
        ) : (
          <div className="flex gap-2">
            <button 
              onClick={() => { setEditMode(false); fetchLeadDetail(); }}
              className="flex items-center gap-1.5 px-4 py-2 border border-[--border-strong] hover:bg-stone-50 rounded-lg text-sm text-[--text-secondary] font-semibold bg-white shadow-sm"
            >
              <X size={16} />
              <span>Cancel</span>
            </button>
          </div>
        )}
      </div>

      {/* Two Column Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column: Form Details Card */}
        <form onSubmit={handleSubmit(onSubmit)} className="lg:col-span-2 space-y-6">
          <div className="glass-panel p-6 bg-white border border-[--border] shadow-sm space-y-6">
            <div className="flex justify-between items-start border-b border-[--border] pb-4">
              <div>
                <h1 className="text-xl font-bold text-[--text-primary]">{editMode ? 'Edit Lead Profile' : lead.name}</h1>
                <p className="text-xs text-[--text-secondary] mt-1 font-mono">ID: {lead._id}</p>
              </div>
              <div>
                <StatusBadge status={lead.status} />
              </div>
            </div>

            {/* Base Fields Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-[--text-secondary] uppercase">Full Name</label>
                {editMode ? (
                  <input type="text" {...register('name', { required: 'Name is required' })} />
                ) : (
                  <span className="text-sm text-[--text-primary] py-2 font-semibold">{lead.name}</span>
                )}
                {errors.name && <span className="text-red-500 text-xs font-semibold">{errors.name.message}</span>}
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-[--text-secondary] uppercase">Phone Number</label>
                {editMode ? (
                  <input type="text" {...register('phone')} />
                ) : (
                  <span className="text-sm text-[--text-primary] py-2">{lead.phone || '-'}</span>
                )}
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-[--text-secondary] uppercase">Business/Organization</label>
                {editMode ? (
                  <input type="text" {...register('businessName')} />
                ) : (
                  <span className="text-sm text-[--text-primary] py-2">{lead.businessName || '-'}</span>
                )}
              </div>

              {BASE_DYNAMIC_FIELDS.map((field) => (
                <div key={field.key} className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-[--text-secondary] uppercase">{field.label}</label>
                  {editMode ? (
                    <input
                      type={field.type === 'date' ? 'date' : field.type === 'url' ? 'url' : 'text'}
                      {...register(`data.${field.key}`)}
                    />
                  ) : field.type === 'url' && lead.data?.[field.key] ? (
                    <a href={lead.data[field.key]} target="_blank" rel="noreferrer" className="text-sm text-[--accent] py-2 hover:underline">
                      {lead.data[field.key]}
                    </a>
                  ) : (
                    <span className="text-sm text-[--text-primary] py-2">
                      {field.type === 'date'
                        ? (lead.data?.[field.key] ? new Date(lead.data[field.key]).toLocaleDateString() : '-')
                        : (lead.data?.[field.key] || '-')}
                    </span>
                  )}
                </div>
              ))}

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-[--text-secondary] uppercase">Classification Segment</label>
                {editMode ? (
                  <select {...register('subVerticalId')}>
                    <option value="">-- Choose Sub-vertical --</option>
                    {subVerticals.map(sub => (
                      <option key={sub._id} value={sub._id}>{sub.name}</option>
                    ))}
                  </select>
                ) : (
                  <div className="flex items-center gap-1.5 py-2 text-sm text-[--text-primary]">
                    <Briefcase size={14} className="text-[--accent]" />
                    <span>{lead.subVerticalId?.name || 'Unclassified'}</span>
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-[--text-secondary] uppercase">Assigned Operator</label>
                {editMode ? (
                  <select {...register('assignedTo')}>
                    <option value="">-- Unassigned --</option>
                    {agents.map(ag => (
                      <option key={ag._id} value={ag._id}>{ag.name}</option>
                    ))}
                  </select>
                ) : (
                  <div className="flex items-center gap-1.5 py-2 text-sm text-[--text-primary]">
                    <UserIcon size={14} className="text-[--accent]" />
                    <span>{lead.assignedTo?.name || 'Unassigned'}</span>
                  </div>
                )}
              </div>

              {/* Status transition picker inside Form */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-[--text-secondary] uppercase">Life-Cycle Status</label>
                {editMode ? (
                  <select {...register('status')}>
                    {allowedTransitions.map(st => (
                      <option key={st} value={st}>{st.toUpperCase()}</option>
                    ))}
                  </select>
                ) : (
                  <div className="py-1">
                    <StatusBadge status={lead.status} />
                  </div>
                )}
              </div>
            </div>

            {/* Dynamic Custom configs Field components */}
            {customConfigs.length > 0 && (
              <div className="border-t border-[--border] pt-6 space-y-4">
                <span className="block text-xs font-black text-[--text-secondary] uppercase tracking-wider">Custom Fields</span>
                <DynamicFieldRenderer
                  fields={customConfigs}
                  mode={editMode ? 'edit' : 'view'}
                  control={control}
                  errors={errors}
                  values={lead.data || {}}
                />
              </div>
            )}

            {/* Form Save Button */}
            {editMode && (
              <div className="flex justify-end pt-4 border-t border-[--border-strong]">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex items-center gap-1.5 px-6 py-2.5 bg-[--accent] text-white font-black uppercase tracking-wider rounded-lg text-sm transition-all hover:bg-[--accent-hover] shadow-sm"
                >
                  <Save size={16} />
                  <span>Save Changes</span>
                </button>
              </div>
            )}
          </div>
        </form>

        {/* Right Column: Activity Timeline and Info Panels */}
        <div className="space-y-6">
          
          <div className="glass-panel p-6 bg-white border border-[--border] shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-[--text-primary] uppercase tracking-wider border-b border-[--border] pb-2 flex items-center gap-2">
              <Calendar size={16} className="text-[--accent]" /> Metadata History
            </h3>
            
            <div className="space-y-2.5 text-xs text-[--text-secondary] font-mono">
              <div className="flex justify-between">
                <span>Created At:</span>
                <span className="text-[--text-primary]">{new Date(lead.createdAt).toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span>Created By:</span>
                <span className="text-[--text-primary]">{lead.uploadedBy?.name || 'Bulk upload seeder'}</span>
              </div>
              <div className="flex justify-between">
                <span>Upload Source:</span>
                <span className="text-[--text-primary] uppercase">{lead.source}</span>
              </div>
            </div>
          </div>

          <div className="glass-panel p-6 bg-white border border-[--border] shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-[--text-primary] uppercase tracking-wider border-b border-[--border] pb-2">
              Activity History Log
            </h3>
            <AuditTimeline targetId={id} />
          </div>

        </div>

      </div>
    </div>
  );
};

export default LeadDetailPage;
