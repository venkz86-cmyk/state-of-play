import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { getAdminSessionToken, setAdminSessionToken, adminAuthHeader } from '../lib/adminSessionToken';

const AdminAuthContext = createContext();

// Deliberately its own small context, not an extension of AuthContext.js's
// reader session -- the two are cryptographically separate on the backend
// (admin_auth.py's own secret + JWT audience) and should stay separate
// here too, so there's no code path that could ever conflate them.
export const AdminAuthProvider = ({ children }) => {
  const [adminEmail, setAdminEmail] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkSession = async () => {
      if (!getAdminSessionToken()) {
        setAdminEmail(null);
        setLoading(false);
        return;
      }
      try {
        const res = await fetch('/api/admin/auth/me', { headers: { ...adminAuthHeader() } });
        if (res.ok) {
          const data = await res.json();
          setAdminEmail(data.email);
        } else {
          setAdminSessionToken('');
          setAdminEmail(null);
        }
      } catch (_e) {
        setAdminEmail(null);
      } finally {
        setLoading(false);
      }
    };
    checkSession();
  }, []);

  const requestCode = useCallback(async (email) => {
    try {
      const res = await fetch('/api/admin/auth/request-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        return { success: false, error: data.detail || 'Could not send a sign-in code.' };
      }
      return { success: true };
    } catch (_e) {
      throw new Error('Could not reach the server. Please try again.');
    }
  }, []);

  const verifyCode = useCallback(async (email, code) => {
    let data;
    try {
      const res = await fetch('/api/admin/auth/verify-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code }),
      });
      data = await res.json().catch(() => ({}));
      if (!res.ok) {
        return { success: false, error: data.detail || 'Incorrect code. Please try again.' };
      }
    } catch (_e) {
      throw new Error('Could not reach the server. Please try again.');
    }

    setAdminSessionToken(data.admin_session_token || '');
    setAdminEmail(data.email);
    return { success: true };
  }, []);

  const logout = useCallback(async () => {
    fetch('/api/admin/auth/logout', { method: 'POST', headers: { ...adminAuthHeader() } }).catch(() => {});
    setAdminSessionToken('');
    setAdminEmail(null);
  }, []);

  return (
    <AdminAuthContext.Provider value={{
      adminEmail,
      isAdminLoggedIn: !!adminEmail,
      loading,
      requestCode,
      verifyCode,
      logout,
    }}>
      {children}
    </AdminAuthContext.Provider>
  );
};

export const useAdminAuth = () => {
  const context = useContext(AdminAuthContext);
  if (!context) {
    throw new Error('useAdminAuth must be used within AdminAuthProvider');
  }
  return context;
};
