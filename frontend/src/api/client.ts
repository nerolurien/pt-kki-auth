import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080/api';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('auth_token');
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      const currentPath = window.location.pathname;
      const isAuthPage = currentPath.includes('/login') || currentPath.includes('/register');

      if (!isAuthPage) {
        localStorage.removeItem('auth_token');
        localStorage.removeItem('auth_user');

        const title = error.response.data?.error || 'Sesi Diakhiri';
        const reasonText = error.response.data?.reason_text || 'Sesi Anda telah kedaluwarsa atau diputus dari perangkat lain.';
        const reasonCode = error.response.data?.reason_code || 'session_expired';

        window.dispatchEvent(
          new CustomEvent('auth:session_expired', {
            detail: { 
              title,
              reasonText,
              reasonCode,
            },
          })
        );
      }
    }
    return Promise.reject(error);
  }
);

export default apiClient;
