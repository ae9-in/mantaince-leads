import { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { 
  Plus, 
  Edit, 
  X, 
  AlertCircle,
  Users,
  CheckCircle2,
  XCircle
} from 'lucide-react';

const UsersView = () => {
  const { user: currentUser } = useAuth();
  const { verticals } = useOutletContext();
  const isSuperAdmin = currentUser?.role === 'super_admin';

  // Users state
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modals state
  const [userModalOpen, setUserModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);

  // Form state
  const [userForm, setUserForm] = useState({
    name: '',
    email: '',
    password: '',
    role: 'agent',
    verticalAccess: [] // array of vertical IDs
  });
  const [formErrors, setFormErrors] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  // Fetch users list
  const fetchUsers = async () => {
    setLoading(true);
    try {
      const data = await api('/users');
      setUsers(data);
    } catch (err) {
      console.error('Error fetching users:', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  // Open Add User modal
  const handleOpenAddModal = () => {
    setSelectedUser(null);
    setFormErrors([]);
    setUserForm({
      name: '',
      email: '',
      password: '',
      role: 'agent',
      verticalAccess: []
    });
    setUserModalOpen(true);
  };

  // Open Edit User modal
  const handleOpenEditModal = (userItem) => {
    setSelectedUser(userItem);
    setFormErrors([]);
    setUserForm({
      name: userItem.name,
      email: userItem.email,
      password: '', // Don't prefill password
      role: userItem.roleId?.name || '',
      verticalAccess: userItem.verticalAccess?.map(v => v._id || v) || []
    });
    setUserModalOpen(true);
  };

  // Toggle vertical checkbox
  const handleVerticalCheckboxChange = (vId) => {
    setUserForm(prev => {
      const isChecked = prev.verticalAccess.includes(vId);
      const newAccess = isChecked
        ? prev.verticalAccess.filter(id => id !== vId)
        : [...prev.verticalAccess, vId];
      return {
        ...prev,
        verticalAccess: newAccess
      };
    });
  };

  // Submit User form
  const handleUserSubmit = async (e) => {
    e.preventDefault();
    setFormErrors([]);
    setSubmitting(true);

    try {
      if (selectedUser) {
        // Edit User
        const payload = {
          name: userForm.name,
          role: userForm.role,
          verticalAccess: userForm.verticalAccess
        };
        await api(`/users/${selectedUser._id}`, {
          method: 'PUT',
          body: JSON.stringify(payload)
        });
      } else {
        // Create User
        await api('/users', {
          method: 'POST',
          body: JSON.stringify(userForm)
        });
      }

      setUserModalOpen(false);
      fetchUsers();
    } catch (err) {
      setFormErrors([err.message]);
    } finally {
      setSubmitting(false);
    }
  };

  // Toggle user active status
  const handleToggleUserStatus = async (userItem) => {
    const nextStatus = !userItem.isActive;
    try {
      await api(`/users/${userItem._id}/status`, {
        method: 'PUT',
        body: JSON.stringify({ isActive: nextStatus })
      });
      setUsers(users.map(u => u._id === userItem._id ? { ...u, isActive: nextStatus } : u));
    } catch (err) {
      alert(`Status update failed: ${err.message}`);
    }
  };

  // Filter vertical list based on user authorization
  // Super Admin can assign any vertical. Vertical Admin can only assign verticals they possess.
  const assignableVerticals = isSuperAdmin 
    ? verticals 
    : verticals.filter(v => currentUser?.verticalAccess.includes(v._id));

  return (
    <>
      <div className="content-header">
        <div>
          <h1>User Accounts</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '4px' }}>
            Manage organization members, assign roles, and configure data restrictions
          </p>
        </div>

        <button className="glow-button" onClick={handleOpenAddModal}>
          <Plus size={18} />
          <span>Invite Member</span>
        </button>
      </div>

      {/* Main Users Table Grid */}
      <div className="glass-panel" style={{ padding: '0' }}>
        {loading ? (
          <div className="page-loader">
            <div className="spinner"></div>
          </div>
        ) : users.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
            <Users size={48} style={{ opacity: 0.2, marginBottom: '12px' }} />
            <p>No user accounts found.</p>
          </div>
        ) : (
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Vertical Access</th>
                  <th>Account Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map(item => {
                  const isSelf = item._id === currentUser?.id;
                  const roleName = item.roleId?.name || 'agent';
                  
                  return (
                    <tr key={item._id} style={{ opacity: item.isActive ? 1 : 0.6 }}>
                      <td style={{ fontWeight: 600 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span>{item.name}</span>
                          {isSelf && (
                            <span className="tag-badge" style={{ background: 'var(--border-focus)', color: 'var(--text-main)', fontSize: '0.7rem' }}>YOU</span>
                          )}
                        </div>
                      </td>
                      <td>{item.email}</td>
                      <td>
                        <span className={`role-badge ${roleName}`}>
                          {roleName.replace('_', ' ')}
                        </span>
                      </td>
                      <td>
                        {roleName === 'super_admin' ? (
                          <span style={{ fontStyle: 'italic', color: 'var(--accent-primary-hover)', fontSize: '0.85rem', fontWeight: 600 }}>Unrestricted (Global)</span>
                        ) : item.verticalAccess && item.verticalAccess.length > 0 ? (
                          <div className="badge-list">
                            {item.verticalAccess.map(v => (
                              <span key={v._id || v} className="tag-badge">
                                {v.name || verticals.find(x => x._id === v)?.name || 'Vertical'}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span style={{ color: 'var(--text-dim)', fontStyle: 'italic', fontSize: '0.85rem' }}>No access granted</span>
                        )}
                      </td>
                      <td>
                        <button 
                          className="action-btn"
                          disabled={isSelf} // Cannot deactivate oneself
                          onClick={() => handleToggleUserStatus(item)}
                          style={{ 
                            color: item.isActive ? 'var(--color-success)' : 'var(--color-danger)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            fontWeight: '600',
                            fontSize: '0.85rem'
                          }}
                          title={isSelf ? 'Cannot deactivate your own account' : item.isActive ? 'Suspend account' : 'Activate account'}
                        >
                          {item.isActive ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
                          <span>{item.isActive ? 'Active' : 'Suspended'}</span>
                        </button>
                      </td>
                      <td>
                        <div className="actions-cell">
                          <button 
                            className="action-btn" 
                            onClick={() => handleOpenEditModal(item)}
                            title="Edit user details"
                          >
                            <Edit size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal: Add or Edit User */}
      {userModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content glass-panel">
            <div className="modal-header">
              <h2>{selectedUser ? 'Edit User Credentials' : 'Invite New Organization Member'}</h2>
              <button className="action-btn" onClick={() => setUserModalOpen(false)}>
                <X size={20} />
              </button>
            </div>

            {formErrors.length > 0 && (
              <div className="error-banner">
                <AlertCircle size={18} />
                <span>{formErrors[0]}</span>
              </div>
            )}

            <form onSubmit={handleUserSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="form-group">
                <label htmlFor="user-name">Full Name *</label>
                <input
                  type="text"
                  id="user-name"
                  className="form-control"
                  required
                  value={userForm.name}
                  onChange={(e) => setUserForm(prev => ({ ...prev, name: e.target.value }))}
                  disabled={submitting}
                />
              </div>

              {!selectedUser && (
                <>
                  <div className="form-group">
                    <label htmlFor="user-email">Email Address *</label>
                    <input
                      type="email"
                      id="user-email"
                      className="form-control"
                      required
                      placeholder="e.g. agent@company.com"
                      value={userForm.email}
                      onChange={(e) => setUserForm(prev => ({ ...prev, email: e.target.value }))}
                      disabled={submitting}
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="user-password">Initial Password * (at least 6 characters)</label>
                    <input
                      type="password"
                      id="user-password"
                      className="form-control"
                      required
                      minLength={6}
                      value={userForm.password}
                      onChange={(e) => setUserForm(prev => ({ ...prev, password: e.target.value }))}
                      disabled={submitting}
                    />
                  </div>
                </>
              )}

              <div className="form-group">
                <label htmlFor="user-role">System Role *</label>
                <select
                  id="user-role"
                  className="form-control"
                  value={userForm.role}
                  onChange={(e) => {
                    const r = e.target.value;
                    setUserForm(prev => ({
                      ...prev,
                      role: r,
                      // Clear vertical access if role is super admin (not scoped)
                      verticalAccess: r === 'super_admin' ? [] : prev.verticalAccess
                    }));
                  }}
                  disabled={submitting}
                >
                  <option value="agent">Agent (assigned leads CRUD only)</option>
                  <option value="vertical_admin">Vertical Admin (manage users & workspace)</option>
                  {isSuperAdmin && <option value="super_admin">Super Admin (full global control)</option>}
                </select>
              </div>

              {/* Vertical access assignment checks */}
              {userForm.role !== 'super_admin' && (
                <div className="form-group">
                  <label>Assign Workspace Access (select at least one vertical)</label>
                  <div 
                    className="glass-panel" 
                    style={{ 
                      padding: '16px', 
                      background: 'rgba(0,0,0,0.15)', 
                      display: 'flex', 
                      flexDirection: 'column', 
                      gap: '12px',
                      maxHeight: '180px',
                      overflowY: 'auto'
                    }}
                  >
                    {assignableVerticals.length === 0 ? (
                      <span style={{ fontSize: '0.85rem', color: 'var(--text-dim)', fontStyle: 'italic' }}>
                        No business verticals available to assign.
                      </span>
                    ) : (
                      assignableVerticals.map(v => {
                        const isChecked = userForm.verticalAccess.includes(v._id);
                        return (
                          <label key={v._id} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => handleVerticalCheckboxChange(v._id)}
                              disabled={submitting}
                            />
                            <span style={{ fontSize: '0.9rem' }}>{v.name}</span>
                          </label>
                        );
                      })
                    )}
                  </div>
                </div>
              )}

              <div className="modal-footer">
                <button type="button" className="action-btn" style={{ padding: '10px 20px', borderRadius: '8px', border: '1px solid var(--border-light)' }} onClick={() => setUserModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="glow-button" disabled={submitting}>
                  {submitting ? <span className="spinner" style={{ width: '18px', height: '18px' }}></span> : 'Save User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};

export default UsersView;
