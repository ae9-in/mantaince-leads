import React, { useState, useEffect } from 'react';
import axios from '../api/axios.js';
import { useAuthStore } from '../store/authStore.js';
import { 
  Users, UserPlus, Shield, Check, X, ShieldCheck, Mail, Key, Trash2, 
  ChevronRight, AlertTriangle, AlertCircle, RefreshCw, Briefcase
} from 'lucide-react';
import toast from 'react-hot-toast';
import UserAssignmentPanel from '../components/UserAssignmentPanel.jsx';

export const AdminUsersPage = () => {
  const { user: currentAdmin } = useAuthStore();
  const [users, setUsers] = useState([]);
  const [verticals, setVerticals] = useState([]);
  const [loading, setLoading] = useState(true);

  // Selected user for slide-over drawer
  const [selectedUser, setSelectedUser] = useState(null);
  const [assignmentUser, setAssignmentUser] = useState(null);
  
  // Drawer edit states
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editRole, setEditRole] = useState('');
  const [editActive, setEditActive] = useState(true);
  const [selectedVerticalIds, setSelectedVerticalIds] = useState([]);
  const [savingUser, setSavingUser] = useState(false);

  // Invite Modal states
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteName, setInviteName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('agent');
  const [invitePassword, setInvitePassword] = useState('TempPassword123!');
  const [inviteVerticals, setInviteVerticals] = useState([]);
  const [inviting, setInviting] = useState(false);

  // Sensitive Role Confirmation Modal
  const [showConfirmRoleModal, setShowConfirmRoleModal] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pendingRole, setPendingRole] = useState('');

  const fetchUsersAndVerticals = async () => {
    setLoading(true);
    try {
      const [usersRes, verticalsRes] = await Promise.all([
        axios.get('/api/v1/users'),
        axios.get('/api/v1/verticals')
      ]);
      setUsers(usersRes.data.data);
      setVerticals(verticalsRes.data.data);
    } catch (err) {
      toast.error('Failed to retrieve user listing and vertical configurations');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsersAndVerticals();
  }, []);

  const handleSelectUser = (user) => {
    setSelectedUser(user);
    setEditName(user.name);
    setEditEmail(user.email);
    setEditRole(user.roleId?.name || 'agent');
    setEditActive(user.isActive);
    setSelectedVerticalIds(user.verticalAccess?.map(v => v._id) || []);
  };

  const handleToggleVertical = (verticalId) => {
    if (selectedVerticalIds.includes(verticalId)) {
      setSelectedVerticalIds(selectedVerticalIds.filter(id => id !== verticalId));
    } else {
      setSelectedVerticalIds([...selectedVerticalIds, verticalId]);
    }
  };

  const handleSaveGeneralDetails = async () => {
    if (!selectedUser) return;
    setSavingUser(true);
    try {
      // 1. Update basic info (name, email, isActive)
      await axios.patch(`/api/v1/users/${selectedUser._id}`, {
        name: editName,
        email: editEmail,
        isActive: editActive
      });

      // 2. Update vertical access
      await axios.patch(`/api/v1/users/${selectedUser._id}/verticals`, {
        verticalAccess: selectedVerticalIds
      });

      toast.success('User details updated successfully');
      await fetchUsersAndVerticals();
      // Reload details with fresh references
      const updated = users.find(u => u._id === selectedUser._id);
      if (updated) handleSelectUser(updated);
      setSelectedUser(null);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update user profile details');
    } finally {
      setSavingUser(false);
    }
  };

  // Change Role handles the sensitive modal launch
  const handleRoleChangeSelect = (newRole) => {
    const currentRole = selectedUser.roleId?.name;
    if (newRole !== currentRole) {
      setPendingRole(newRole);
      setShowConfirmRoleModal(true);
    }
  };

  const handleConfirmRoleChange = async () => {
    if (!selectedUser || !pendingRole) return;
    setSavingUser(true);
    try {
      await axios.patch(`/api/v1/users/${selectedUser._id}/role`, {
        role: pendingRole,
        adminPassword: confirmPassword
      });
      toast.success(`Role changed to ${pendingRole} successfully`);
      setShowConfirmRoleModal(false);
      setConfirmPassword('');
      await fetchUsersAndVerticals();
      setSelectedUser(null);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to authorize role transition');
    } finally {
      setSavingUser(false);
    }
  };

  const handleSendResetEmail = async () => {
    if (!selectedUser) return;
    try {
      await axios.post('/api/v1/auth/forgot-password', { email: selectedUser.email });
      toast.success('Password reset email sent to user');
    } catch (err) {
      toast.error('Failed to trigger reset email');
    }
  };

  const handleDeactivate = async () => {
    if (!selectedUser) return;
    if (window.confirm(`Are you sure you want to deactivate ${selectedUser.name}?`)) {
      try {
        await axios.delete(`/api/v1/users/${selectedUser._id}`);
        toast.success('User deactivated successfully');
        await fetchUsersAndVerticals();
        setSelectedUser(null);
      } catch (err) {
        toast.error(err.response?.data?.error || 'Failed to deactivate user account');
      }
    }
  };

  const handleInviteSubmit = async (e) => {
    e.preventDefault();
    setInviting(true);
    try {
      await axios.post('/api/v1/users/invite', {
        name: inviteName,
        email: inviteEmail,
        role: inviteRole,
        password: invitePassword,
        verticalAccess: inviteVerticals
      });
      toast.success('User invited and created successfully!');
      setShowInviteModal(false);
      // Reset form
      setInviteName('');
      setInviteEmail('');
      setInviteRole('agent');
      setInvitePassword('TempPassword123!');
      setInviteVerticals([]);
      await fetchUsersAndVerticals();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Invitation mapping failed');
    } finally {
      setInviting(false);
    }
  };

  const getRoleBadgeStyle = (roleName) => {
    switch (roleName) {
      case 'super_admin': return 'bg-red-50 text-red-700 border-red-200';
      case 'vertical_admin': return 'bg-[--accent-light] text-[--accent] border-[--accent-border]';
      default: return 'bg-stone-100 text-[--text-secondary] border-stone-200';
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Page header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-black text-[--text-primary] uppercase tracking-wider">User Accounts</h2>
          <p className="text-xs text-[--text-secondary] mt-1">Manage tenant operators access privileges, system roles, and workspace memberships</p>
        </div>
        <button
          onClick={() => setShowInviteModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-[--accent] text-white font-black uppercase text-xs rounded-lg hover:bg-[--accent-hover] transition-all shadow-md"
        >
          <UserPlus size={14} />
          <span>Invite Operator</span>
        </button>
      </div>

      {/* Main split dashboard view */}
      <div className="flex flex-col lg:flex-row gap-6">
        
        {/* Left side: Users table */}
        <div className="flex-1 glass-panel bg-white shadow-sm border border-[--border] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="border-b border-[--border-strong] bg-stone-50 text-xs font-bold text-[--text-secondary] uppercase select-none tracking-wider">
                  <th className="px-6 py-4">Name</th>
                  <th className="px-6 py-4">Email</th>
                  <th className="px-6 py-4">Role</th>
                  <th className="px-6 py-4">Assignments</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[--border]">
                {loading ? (
                  Array.from({ length: 4 }).map((_, idx) => (
                    <tr key={idx} className="animate-pulse">
                      <td className="px-6 py-4"><div className="h-4 bg-stone-100 rounded w-24"></div></td>
                      <td className="px-6 py-4"><div className="h-4 bg-stone-100 rounded w-36"></div></td>
                      <td className="px-6 py-4"><div className="h-5 bg-stone-100 rounded w-16"></div></td>
                      <td className="px-6 py-4"><div className="h-4 bg-stone-100 rounded w-32"></div></td>
                      <td className="px-6 py-4"><div className="h-4 bg-stone-100 rounded w-12"></div></td>
                      <td className="px-6 py-4"><div className="h-4 bg-stone-100 rounded w-10 ml-auto"></div></td>
                    </tr>
                  ))
                ) : users.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="text-center py-12 text-[--text-secondary] text-xs">
                      No user accounts found. Click Invite to create.
                    </td>
                  </tr>
                ) : (
                  users.map(user => (
                    <tr 
                      key={user._id} 
                      onClick={() => handleSelectUser(user)}
                      className={`hover:bg-stone-50/50 cursor-pointer transition-all ${
                        selectedUser?._id === user._id || assignmentUser?._id === user._id ? 'bg-[--accent-light]' : ''
                      }`}
                    >
                      <td className="px-6 py-4 text-[--text-primary] font-semibold">
                        {user.name}
                      </td>
                      <td className="px-6 py-4 text-xs font-mono text-[--text-secondary]">
                        {user.email}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-block px-2.5 py-0.5 text-[9px] font-mono font-bold uppercase border rounded-md ${getRoleBadgeStyle(user.roleId?.name)}`}>
                          {user.roleId?.name?.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <button 
                          onClick={(e) => { e.stopPropagation(); setAssignmentUser(user); }}
                          className="flex items-center gap-2 px-2 py-1 bg-stone-50 border border-[--border] rounded hover:bg-stone-100 transition-all group"
                        >
                          <Briefcase size={12} className="text-[--text-muted] group-hover:text-[--accent]" />
                          <span className="text-[10px] font-bold text-[--text-secondary]">
                            {user.assignedSubVerticals?.length || 0} Sub-Verticals
                          </span>
                        </button>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-block w-2 h-2 rounded-full ${user.isActive ? 'bg-[#2ecc71]' : 'bg-red-500'}`} />
                        <span className="text-xs ml-1.5 font-semibold text-[--text-primary]">{user.isActive ? 'Active' : 'Inactive'}</span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-3">
                          <button 
                            onClick={(e) => { e.stopPropagation(); handleSelectUser(user); }}
                            className="p-1.5 text-[--text-muted] hover:text-[--text-primary] hover:bg-stone-100 rounded transition-all"
                          >
                            <ChevronRight size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right side: Slide-over details editor drawer (appears on selection) */}
        {selectedUser && (
          <div className="w-full lg:w-96 glass-panel bg-white border border-[--border] shadow-sm p-6 space-y-6 flex flex-col justify-between">
            <div className="space-y-6">
              
              {/* Drawer header */}
              <div className="flex items-center justify-between border-b border-[--border] pb-4">
                <div>
                  <h3 className="text-sm font-bold text-[--text-primary] uppercase tracking-wider">Manage Account</h3>
                  <p className="text-xs text-[--text-secondary] font-mono mt-0.5">{selectedUser.email}</p>
                </div>
                <button 
                  onClick={() => setSelectedUser(null)}
                  className="p-1 border border-[--border-strong] rounded text-[--text-secondary] hover:bg-stone-50 transition-all"
                >
                  <X size={14} />
                </button>
              </div>

              {/* Editable Fields Form */}
              <div className="space-y-4 text-xs">
                
                {/* 1. Name input */}
                <div className="flex flex-col gap-1.5">
                  <label className="font-bold text-[--text-secondary] uppercase">Display Name</label>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full bg-[--bg-input] border border-[--border-strong] rounded-lg px-3 py-2 text-[--text-primary] focus:outline-none focus:border-[--accent]"
                  />
                </div>

                {/* 2. Email input */}
                <div className="flex flex-col gap-1.5">
                  <label className="font-bold text-[--text-secondary] uppercase">Email Address</label>
                  <input
                    type="email"
                    value={editEmail}
                    onChange={(e) => setEditEmail(e.target.value)}
                    className="w-full bg-[--bg-input] border border-[--border-strong] rounded-lg px-3 py-2 text-[--text-primary] focus:outline-none focus:border-[--accent]"
                  />
                </div>

                {/* 3. Role input */}
                <div className="flex flex-col gap-1.5">
                  <label className="font-bold text-[--text-secondary] uppercase">System Access Privilege Role</label>
                  <select
                    value={editRole}
                    onChange={(e) => handleRoleChangeSelect(e.target.value)}
                    className="w-full bg-[--bg-input] border border-[--border-strong] rounded-lg px-3 py-2 text-[--text-primary] focus:outline-none focus:border-[--accent]"
                  >
                    <option value="agent">Agent (Operator)</option>
                    <option value="vertical_admin">Vertical Admin</option>
                    <option value="super_admin">Super Administrator</option>
                  </select>
                </div>

                {/* 4. Active switch toggle */}
                <div className="flex items-center justify-between bg-stone-50/50 p-3 rounded-lg border border-[--border]">
                  <div>
                    <span className="font-bold text-[--text-primary] uppercase block">Account Status</span>
                    <span className="text-[10px] text-[--text-secondary] block mt-0.5">Toggle active login status</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={editActive}
                    onChange={(e) => setEditActive(e.target.checked)}
                    className="w-8 h-4 rounded-full bg-stone-200 border border-stone-300 appearance-none checked:bg-[#2ecc71] relative cursor-pointer outline-none transition-all after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:w-3 after:h-3 after:bg-white after:rounded-full after:transition-all checked:after:left-4.5"
                  />
                </div>

                {/* 5. Verticals multiselect access check list */}
                {editRole !== 'super_admin' && (
                  <div className="space-y-2">
                    <label className="font-bold text-[--text-secondary] uppercase block">Vertical Access Groups</label>
                    <div className="border border-[--border] rounded-lg p-3 max-h-[160px] overflow-y-auto space-y-2 bg-[--bg-input]">
                      {verticals.map(vert => {
                        const checked = selectedVerticalIds.includes(vert._id);
                        return (
                          <label key={vert._id} className="flex items-center gap-2 cursor-pointer select-none text-[--text-secondary] hover:text-[--text-primary]">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => handleToggleVertical(vert._id)}
                              className="rounded border-[--border-strong] bg-[--bg-input] text-[--accent] focus:ring-0 focus:ring-offset-0"
                            />
                            <span>{vert.name}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}

              </div>
            </div>

            {/* Bottom Actions */}
            <div className="space-y-2 pt-4 border-t border-[--border]">
              <button
                onClick={handleSaveGeneralDetails}
                disabled={savingUser}
                className="w-full py-2 bg-[--accent] text-white font-black uppercase text-xs rounded-lg hover:bg-[--accent-hover] transition-all flex items-center justify-center gap-1.5 shadow-sm"
              >
                {savingUser ? <RefreshCw className="animate-spin" size={12} /> : <Check size={12} />}
                <span>Save Changes</span>
              </button>

              <button
                onClick={handleSendResetEmail}
                className="w-full py-2 border border-[--border-strong] hover:bg-stone-50 text-[--text-secondary] font-semibold text-xs rounded-lg transition-all flex items-center justify-center gap-1.5"
              >
                <Key size={12} />
                <span>Send Password Reset</span>
              </button>

              <button
                onClick={handleDeactivate}
                className="w-full py-2 bg-red-50 border border-red-200 hover:bg-red-100/50 text-red-600 font-semibold text-xs rounded-lg transition-all flex items-center justify-center gap-1.5"
              >
                <Trash2 size={12} />
                <span>Deactivate Operator</span>
              </button>
            </div>

          </div>
        )}

        {/* User Assignment Panel Slide-over */}
        {assignmentUser && (
          <div className="w-full lg:w-96">
            <UserAssignmentPanel 
              user={assignmentUser} 
              verticals={verticals} 
              onClose={() => setAssignmentUser(null)} 
              onSaveSuccess={() => {
                fetchUsersAndVerticals();
                setAssignmentUser(null);
              }}
            />
          </div>
        )}

      </div>

      {/* Invite User Dialog Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/40 backdrop-blur-sm p-4">
          <div className="glass-panel w-full max-w-md bg-white border border-[--border] shadow-xl p-6 space-y-4">
            
            <div className="flex justify-between items-center border-b border-[--border] pb-3">
              <h3 className="text-md font-bold text-[--text-primary] uppercase tracking-wider flex items-center gap-2">
                <UserPlus className="text-[--accent]" size={18} />
                <span>Invite New Operator</span>
              </h3>
              <button 
                onClick={() => setShowInviteModal(false)}
                className="text-[--text-secondary] hover:text-[--text-primary]"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleInviteSubmit} className="space-y-4 text-xs">
              <div className="flex flex-col gap-1.5">
                <label className="font-bold text-[--text-secondary] uppercase">Full Name</label>
                <input
                  type="text"
                  required
                  value={inviteName}
                  onChange={(e) => setInviteName(e.target.value)}
                  className="bg-[--bg-input] border border-[--border-strong] rounded-lg px-3 py-2 text-[--text-primary] focus:outline-none focus:border-[--accent]"
                  placeholder="e.g. Rahul Sharma"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="font-bold text-[--text-secondary] uppercase">Email Address</label>
                <input
                  type="email"
                  required
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="bg-[--bg-input] border border-[--border-strong] rounded-lg px-3 py-2 text-[--text-primary] focus:outline-none focus:border-[--accent]"
                  placeholder="e.g. rahul@leadsbase.io"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="font-bold text-[--text-secondary] uppercase">Temporary Login Password</label>
                <input
                  type="text"
                  required
                  value={invitePassword}
                  onChange={(e) => setInvitePassword(e.target.value)}
                  className="bg-[--bg-input] border border-[--border-strong] rounded-lg px-3 py-2 text-[--text-primary] focus:outline-none focus:border-[--accent] font-mono text-xs"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="font-bold text-[--text-secondary] uppercase">Role Privilege Mapping</label>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value)}
                  className="bg-[--bg-input] border border-[--border-strong] rounded-lg px-3 py-2 text-[--text-primary] focus:outline-none focus:border-[--accent]"
                >
                  <option value="agent">Agent (Operator)</option>
                  <option value="vertical_admin">Vertical Administrator</option>
                  <option value="super_admin">Super Administrator</option>
                </select>
              </div>

              {inviteRole !== 'super_admin' && (
                <div className="space-y-2">
                  <label className="font-bold text-[--text-secondary] uppercase block">Assign Vertical Access</label>
                  <div className="border border-[--border] rounded-lg p-2.5 max-h-[120px] overflow-y-auto space-y-2 bg-[--bg-input]">
                    {verticals.map(vert => {
                      const checked = inviteVerticals.includes(vert._id);
                      return (
                        <label key={vert._id} className="flex items-center gap-2 cursor-pointer select-none text-[--text-secondary]">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => {
                              if (checked) {
                                setInviteVerticals(inviteVerticals.filter(id => id !== vert._id));
                              } else {
                                setInviteVerticals([...inviteVerticals, vert._id]);
                              }
                            }}
                            className="rounded border-[--border-strong] bg-[--bg-input] text-[--accent] focus:ring-0 focus:ring-offset-0"
                          />
                          <span>{vert.name}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-3 border-t border-[--border]">
                <button
                  type="button"
                  onClick={() => setShowInviteModal(false)}
                  className="px-4 py-2 border border-[--border-strong] rounded-lg text-[--text-secondary] hover:bg-stone-50 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={inviting}
                  className="px-4 py-2 bg-[--accent] text-white font-black uppercase rounded-lg hover:bg-[--accent-hover] shadow-sm"
                >
                  {inviting ? 'Inviting...' : 'Send Invitation'}
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

      {/* Sensitive Role Change Password Confirmation Modal */}
      {showConfirmRoleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/40 backdrop-blur-sm p-4">
          <div className="glass-panel w-full max-w-sm bg-white border border-[--border] p-6 space-y-4 text-center shadow-xl">
            <div className="flex justify-center text-red-500 animate-bounce">
              <ShieldCheck size={48} />
            </div>
            <div>
              <h3 className="text-md font-bold text-[--text-primary] uppercase">Sensitive Action Authorization</h3>
              <p className="text-xs text-[--text-secondary] mt-1.5 leading-relaxed">
                Confirm password to change this user's privilege mapping to <strong>{pendingRole}</strong>.
              </p>
            </div>

            <div className="flex flex-col gap-1.5 text-left text-xs">
              <label className="font-bold text-[--text-secondary] uppercase">Admin Password</label>
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full bg-[--bg-input] border border-[--border-strong] rounded-lg px-3 py-2 text-[--text-primary] focus:outline-none focus:border-red-500 font-mono"
                placeholder="Enter your admin password"
              />
            </div>

            <div className="flex gap-2 justify-end pt-2">
              <button
                type="button"
                onClick={() => { setShowConfirmRoleModal(false); setConfirmPassword(''); }}
                className="px-4 py-2 border border-[--border-strong] hover:bg-stone-50 text-xs text-[--text-secondary] font-semibold rounded-lg"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmRoleChange}
                className="px-4 py-2 bg-red-600 text-white text-xs font-bold rounded-lg hover:bg-red-700 shadow-sm"
              >
                Confirm Alteration
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default AdminUsersPage;
