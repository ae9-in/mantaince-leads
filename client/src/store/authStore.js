import { create } from 'zustand';
import axios, { injectAuthStore } from '../api/axios.js';

let refreshPromise = null;

// Get initial user from localStorage
const getInitialUser = () => {
  try {
    const saved = localStorage.getItem('user');
    return saved ? JSON.parse(saved) : null;
  } catch {
    return null;
  }
};

export const useAuthStore = create((set, get) => ({
  user: getInitialUser(),
  accessToken: null,
  isAuthenticated: !!getInitialUser(),
  isInitializing: true,
  loading: false,

  initializeAuth: async () => {
    if (localStorage.getItem('user')) {
      try {
        await get().refreshToken();
      } catch {
        localStorage.removeItem('user');
        set({ user: null, accessToken: null, isAuthenticated: false });
      }
    }
    set({ isInitializing: false });
  },

  login: async (email, password) => {
    set({ loading: true });
    try {
      const response = await axios.post('/api/v1/auth/login', { email, password });
      const { accessToken, user } = response.data.data;

      localStorage.setItem('user', JSON.stringify(user));
      set({
        user,
        accessToken,
        isAuthenticated: true,
        loading: false
      });
      return user;
    } catch (error) {
      set({ loading: false });
      throw new Error(error.response?.data?.error || 'Login failed. Please check your credentials.');
    }
  },

  logout: async () => {
    try {
      await axios.post('/api/v1/auth/logout');
    } catch {
      // Ignore network errors on logout
    } finally {
      localStorage.removeItem('user');
      set({
        user: null,
        accessToken: null,
        isAuthenticated: false
      });
    }
  },

  refreshToken: async () => {
    if (refreshPromise) {
      return refreshPromise;
    }

    refreshPromise = (async () => {
      try {
        const response = await axios.post('/api/v1/auth/refresh');
        const { accessToken, user } = response.data.data;
        localStorage.setItem('user', JSON.stringify(user));
        set({
          user,
          accessToken,
          isAuthenticated: true
        });
        return accessToken;
      } catch (error) {
        localStorage.removeItem('user');
        set({
          user: null,
          accessToken: null,
          isAuthenticated: false
        });
        throw error;
      } finally {
        refreshPromise = null;
      }
    })();

    return refreshPromise;
  },

  setAccessToken: (token) => set({ accessToken: token }),
  setUser: (user) => {
    if (user) {
      localStorage.setItem('user', JSON.stringify(user));
      set({ user, isAuthenticated: true });
    } else {
      localStorage.removeItem('user');
      set({ user: null, isAuthenticated: false });
    }
  }
}));

injectAuthStore(useAuthStore);

export default useAuthStore;
