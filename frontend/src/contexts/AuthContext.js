import { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

const AuthContext = createContext();

const GHOST_URL = process.env.REACT_APP_GHOST_URL;

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      // Check if user has Ghost session cookie
      const response = await axios.get(`${GHOST_URL}/members/api/member/`, {
        withCredentials: true
      });
      
      if (response.data) {
        setUser(response.data);
      }
    } catch (error) {
      // Not logged in
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const sendMagicLink = async (email) => {
    try {
      const response = await axios.post(
        `${GHOST_URL}/members/api/send-magic-link/`,
        { email, emailType: 'signin' },
        { withCredentials: true }
      );
      return { success: true };
    } catch (error) {
      throw new Error(error.response?.data?.errors?.[0]?.message || 'Failed to send magic link');
    }
  };

  const logout = async () => {
    // Clear Ghost session
    setUser(null);
    // Optionally call Ghost logout endpoint
    window.location.href = '/';
  };

  return (
    <AuthContext.Provider value={{ user, loading, sendMagicLink, logout, checkAuth }}>
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
