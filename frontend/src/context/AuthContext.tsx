import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api } from '../api/client';
import type { AuthUser, AuthStatus } from '../types';

interface AuthContextType {
  status: AuthStatus;
  user: AuthUser | null;
  error: string | null;
  loginDemo: () => Promise<void>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<void>;
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
      } else {
        setUser(null);
        setStatus('unauthenticated');
      }
    } catch (err: any) {
      console.warn('[FixFlow Auth] Session verification error:', err.message);
      setError(err.message || 'Failed to verify session status with backend server.');
      setUser(null);
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    refreshSession();
  }, [refreshSession]);

  const loginDemo = async () => {
    try {
      setStatus('loading');
      setError(null);
      const res = await api.loginDemo();
      if (res.authenticated && res.user) {
        setUser(res.user);
        setStatus('authenticated');
      } else {
        throw new Error('Failed to create demo session');
      }
    } catch (err: any) {
      console.error('[FixFlow Auth] Demo login error:', err);
      setError(err.message || 'Failed to initiate demo session.');
      setStatus('unauthenticated');
      throw err;
    }
  };

  const logout = async () => {
    try {
      await api.logout();
    } catch (err) {
      console.warn('[FixFlow Auth] Logout error (proceeding to clear local state):', err);
    } finally {
      setUser(null);
      setStatus('unauthenticated');
    }
  };

  return (
    <AuthContext.Provider
      value={{
        status,
        user,
        error,
        loginDemo,
        logout,
        refreshSession,
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
