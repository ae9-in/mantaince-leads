import { createContext, useState, useEffect, useContext } from 'react';
import { api, setAccessToken } from '../services/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Authenticate using the active session/cookie on mount
  const checkAuth = async () => {
    try {
      // Endpoint /auth/me requires authentication.
      // If access token is expired, api client tries refresh automatically
      const me = await api('/auth/me');
      if (me) {
        setUser(me);
      }
    } catch (err) {
      console.log('No active session found:', err.message);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkAuth();

    // Event listener for global session expiry
    const handleSessionExpired = () => {
      setUser(null);
      setAccessToken(null);
      alert('Your session has expired. Please log in again.');
    };

    window.addEventListener('auth-session-expired', handleSessionExpired);
    return () => {
      window.removeEventListener('auth-session-expired', handleSessionExpired);
    };
  }, []);

  // Login handler
  const login = async (email, password) => {
    const data = await api('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
    setAccessToken(data.accessToken);
    setUser(data.user);
    return data.user;
  };

  // Logout handler
  const logout = async () => {
    try {
      await api('/auth/logout', { method: 'POST' });
    } catch (err) {
      console.error('Logout request failed:', err.message);
    } finally {
      setAccessToken(null);
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider value={{ user, setUser, loading, login, logout, checkAuth }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
