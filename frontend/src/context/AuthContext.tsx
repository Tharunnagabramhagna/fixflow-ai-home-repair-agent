import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api } from '../api/client';
import type { AuthUser, AuthStatus, LoginCredentials, RegisterCredentials } from '../types';

interface AuthContextType {
  status: AuthStatus;
  user: AuthUser | null;
  isGuest: boolean;
  error: string | null;
  login: (credentials: LoginCredentials) => Promise<void>;
  register: (credentials: RegisterCredentials) => Promise<void>;
  continueAsGuest: () => void;
  logout: () => Promise<void>;
  refreshSession: () => Promise<void>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [user, setUser] = useState<AuthUser | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refreshSession = useCallback(async () => {
    try {
      setError(null);
      const res = await api.getSession();
      if (res.authenticated && res.user) {
        setUser(res.user);
        setStatus('authenticated');
        if (typeof window !== 'undefined') {
          sessionStorage.removeItem('fixflow_guest');
        }
      } else {
        setUser(null);
        const wasGuest = typeof window !== 'undefined' && sessionStorage.getItem('fixflow_guest') === 'true';
        setStatus(wasGuest ? 'guest' : 'unauthenticated');
      }
    } catch (err: any) {
      console.warn('[FixFlow Auth] Session verification error:', err.message);
      setError(err.message || 'Unable to connect to the FixFlow authentication service.');
      setUser(null);
      const wasGuest = typeof window !== 'undefined' && sessionStorage.getItem('fixflow_guest') === 'true';
      setStatus(wasGuest ? 'guest' : 'error');
    }
  }, []);

  useEffect(() => {
    refreshSession();
  }, [refreshSession]);

  const login = async (credentials: LoginCredentials) => {
    try {
      setStatus('loading');
      setError(null);
      const res = await api.login(credentials);
      if (res.authenticated && res.user) {
        setUser(res.user);
        setStatus('authenticated');
        if (typeof window !== 'undefined') {
          sessionStorage.removeItem('fixflow_guest');
        }
      } else {
        throw new Error('Sign-in failed. Please verify your credentials.');
      }
    } catch (err: any) {
      setError(err.message || 'Invalid email or password.');
      setUser(null);
      setStatus('unauthenticated');
      throw err;
    }
  };

  const register = async (credentials: RegisterCredentials) => {
    try {
      setStatus('loading');
      setError(null);
      const res = await api.register(credentials);
      if (res.authenticated && res.user) {
        setUser(res.user);
        setStatus('authenticated');
        if (typeof window !== 'undefined') {
          sessionStorage.removeItem('fixflow_guest');
        }
      } else {
        throw new Error('Registration could not be completed.');
      }
    } catch (err: any) {
      setError(err.message || 'Registration failed.');
      setUser(null);
      setStatus('unauthenticated');
      throw err;
    }
  };

  const continueAsGuest = () => {
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('fixflow_guest', 'true');
    }
    setUser(null);
    setStatus('guest');
    setError(null);
  };

  const logout = async () => {
    try {
      await api.logout();
    } catch (err) {
      console.warn('[FixFlow Auth] Logout error (proceeding to clear local state):', err);
    } finally {
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem('fixflow_guest');
      }
      setUser(null);
      setStatus('unauthenticated');
      setError(null);
    }
  };

  const clearError = () => setError(null);

  const isGuest = status === 'guest';

  return (
    <AuthContext.Provider
      value={{
        status,
        user,
        isGuest,
        error,
        login,
        register,
        continueAsGuest,
        logout,
        refreshSession,
        clearError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
