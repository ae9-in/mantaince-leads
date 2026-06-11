const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

let currentAccessToken = null;

export const setAccessToken = (token) => {
  currentAccessToken = token;
};

export const getAccessToken = () => currentAccessToken;

// Perform silent token rotation
const refreshAccessToken = async () => {
  const url = `${API_URL}/auth/refresh`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include' // Send refresh cookie
  });

  if (!response.ok) {
    throw new Error('Refresh token session invalid or expired');
  }

  const data = await response.json();
  setAccessToken(data.accessToken);
  return data.accessToken;
};

// Main fetch wrapper
export const api = async (endpoint, options = {}) => {
  const url = `${API_URL}${endpoint}`;
  
  // Merge headers
  const headers = { ...options.headers };
  
  // Don't set Content-Type if uploading FormData (browser sets it with boundary automatically)
  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  if (currentAccessToken) {
    headers['Authorization'] = `Bearer ${currentAccessToken}`;
  }

  const config = {
    ...options,
    headers,
    credentials: 'include' // Always pass cookies for session mapping
  };

  let response = await fetch(url, config);

  // Auto token refresh on 401 expiration
  if (response.status === 401 && !options._retry && !endpoint.includes('/auth/login') && !endpoint.includes('/auth/refresh')) {
    options._retry = true;
    try {
      console.log('Access token expired, attempting silent refresh...');
      const newToken = await refreshAccessToken();
      
      // Update config and retry
      config.headers['Authorization'] = `Bearer ${newToken}`;
      response = await fetch(url, config);
    } catch (refreshError) {
      console.error('Silent refresh failed, logging out user...', refreshError.message);
      setAccessToken(null);
      // Fire auth-failed event to notify React app context to redirect
      window.dispatchEvent(new CustomEvent('auth-session-expired'));
      throw new Error('Your session has expired. Please log in again.', { cause: refreshError });
    }
  }

  if (!response.ok) {
    // Attempt to parse server error payload
    let errorData;
    try {
      errorData = await response.json();
    } catch {
      errorData = { message: `HTTP Error: ${response.statusText}` };
    }
    throw new Error(errorData.message || 'An error occurred during request execution.');
  }

  // Handle CSV exports or blank content
  const contentType = response.headers.get('content-type');
  if (contentType && contentType.includes('text/csv')) {
    return response.text();
  }

  // Parse JSON
  try {
    return await response.json();
  } catch {
    return null;
  }
};
export default api;
