import { useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';
import { 
  ShieldAlert, 
  RefreshCw, 
  X, 
  Clock, 
  Globe, 
  User as UserIcon,
  ChevronRight
} from 'lucide-react';

const AuditLogsView = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [limit] = useState(25);
  const [totalPages, setTotalPages] = useState(1);
  const [totalLogs, setTotalLogs] = useState(0);

  // Detail Modal state
  const [selectedLog, setSelectedLog] = useState(null);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api(`/audit-logs?page=${page}&limit=${limit}`);
      setLogs(data.logs);
      setTotalLogs(data.pagination.total);
      setTotalPages(data.pagination.pages);
    } catch (err) {
      console.error('Error fetching audit logs:', err.message);
    } finally {
      setLoading(false);
    }
  }, [page, limit]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const handleRefresh = () => {
    if (page === 1) {
      fetchLogs();
    } else {
      setPage(1);
    }
  };

  return (
    <>
      <div className="content-header">
        <div>
          <h1>System Audits</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '4px' }}>
            Trace security events, user logins, data mutations, and bulk lead imports
          </p>
        </div>

        <button className="glow-button" style={{ background: 'var(--bg-surface)' }} onClick={handleRefresh}>
          <RefreshCw size={18} />
          <span>Refresh Logs</span>
        </button>
      </div>

      {/* Main logs table panel */}
      <div className="glass-panel" style={{ padding: '0' }}>
        {loading ? (
          <div className="page-loader">
            <div className="spinner"></div>
          </div>
        ) : logs.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
            <ShieldAlert size={48} style={{ opacity: 0.25, marginBottom: '12px' }} />
            <p>No audit logs recorded in the system.</p>
          </div>
        ) : (
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Operator (Actor)</th>
                  <th>Action Event</th>
                  <th>Collection</th>
                  <th>IP Address</th>
                  <th>Change Details</th>
                </tr>
              </thead>
              <tbody>
                {logs.map(log => (
                  <tr key={log._id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                        <Clock size={14} style={{ color: 'var(--text-dim)' }} />
                        <span>{new Date(log.createdAt).toLocaleString()}</span>
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ 
                          width: '28px', 
                          height: '28px', 
                          borderRadius: '50%', 
                          background: 'rgba(255,255,255,0.06)', 
                          display: 'flex', 
                          alignItems: 'center', 
                          justifyContent: 'center',
                          color: 'var(--accent-secondary)'
                        }}>
                          <UserIcon size={14} />
                        </div>
                        <div>
                          <strong style={{ display: 'block', fontSize: '0.9rem' }}>{log.actorId?.name || 'System / Auto'}</strong>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>{log.actorId?.email || '-'}</span>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className="audit-action">
                        {log.action}
                      </span>
                    </td>
                    <td>
                      <span className="role-badge agent" style={{ textTransform: 'capitalize' }}>
                        {log.targetCollection}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-dim)', fontSize: '0.85rem' }}>
                        <Globe size={14} />
                        <span>{log.ip || '127.0.0.1'}</span>
                      </div>
                    </td>
                    <td>
                      {log.diff ? (
                        <button 
                          className="action-btn"
                          style={{ 
                            background: 'rgba(255,255,255,0.04)', 
                            borderRadius: '6px', 
                            padding: '6px 12px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            fontSize: '0.85rem',
                            color: 'var(--accent-primary-hover)'
                          }}
                          onClick={() => setSelectedLog(log)}
                        >
                          <span>Inspect Diff</span>
                          <ChevronRight size={14} />
                        </button>
                      ) : (
                        <span style={{ color: 'var(--text-dim)', fontSize: '0.85rem', fontStyle: 'italic' }}>No diff logged</span>
                      )}
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
          <span>Showing page <strong>{page}</strong> of <strong>{totalPages}</strong> (total {totalLogs} logs)</span>
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

      {/* Modal: Diff Inspector */}
      {selectedLog && (
        <div className="modal-overlay">
          <div className="modal-content glass-panel" style={{ maxWidth: '640px' }}>
            <div className="modal-header">
              <div>
                <h2 style={{ fontSize: '1.25rem' }}>Audit Log Diff Inspector</h2>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>
                  Event: {selectedLog.action} • Collection: {selectedLog.targetCollection}
                </span>
              </div>
              <button className="action-btn" onClick={() => setSelectedLog(null)}>
                <X size={20} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                <div>
                  <strong>Performed By:</strong> {selectedLog.actorId?.name} ({selectedLog.actorId?.email || 'N/A'})
                </div>
                <div>
                  <strong>Timestamp:</strong> {new Date(selectedLog.createdAt).toLocaleString()}
                </div>
              </div>

              <div>
                <strong style={{ display: 'block', fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '8px' }}>
                  Raw Mutation JSON:
                </strong>
                <pre className="audit-diff-viewer">
                  {JSON.stringify(selectedLog.diff, null, 2)}
                </pre>
              </div>
            </div>

            <div className="modal-footer" style={{ marginTop: '10px' }}>
              <button 
                className="glow-button" 
                style={{ padding: '8px 16px', background: 'var(--bg-surface)' }}
                onClick={() => setSelectedLog(null)}
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default AuditLogsView;
