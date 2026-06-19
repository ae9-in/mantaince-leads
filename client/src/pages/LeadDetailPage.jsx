import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useForm, Controller } from 'react-hook-form';
import { 
  ArrowLeft, Edit3, Save, X, User as UserIcon, Calendar, CheckSquare, Briefcase, 
  MapPin, Camera, Upload, CheckCircle2, PlusCircle, Clock, ClipboardList, Trash2,
  ExternalLink, MessageSquare, AlertTriangle, Settings, HelpCircle
} from 'lucide-react';
import axios from '../api/axios.js';
import StatusBadge from '../components/StatusBadge.jsx';
import AuditTimeline from '../components/AuditTimeline.jsx';
import toast from 'react-hot-toast';
import exifr from 'exifr';
import { useUiStore } from '../store/uiStore.js';

export const LeadDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { leadsRefreshTrigger } = useUiStore();

  const [lead, setLead] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [verticalInfo, setVerticalInfo] = useState(null);

  // Metadata dropdown lists
  const [subVerticals, setSubVerticals] = useState([]);
  const [agents, setAgents] = useState([]);
  
  // Sub-vertical specific custom fields and stages
  const [customFields, setCustomFields] = useState([]);
  const [stages, setStages] = useState([]);
  const [subVerticalUsers, setSubVerticalUsers] = useState([]);

  // Follow-ups state
  const [followUps, setFollowUps] = useState([]);
  const [followUpSummary, setFollowUpSummary] = useState(null);
  const [showScheduleForm, setShowScheduleForm] = useState(false);
  const [completingFollowUpId, setCompletingFollowUpId] = useState(null);
  const [completedNote, setCompletedNote] = useState('');

  // Geotagging manual coordinate overrides
  const [capturingGps, setCapturingGps] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  // React Hook Form initialization
  const { register, handleSubmit, control, reset, setValue, watch, formState: { errors, isSubmitting } } = useForm();
  
  const watchedSubVerticalId = watch('subVerticalId');

  // Load Lead details and taxonomy metadata
  const fetchLeadDetail = async (shouldResetForm = true) => {
    try {
      const response = await axios.get(`/api/v1/leads/${id}`);
      const leadData = response.data.data;
      setLead(leadData);
      
      // Load dropdowns based on vertical
      const [vertRes, subsRes, usersRes] = await Promise.all([
        axios.get(`/api/v1/verticals/${leadData.vertical_id}`),
        axios.get(`/api/v1/verticals/${leadData.vertical_id}/sub-verticals`),
        axios.get('/api/v1/users')
      ]);

      setVerticalInfo(vertRes.data.data);
      setSubVerticals(subsRes.data.data.filter(s => s.isActive));
      setAgents(usersRes.data.data.filter(u => u.is_active && (u.role_name === 'agent' || u.role_name === 'vertical_admin')));

      // Load sub-vertical specific configs if assigned
      const subId = leadData.sub_vertical_id;
      if (subId) {
        const [fieldsRes, stagesRes, subUsersRes] = await Promise.all([
          axios.get(`/api/v1/admin/sub-verticals/${subId}/custom-fields`),
          axios.get(`/api/v1/admin/sub-verticals/${subId}/stages`),
          axios.get(`/api/v1/admin/sub-verticals/${subId}/users`)
        ]);
        setCustomFields((fieldsRes.data.data || []).filter(f => f.is_active !== false));
        setStages(stagesRes.data.data);
        setSubVerticalUsers(subUsersRes.data.data);
      } else {
        setCustomFields([]);
        setStages([]);
        setSubVerticalUsers([]);
      }

      // Load follow ups
      const [followUpsRes, summaryRes] = await Promise.all([
        axios.get(`/api/v1/followUps/leads/${id}/follow-ups`),
        axios.get(`/api/v1/followUps/leads/${id}/follow-ups/summary`)
      ]);
      setFollowUps(followUpsRes.data.data || []);
      setFollowUpSummary(summaryRes.data.data || null);

      if (shouldResetForm) {
        // Prepopulate form fields
        reset({
          name: leadData.name,
          phone: leadData.phone || '',
          businessName: leadData.business_name || leadData.businessName || '',
          status: leadData.status,
          subVerticalId: leadData.sub_vertical_id || '',
          assignedTo: leadData.assigned_to || '',
          leadType: leadData.lead_type || 'CALL',
          customValues: leadData.customValues || {},
          data: leadData.data || {}
        });
      }
    } catch (err) {
      console.error('Error fetching lead details:', err);
      toast.error('Failed to load lead details.');
      navigate('/leads');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    fetchLeadDetail(true);
  }, [id]);

  useEffect(() => {
    if (leadsRefreshTrigger > 0) {
      fetchLeadDetail(false);
    }
  }, [leadsRefreshTrigger]);

  useEffect(() => {
    if (!loading && lead && window.location.hash === '#follow-ups') {
      setTimeout(() => {
        const el = document.getElementById('follow-ups-section');
        if (el) {
          el.scrollIntoView({ behavior: 'smooth' });
          el.classList.add('ring-2', 'ring-[--accent]', 'ring-offset-2');
          setTimeout(() => {
            el.classList.remove('ring-2', 'ring-[--accent]', 'ring-offset-2');
          }, 2000);
        }
      }, 300);
    }
  }, [loading, lead]);

  // Load custom fields/stages dynamically if sub-vertical changes in edit mode
  useEffect(() => {
    const loadSubVerticalConfigs = async () => {
      if (watchedSubVerticalId && editMode) {
        try {
          const [fieldsRes, stagesRes, subUsersRes] = await Promise.all([
            axios.get(`/api/v1/admin/sub-verticals/${watchedSubVerticalId}/custom-fields`),
            axios.get(`/api/v1/admin/sub-verticals/${watchedSubVerticalId}/stages`),
            axios.get(`/api/v1/admin/sub-verticals/${watchedSubVerticalId}/users`)
          ]);
          setCustomFields((fieldsRes.data.data || []).filter(f => f.is_active !== false));
          setStages(stagesRes.data.data);
          setSubVerticalUsers(subUsersRes.data.data);
        } catch (err) {
          console.error(err);
        }
      }
    };
    loadSubVerticalConfigs();
  }, [watchedSubVerticalId, editMode]);

  const onSubmit = async (formData) => {
    try {
      const payload = {
        name: formData.name,
        phone: formData.phone,
        businessName: formData.businessName,
        subVerticalId: formData.subVerticalId || null,
        assignedTo: formData.assignedTo || null,
        status: formData.status,
        leadType: formData.leadType || 'CALL',
        customValues: formData.customValues || {},
        data: formData.data
      };

      const response = await axios.patch(`/api/v1/leads/${id}`, payload);
      setLead(response.data.data);
      setEditMode(false);
      toast.success('Lead details updated successfully.');
      fetchLeadDetail(false);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update lead settings.');
    }
  };

  // Capture GPS Location
  const handleCaptureGps = () => {
    if (!navigator.geolocation) {
      toast.error('Geolocation is not supported by your browser');
      return;
    }

    setCapturingGps(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
          const accuracy = position.coords.accuracy;

          await axios.patch(`/api/v1/leads/${id}`, {
            geotagLat: lat,
            geotagLng: lng,
            geotagAccuracy: accuracy,
            geotagCapturedAt: new Date().toISOString()
          });

          toast.success('GPS coordinates captured successfully!');
          fetchLeadDetail(false);
        } catch (err) {
          toast.error('Failed to save GPS coordinates.');
        } finally {
          setCapturingGps(false);
        }
      },
      (error) => {
        toast.error(`Error capturing coordinates: ${error.message}`);
        setCapturingGps(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  // Handle photo upload + EXIF GPS extraction
  const handlePhotoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploadingPhoto(true);
    try {
      // 1. Attempt to extract GPS coordinates via exifr
      let lat = null, lng = null;
      try {
        const output = await exifr.gps(file);
        if (output && output.latitude && output.longitude) {
          lat = output.latitude;
          lng = output.longitude;
          toast.success('Extracted GPS coordinates from image metadata!');
        }
      } catch (exifErr) {
        console.log('No EXIF GPS metadata found in this photo.', exifErr);
      }

      // 2. Upload file to server
      const formData = new FormData();
      formData.append('photo', file);
      const uploadRes = await axios.post(`/api/v1/leads/${id}/photo`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      // 3. If EXIF had GPS coordinates, update them on the lead as well
      if (lat && lng) {
        await axios.patch(`/api/v1/leads/${id}`, {
          geotagLat: lat,
          geotagLng: lng,
          geotagCapturedAt: new Date().toISOString()
        });
      }

      toast.success('Field photo uploaded successfully.');
      fetchLeadDetail(false);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to upload photo.');
    } finally {
      setUploadingPhoto(false);
    }
  };

  // Schedule new follow-up
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleDesc, setScheduleDesc] = useState('');
  const [scheduleAgentId, setScheduleAgentId] = useState('');
  const [scheduling, setScheduling] = useState(false);

  const handleCreateFollowUp = async (e) => {
    e.preventDefault();
    if (!scheduleDate || !scheduleDesc || !scheduleAgentId) {
      toast.error('Please fill in all scheduling fields.');
      return;
    }

    setScheduling(true);
    try {
      await axios.post(`/api/v1/followUps/leads/${id}/follow-ups`, {
        assignedToId: scheduleAgentId,
        followUpDate: new Date(scheduleDate).toISOString(),
        description: scheduleDesc
      });
      toast.success('Follow-up scheduled successfully!');
      setShowScheduleForm(false);
      setScheduleDate('');
      setScheduleDesc('');
      setScheduleAgentId('');
      fetchLeadDetail(false);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to schedule follow-up');
    } finally {
      setScheduling(false);
    }
  };

  const handleCompleteFollowUp = async (e, fId) => {
    e.preventDefault();
    if (!completedNote.trim()) {
      toast.error('Please write a completion note summary.');
      return;
    }

    try {
      await axios.put(`/api/v1/followUps/follow-ups/${fId}`, {
        status: 'COMPLETED',
        completedNote
      });
      toast.success('Follow-up marked completed.');
      setCompletingFollowUpId(null);
      setCompletedNote('');
      fetchLeadDetail(false);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to complete follow-up');
    }
  };

  const handleDeleteFollowUp = async (fId) => {
    if (!window.confirm('Are you sure you want to cancel this scheduled check-in?')) return;
    try {
      await axios.delete(`/api/v1/followUps/follow-ups/${fId}`);
      toast.success('Follow-up canceled.');
      fetchLeadDetail(false);
    } catch (err) {
      toast.error('Failed to cancel check-in');
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

  // Allowed status transition flags checks
  const allowedTransitions = (() => {
    if (verticalInfo?.statuses && verticalInfo.statuses.length > 0) {
      return verticalInfo.statuses;
    }
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
      
      {/* Header Bar */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate('/leads')} 
            className="flex items-center gap-1.5 text-xs text-[--text-secondary] hover:text-[--accent] transition-all uppercase tracking-wider bg-transparent border-0 outline-none cursor-pointer"
          >
            <ArrowLeft size={16} />
            <span>Back to manager</span>
          </button>
          
          <button 
            type="button"
            onClick={() => {
              const el = document.getElementById('follow-ups-section');
              if (el) {
                el.scrollIntoView({ behavior: 'smooth' });
                el.classList.add('ring-2', 'ring-[--accent]', 'ring-offset-2');
                setTimeout(() => {
                  el.classList.remove('ring-2', 'ring-[--accent]', 'ring-offset-2');
                }, 2000);
              }
            }}
            className="flex items-center gap-1.5 text-xs text-[--accent] hover:text-[--accent-hover] transition-all uppercase tracking-wider bg-transparent border-0 outline-none cursor-pointer font-bold"
          >
            <Calendar size={14} />
            <span>Follow-up Leads</span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          {!editMode ? (
            <button 
              onClick={() => setEditMode(true)}
              className="flex items-center gap-1.5 px-4 py-2 bg-[--accent] text-white rounded-lg text-sm font-bold transition-all hover:bg-[--accent-hover] shadow-sm cursor-pointer"
            >
              <Edit3 size={16} />
              <span>Edit Profile</span>
            </button>
          ) : (
            <div className="flex gap-2">
              <button 
                onClick={() => { setEditMode(false); fetchLeadDetail(true); }}
                className="flex items-center gap-1.5 px-4 py-2 border border-[--border-strong] hover:bg-stone-50 rounded-lg text-sm text-[--text-secondary] font-semibold bg-white shadow-sm cursor-pointer"
              >
                <X size={16} />
                <span>Cancel</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Two Column Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column: Form Details Card */}
        <form onSubmit={handleSubmit(onSubmit)} className="lg:col-span-2 space-y-6">
          <div className="glass-panel p-6 bg-white border border-[--border] shadow-sm space-y-6">
            <div className="flex justify-between items-start border-b border-[--border] pb-4">
              <div>
                <h1 className="text-xl font-bold text-[--text-primary]">{editMode ? 'Edit Lead Profile' : lead.name}</h1>
                <p className="text-xs text-[--text-secondary] mt-1 font-mono">ID: {lead.id}</p>
              <div className="flex items-center gap-2">
              </div>
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
                  <span className="text-sm text-[--text-primary] py-2">{lead.business_name || lead.businessName || '-'}</span>
                )}
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-[--text-secondary] uppercase">Lead Contact Type</label>
                {editMode ? (
                  <select {...register('leadType')}>
                    <option value="CALL">Call Inquiry (Remote)</option>
                    <option value="FIELD">Field Visit (On-Site)</option>
                  </select>
                ) : (
                  <span className="text-sm text-[--text-primary] py-2 font-semibold flex items-center gap-1">
                    {lead.lead_type === 'FIELD' ? (
                      <span className="px-2 py-0.5 bg-sky-50 text-sky-600 border border-sky-200 text-[10px] rounded uppercase font-bold">
                        FIELD VISIT
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 bg-stone-100 text-stone-600 border border-stone-200 text-[10px] rounded uppercase font-bold">
                        CALL INQUIRY
                      </span>
                    )}
                  </span>
                )}
              </div>

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
                    <span>{lead.sv_name || 'Unclassified'}</span>
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-[--text-secondary] uppercase">Employee Spoken</label>
                {editMode ? (
                  <select {...register('assignedTo')}>
                    <option value="">-- Unassigned --</option>
                    {(watchedSubVerticalId ? subVerticalUsers : agents).map(ag => (
                      <option key={ag.id} value={ag.id}>{ag.name}</option>
                    ))}
                  </select>
                ) : (
                  <div className="flex items-center gap-1.5 py-2 text-sm text-[--text-primary]">
                    <UserIcon size={14} className="text-[--accent]" />
                    <span>{lead.assignee_name || 'Unassigned'}</span>
                  </div>
                )}
              </div>

              {/* Lead Stage inside edit form */}
              {editMode && stages.length > 0 && (
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-[--text-secondary] uppercase">Lead Stage</label>
                  <select {...register('stageId')}>
                    <option value="">-- None --</option>
                    {stages.map(st => (
                      <option key={st.id} value={st.id}>{st.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Status transition picker inside Form */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-[--text-secondary] uppercase">Life-Cycle Status</label>
                {editMode ? (
                  <select {...register('status')}>
                    {allowedTransitions.map(st => (
                      <option key={st.value || st} value={st.value || st}>
                        {(st.label || st).toUpperCase()}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="py-1">
                    <StatusBadge status={lead.status} />
                  </div>
                )}
              </div>
            </div>

            {/* Custom fields section (F3) */}
            {customFields.length > 0 && (
              <div className="border-t border-[--border] pt-6 space-y-4">
                <h4 className="text-xs font-black text-[--text-secondary] uppercase tracking-wider">Sub-Vertical Specific Custom Fields</h4>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {customFields.map(field => {
                    const error = errors.customValues?.[field.field_key];

                    return (
                      <div key={field.id} className="flex flex-col gap-1.5">
                        <label className="text-xs font-bold text-[--text-secondary] uppercase">
                          {field.label} {field.is_required && <span className="text-red-500">*</span>}
                        </label>

                        {!editMode ? (
                          <div className="bg-stone-50 border border-[--border] rounded-lg px-3 py-2 text-xs text-[--text-primary] min-h-[36px] flex items-center">
                            {lead.customValues?.[field.field_key] !== undefined && lead.customValues?.[field.field_key] !== '' ? (
                              <span>{String(lead.customValues[field.field_key])}</span>
                            ) : (
                              <span className="text-[--text-muted] italic">Not Filled</span>
                            )}
                          </div>
                        ) : (
                          <div>
                            {field.field_type === 'select' ? (
                              <select 
                                {...register(`customValues.${field.field_key}`, { required: field.is_required ? 'Required field' : false })}
                              >
                                <option value="">-- Choose Option --</option>
                                {field.options?.map(opt => (
                                  <option key={opt} value={opt}>{opt}</option>
                                ))}
                              </select>
                            ) : field.field_type === 'multiselect' ? (
                              // Custom Multi-select checkboxes
                              <Controller
                                control={control}
                                name={`customValues.${field.field_key}`}
                                defaultValue={lead.customValues?.[field.field_key] ? String(lead.customValues[field.field_key]).split(',').map(s => s.trim()) : []}
                                rules={{ required: field.is_required ? 'Required field' : false }}
                                render={({ field: { value = [], onChange } }) => {
                                  const listVal = Array.isArray(value) ? value : String(value).split(',').map(s => s.trim()).filter(Boolean);
                                  const handleChecked = (opt) => {
                                    const next = listVal.includes(opt) ? listVal.filter(v => v !== opt) : [...listVal, opt];
                                    onChange(next);
                                  };
                                  return (
                                    <div className="border border-[--border-strong] rounded-lg p-2 max-h-[100px] overflow-y-auto grid grid-cols-2 gap-1.5 bg-[--bg-input]">
                                      {field.options?.map(opt => (
                                        <label key={opt} className="flex items-center gap-1.5 text-xs text-[--text-secondary] cursor-pointer">
                                          <input
                                            type="checkbox"
                                            checked={listVal.includes(opt)}
                                            onChange={() => handleChecked(opt)}
                                            className="w-3.5 h-3.5 accent-[--accent]"
                                          />
                                          <span>{opt}</span>
                                        </label>
                                      ))}
                                    </div>
                                  );
                                }}
                              />
                            ) : field.field_type === 'boolean' ? (
                              <label className="flex items-center gap-2 cursor-pointer py-1.5">
                                <input
                                  type="checkbox"
                                  defaultChecked={lead.customValues?.[field.field_key] === 'true'}
                                  {...register(`customValues.${field.field_key}`)}
                                  className="w-4.5 h-4.5 accent-[--accent]"
                                />
                                <span className="text-xs text-[--text-secondary]">Enabled / Yes</span>
                              </label>
                            ) : field.field_type === 'textarea' ? (
                              <textarea
                                rows={2}
                                placeholder={field.placeholder}
                                {...register(`customValues.${field.field_key}`, { required: field.is_required ? 'Required field' : false })}
                              />
                            ) : field.field_type === 'date' ? (
                              <input
                                type="date"
                                {...register(`customValues.${field.field_key}`, { required: field.is_required ? 'Required field' : false })}
                              />
                            ) : field.field_type === 'number' ? (
                              <input
                                type="number"
                                placeholder={field.placeholder}
                                {...register(`customValues.${field.field_key}`, { required: field.is_required ? 'Required field' : false })}
                              />
                            ) : (
                              <input
                                type="text"
                                placeholder={field.placeholder}
                                {...register(`customValues.${field.field_key}`, { required: field.is_required ? 'Required field' : false })}
                              />
                            )}

                            {error && (
                              <span className="text-red-500 text-[10px] font-bold mt-0.5 block">
                                {error.message || 'Required field'}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Form Save Button */}
            {editMode && (
              <div className="flex justify-end pt-4 border-t border-[--border-strong]">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex items-center gap-1.5 px-6 py-2.5 bg-[--accent] text-white font-black uppercase tracking-wider rounded-lg text-sm transition-all hover:bg-[--accent-hover] shadow-sm cursor-pointer"
                >
                  <Save size={16} />
                  <span>Save Changes</span>
                </button>
              </div>
            )}
          </div>
        </form>

        {/* Right Column: Geotagging, Follow-Ups, and Timeline */}
        <div className="space-y-6">
          
          {/* Field visit Geotagging Card (F4) */}
          {lead.lead_type === 'FIELD' && (
            <div className="glass-panel p-5 bg-white border border-[--border] shadow-sm space-y-4">
              <h3 className="text-xs font-black text-[--text-primary] uppercase tracking-wider border-b border-[--border] pb-2 flex items-center gap-1.5">
                <MapPin size={16} className="text-[--accent]" />
                <span>Field Visit Geotagging</span>
              </h3>

              {/* Existing location coordinates */}
              {lead.geotag_lat && lead.geotag_lng ? (
                <div className="space-y-3 bg-stone-50 border border-[--border] rounded-xl p-3.5 text-xs text-[--text-secondary]">
                  <div className="flex justify-between items-center">
                    <strong className="text-[--text-primary]">Coordinates:</strong>
                    <span className="font-mono bg-white px-2 py-0.5 border rounded">
                      {lead.geotag_lat.toFixed(6)}, {lead.geotag_lng.toFixed(6)}
                    </span>
                  </div>
                  {lead.geotag_accuracy && (
                    <div className="flex justify-between">
                      <span>Accuracy:</span>
                      <span className="font-mono">±{lead.geotag_accuracy.toFixed(1)}m</span>
                    </div>
                  )}
                  {lead.geotag_captured_at && (
                    <div className="flex justify-between">
                      <span>Captured At:</span>
                      <span>{new Date(lead.geotag_captured_at).toLocaleString()}</span>
                    </div>
                  )}
                  {lead.geotag_photo_key && (
                    <div className="border border-stone-200 rounded-lg overflow-hidden mt-2">
                      <img 
                        src={lead.geotag_photo_key} 
                        alt="Field Visit Check-In" 
                        className="w-full h-auto object-cover max-h-48"
                      />
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-4 bg-stone-50 border border-stone-200 border-dashed rounded-xl text-xs text-[--text-secondary] flex flex-col items-center justify-center gap-1 leading-relaxed">
                  <MapPin size={24} className="text-stone-300 animate-bounce" />
                  <span>No check-in location recorded for this field visit.</span>
                </div>
              )}

              {/* Geo Capture Actions */}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleCaptureGps}
                  disabled={capturingGps}
                  className="flex-1 py-2 bg-white border border-[--accent-border] hover:border-[--accent] text-[--accent] font-bold text-xs rounded-lg transition-all flex items-center justify-center gap-1.5 shadow-sm"
                >
                  <MapPin size={13} />
                  <span>{capturingGps ? 'GPS Seeks...' : 'Record GPS'}</span>
                </button>

                <label className="flex-1 py-2 bg-[--accent] hover:bg-[--accent-hover] text-white font-black uppercase text-xs rounded-lg transition-all flex items-center justify-center gap-1.5 shadow-sm cursor-pointer text-center select-none">
                  <Camera size={13} />
                  <span>{uploadingPhoto ? 'Extracting...' : 'Upload Photo'}</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoUpload}
                    disabled={uploadingPhoto}
                    className="hidden"
                  />
                </label>
              </div>
            </div>
          )}

          {/* Follow-Ups portal calendar scheduling section (F5) */}
          <div id="follow-ups-section" className="glass-panel p-5 bg-white border border-[--border] shadow-sm space-y-4 transition-all duration-300">
            <div className="flex justify-between items-center border-b border-[--border] pb-2">
              <h3 className="text-xs font-black text-[--text-primary] uppercase tracking-wider flex items-center gap-1.5">
                <ClipboardList size={16} className="text-[--accent]" />
                <span>Client Follow-Ups</span>
              </h3>
              
              {followUpSummary && (
                <span className="text-[9px] bg-amber-50 text-amber-600 border border-amber-200 px-1.5 py-0.5 rounded font-black">
                  {followUpSummary.pending} Scheduled
                </span>
              )}
            </div>

            {/* List of follow-ups */}
            <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
              {followUps.length === 0 ? (
                <div className="text-center py-6 text-xs text-[--text-secondary]">
                  No scheduled check-ins. Click Schedule to add a reminder.
                </div>
              ) : (
                followUps.map(item => {
                  const isPending = item.status === 'PENDING';
                  const isCompleted = item.status === 'COMPLETED';

                  return (
                    <div key={item.id} className="p-3 border border-[--border] rounded-xl text-xs space-y-2 bg-stone-50/30 hover:bg-stone-50 transition-all relative">
                      <div className="flex justify-between items-start">
                        <span className={`px-1.5 py-0.2 rounded text-[8px] font-black uppercase border ${
                          isCompleted ? 'bg-emerald-50 text-emerald-600 border-emerald-200' :
                          isPending ? 'bg-amber-50 text-amber-600 border-amber-200' :
                          'bg-rose-50 text-rose-600 border-rose-200'
                        }`}>
                          {item.status}
                        </span>
                        
                        <button
                          type="button"
                          onClick={() => handleDeleteFollowUp(item.id)}
                          className="text-stone-400 hover:text-red-500 bg-transparent border-0 cursor-pointer"
                        >
                          <Trash2 size={11} />
                        </button>
                      </div>

                      <p className="text-[11px] text-[--text-secondary] leading-relaxed italic bg-white p-2 border border-stone-100 rounded">
                        "{item.description}"
                      </p>

                      <div className="flex justify-between text-[9px] text-[--text-muted] font-mono">
                        <span>Agent: {item.assigned_to_name}</span>
                        <span>{new Date(item.follow_up_date).toLocaleDateString()} {new Date(item.follow_up_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>

                      {item.completed_note && (
                        <div className="bg-emerald-50/20 text-emerald-800 text-[10px] p-1.5 border border-emerald-100 rounded flex gap-1 items-start leading-snug">
                          <MessageSquare size={11} className="shrink-0 mt-0.5 text-emerald-600" />
                          <span>{item.completed_note}</span>
                        </div>
                      )}

                      {isPending && completingFollowUpId !== item.id && (
                        <button
                          type="button"
                          onClick={() => setCompletingFollowUpId(item.id)}
                          className="w-full mt-2 py-1 bg-white border border-emerald-200 hover:border-transparent hover:bg-emerald-600 text-emerald-600 hover:text-white font-bold text-[9px] rounded transition-all cursor-pointer"
                        >
                          Mark Completed
                        </button>
                      )}

                      {completingFollowUpId === item.id && (
                        <form onSubmit={(e) => handleCompleteFollowUp(e, item.id)} className="mt-2 p-2 bg-white border rounded-lg space-y-2">
                          <span className="text-[9px] font-bold uppercase text-[--text-secondary] block">Visit Note:</span>
                          <textarea
                            value={completedNote}
                            onChange={(e) => setCompletedNote(e.target.value)}
                            required
                            rows={2}
                            placeholder="Store outcome details..."
                            className="bg-stone-50 border border-stone-200 rounded p-1 w-full text-[11px]"
                          />
                          <div className="flex gap-1 justify-end">
                            <button
                              type="button"
                              onClick={() => { setCompletingFollowUpId(null); setCompletedNote(''); }}
                              className="px-2 py-0.5 border text-[9px] rounded bg-white hover:bg-stone-50"
                            >
                              Cancel
                            </button>
                            <button
                              type="submit"
                              className="px-2 py-0.5 bg-emerald-600 text-white font-bold text-[9px] rounded hover:bg-emerald-700"
                            >
                              Complete
                            </button>
                          </div>
                        </form>
                      )}

                    </div>
                  );
                })
              )}
            </div>

            {/* Schedule trigger button */}
            {!showScheduleForm ? (
              <button
                type="button"
                onClick={() => {
                  if (!lead.sub_vertical_id) {
                    toast.error("Please assign a sub-vertical classification to this lead first.");
                    return;
                  }
                  setShowScheduleForm(true);
                }}
                className="w-full py-2 bg-white border border-[--accent-border] hover:border-[--accent] text-[--accent] font-bold text-xs rounded-lg transition-all flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
              >
                <PlusCircle size={13} />
                <span>Schedule Check-In</span>
              </button>
            ) : (
              <form onSubmit={handleCreateFollowUp} className="bg-stone-50/50 border border-stone-200 rounded-xl p-3.5 space-y-3">
                <span className="text-[10px] font-black uppercase text-[--accent] tracking-wider block">Schedule Next Follow-Up</span>
                
                <div className="flex flex-col gap-1 text-[11px]">
                  <label className="font-bold text-[--text-secondary]">Target Date & Time</label>
                  <input
                    type="datetime-local"
                    required
                    value={scheduleDate}
                    onChange={(e) => setScheduleDate(e.target.value)}
                    className="bg-white border rounded p-1"
                  />
                </div>

                <div className="flex flex-col gap-1 text-[11px]">
                  <label className="font-bold text-[--text-secondary]">Employee Spoken</label>
                  <select
                    required
                    value={scheduleAgentId}
                    onChange={(e) => setScheduleAgentId(e.target.value)}
                    className="bg-white border rounded p-1"
                  >
                    <option value="">-- Choose Operator --</option>
                    {subVerticalUsers.map(u => (
                      <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col gap-1 text-[11px]">
                  <label className="font-bold text-[--text-secondary]">Summary / Instructions</label>
                  <textarea
                    required
                    rows={2}
                    placeholder="Describe check-in guidelines..."
                    value={scheduleDesc}
                    onChange={(e) => setScheduleDesc(e.target.value)}
                    className="bg-white border rounded p-1"
                  />
                </div>

                <div className="flex gap-1.5 justify-end pt-1">
                  <button
                    type="button"
                    onClick={() => setShowScheduleForm(false)}
                    className="px-2.5 py-1 border text-[10px] font-bold rounded hover:bg-stone-50 bg-white"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={scheduling}
                    className="px-2.5 py-1 bg-[--accent] hover:bg-[--accent-hover] text-white font-black uppercase text-[10px] rounded transition-all"
                  >
                    {scheduling ? 'Scheduling...' : 'Schedule'}
                  </button>
                </div>
              </form>
            )}
          </div>

          {/* Lead creation and info metrics metadata */}
          <div className="glass-panel p-6 bg-white border border-[--border] shadow-sm space-y-4">
            <h3 className="text-xs font-bold text-[--text-primary] uppercase tracking-wider border-b border-[--border] pb-2 flex items-center gap-2">
              <Calendar size={16} className="text-[--accent]" /> Metadata History
            </h3>
            
            <div className="space-y-2.5 text-xs text-[--text-secondary] font-mono">
              <div className="flex justify-between">
                <span>Created At:</span>
                <span className="text-[--text-primary]">{new Date(lead.created_at || lead.createdAt).toLocaleString()}</span>
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

          {/* Audit History Log */}
          <div className="glass-panel p-6 bg-white border border-[--border] shadow-sm space-y-4">
            <h3 className="text-xs font-bold text-[--text-primary] uppercase tracking-wider border-b border-[--border] pb-2">
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
