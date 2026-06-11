import { useState, useEffect } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { 
  Layers, 
  Users, 
  FileSpreadsheet, 
  Settings, 
  LogOut, 
  ShieldAlert,
  ChevronDown
} from 'lucide-react';

const DashboardLayout = () => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [verticals, setVerticals] = useState([]);
  const [activeVerticalId, setActiveVerticalId] = useState('');
  const [loadingVerticals, setLoadingVerticals] = useState(true);

  // Fetch verticals accessible to the logged in user
  const fetchVerticals = async () => {
    try {
      const list = await api('/verticals');
      setVerticals(list);
      if (list.length > 0) {
        // Retrieve last selected vertical from localStorage or default to first
        const saved = localStorage.getItem('active_vertical_id');
        const exists = list.some(v => v._id === saved);
        if (saved && exists) {
          setActiveVerticalId(saved);
        } else {
          setActiveVerticalId(list[0]._id);
          localStorage.setItem('active_vertical_id', list[0]._id);
        }
      }
    } catch (err) {
      console.error('Error fetching verticals:', err.message);
    } finally {
      setLoadingVerticals(false);
    }
  };

  useEffect(() => {
    fetchVerticals();
  }, [user]);

  const handleVerticalChange = (e) => {
    const vId = e.target.value;
    setActiveVerticalId(vId);
    localStorage.setItem('active_vertical_id', vId);
  };

  const currentVertical = verticals.find(v => v._id === activeVerticalId);

  // Navigation options based on User Roles
  const menuItems = [
    { path: '/', label: 'Leads', icon: <FileSpreadsheet size={18} />, roles: ['super_admin', 'vertical_admin', 'agent'] },
    { path: '/configs', label: 'Vertical Configs', icon: <Settings size={18} />, roles: ['super_admin', 'vertical_admin'] },
    { path: '/users', label: 'User Accounts', icon: <Users size={18} />, roles: ['super_admin', 'vertical_admin'] },
    { path: '/audit-logs', label: 'System Audits', icon: <ShieldAlert size={18} />, roles: ['super_admin', 'vertical_admin'] },
  ];

  const filteredMenu = menuItems.filter(item => item.roles.includes(user?.role));

  return (
    <div className="app-container">
      {/* Sidebar Panel */}
      <aside className="sidebar">
        <div className="sidebar-logo">
          <Layers size={24} className="icon" style={{ color: 'var(--accent-primary)' }} />
          <h2>LeadsPortal</h2>
        </div>

        <ul className="sidebar-menu">
          {filteredMenu.map(item => {
            const isActive = location.pathname === item.path;
            return (
              <li key={item.path} className={`sidebar-item ${isActive ? 'active' : ''}`}>
                <Link to={item.path}>
                  {item.icon}
                  <span>{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>

        <div className="sidebar-footer">
          <div className="user-profile-summary">
            <span className="user-profile-name">{user?.name}</span>
            <span className="user-profile-role">{user?.role?.replace('_', ' ')}</span>
          </div>
          <button className="logout-btn" onClick={logout}>
            <LogOut size={16} />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Panel */}
      <main className="main-window">
        <header className="top-navbar">
          <div className="top-navbar-left">
            <label htmlFor="vertical-select" style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)' }}>
              Active Workspace:
            </label>
            {loadingVerticals ? (
              <span className="spinner" style={{ width: '16px', height: '16px', borderWidth: '2px' }}></span>
            ) : verticals.length > 0 ? (
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <select
                  id="vertical-select"
                  className="vertical-selector"
                  value={activeVerticalId}
                  onChange={handleVerticalChange}
                  style={{ paddingRight: '32px', appearance: 'none' }}
                >
                  {verticals.map(v => (
                    <option key={v._id} value={v._id}>{v.name}</option>
                  ))}
                </select>
                <ChevronDown size={16} style={{ position: 'absolute', right: '12px', pointerEvents: 'none', color: 'var(--text-dim)' }} />
              </div>
            ) : (
              <span style={{ color: 'var(--color-danger)', fontSize: '0.9rem', fontWeight: 500 }}>No Vertical Access</span>
            )}
          </div>

          <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
            System Status: <span style={{ color: 'var(--color-success)', fontWeight: 600 }}>● Online</span>
          </div>
        </header>

        {/* Child Router Screens injection */}
        <section className="content-area">
          <Outlet context={{ currentVertical, verticals, reloadVerticals: fetchVerticals }} />
        </section>
      </main>
    </div>
  );
};

export default DashboardLayout;
