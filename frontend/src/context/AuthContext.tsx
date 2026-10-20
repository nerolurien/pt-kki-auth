import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { User, UserProfileResponse } from '../types';
import apiClient from '../api/client';

export interface SessionNotification {
  title: string;
  reasonText: string;
  reasonCode: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isLoading: boolean;
  sessionNotification: SessionNotification | null;
  clearSessionNotification: () => void;
  login: (token: string, user: User) => void;
  logout: () => Promise<void>;
  logoutAll: () => Promise<void>;
  refreshUser: () => Promise<UserProfileResponse | null>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('auth_token'));
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('auth_user');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return null;
      }
    }
    return null;
  });
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [sessionNotification, setSessionNotification] = useState<SessionNotification | null>(null);

  const clearSessionNotification = () => setSessionNotification(null);

  const login = (newToken: string, newUser: User) => {
    localStorage.setItem('auth_token', newToken);
    localStorage.setItem('auth_user', JSON.stringify(newUser));
    setToken(newToken);
    setUser(newUser);
    setSessionNotification(null);
  };

  const logout = async () => {
    try {
      if (token) {
        await apiClient.post('/auth/logout');
      }
    } catch (err) {
      console.warn('Logout network error (local session cleared anyway):', err);
    } finally {
      localStorage.removeItem('auth_token');
      localStorage.removeItem('auth_user');
      setToken(null);
      setUser(null);
    }
  };

  const logoutAll = async () => {
    try {
      if (token) {
        await apiClient.post('/auth/logout-all');
      }
    } catch (err) {
      console.warn('Logout-all network error (local session cleared anyway):', err);
    } finally {
      localStorage.removeItem('auth_token');
      localStorage.removeItem('auth_user');
      setToken(null);
      setUser(null);
    }
  };

  const refreshUser = useCallback(async (): Promise<UserProfileResponse | null> => {
    const currentToken = localStorage.getItem('auth_token');
    if (!currentToken) {
      setUser(null);
      setIsLoading(false);
      return null;
    }

    try {
      const response = await apiClient.get<UserProfileResponse>('/users/me');
      const updatedUser = response.data.user;
      setUser(updatedUser);
      localStorage.setItem('auth_user', JSON.stringify(updatedUser));
      return response.data;
    } catch {
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (token) {
      refreshUser();
    } else {
      setIsLoading(false);
    }

    const handleSessionExpired = (e: Event) => {
      const customEvent = e as CustomEvent<{ title?: string; reasonText?: string; reasonCode?: string; message?: string }>;
      setToken(null);
      setUser(null);
      setSessionNotification({
        title: customEvent.detail?.title || 'Sesi Diakhiri',
        reasonText: customEvent.detail?.reasonText || customEvent.detail?.message || 'Sesi Anda telah kedaluwarsa atau diputus dari perangkat lain.',
        reasonCode: customEvent.detail?.reasonCode || 'session_expired',
      });
    };

    window.addEventListener('auth:session_expired', handleSessionExpired);
    return () => {
      window.removeEventListener('auth:session_expired', handleSessionExpired);
    };
  }, [token, refreshUser]);

  const value: AuthContextType = {
    user,
    token,
    isAuthenticated: !!token && !!user,
    isAdmin: user?.role === 'admin',
    isLoading,
    sessionNotification,
    clearSessionNotification,
    login,
    logout,
    logoutAll,
    refreshUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
