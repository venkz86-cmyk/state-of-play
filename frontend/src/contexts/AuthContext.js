import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import axios from 'axios';

const AuthContext = createContext();

const API = process.env.REACT_APP_BACKEND_URL;
const STORAGE_KEY = 'tsop_member';

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Load saved member on mount
  useEffect(() => {
    const savedMember = localStorage.getItem(STORAGE_KEY);
    if (savedMember) {
      try {
        const member = JSON.parse(savedMember);
        setUser(member);
      } catch (e) {
        localStorage.removeItem(STORAGE_KEY);
      }
    }
    setLoading(false);

    // Sticky shared-story attribution: once we land with ?ref=shared-story,
    // remember it for this session so a signup later still credits the nominator.
    try {
      if (new URLSearchParams(window.location.search).get('ref') === 'shared-story') {
        sessionStorage.setItem('tsop_ref_shared', '1');
      }
    } catch (_e) { /* SSR/private-mode guard */ }
  }, []);

  // Verify member status with Ghost via backend
  const verifyMember = useCallback(async (email) => {
    if (!API) {
      throw new Error('Backend not available');
    }
    
    try {
      const response = await axios.post(`${API}/api/ghost/verify-member`, { email });
      const data = response.data;
      
      if (data.is_member) {
        const member = {
          id: data.id || '',           // Ghost member id — used by nominations
          email: data.email,
          name: data.name,
          is_paid: data.is_paid,
          is_free: data.is_member && !data.is_paid,
          status: data.status,
          verified_at: new Date().toISOString()
        };

        // Save to localStorage
        localStorage.setItem(STORAGE_KEY, JSON.stringify(member));
        setUser(member);

        // Conversion attribution: if this verify follows a shared-story visit,
        // ping the backend so we can credit the nominator. Fire-and-forget.
        try {
          const token = sessionStorage.getItem('tsop_referrer_token');
          const fromShared = new URLSearchParams(window.location.search).get('ref') === 'shared-story';
          if (token && (fromShared || sessionStorage.getItem('tsop_ref_shared') === '1')) {
            const eventType = data.is_paid ? 'signup_paid' : 'signup_free';
            fetch(`${API}/api/cold-link/event`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                token_id: token,
                event_type: eventType,
                nominee_email: data.email,
              }),
            }).catch(() => { /* non-fatal */ });
            sessionStorage.removeItem('tsop_referrer_token');
            sessionStorage.removeItem('tsop_ref_shared');
          }
        } catch (_e) { /* non-fatal */ }

        return { success: true, member };
      } else {
        return { 
          success: false, 
          error: data.status === 'not_configured' 
            ? 'Member verification not configured' 
            : 'Email not found. Please subscribe first.'
        };
      }
    } catch (error) {
      throw new Error(error.response?.data?.detail || 'Failed to verify member');
    }
  }, []);

  // Logout - clear saved member
  const logout = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setUser(null);
  }, []);

  // Check if user can access premium content
  const canAccessPremium = user?.is_paid || false;
  const isFreeMember = user?.is_free || false;
  const isLoggedIn = !!user;

  return (
    <AuthContext.Provider value={{ 
      user, 
      loading, 
      verifyMember, 
      logout,
      canAccessPremium,
      isFreeMember,
      isLoggedIn
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};
