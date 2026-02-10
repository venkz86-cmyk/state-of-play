import { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

const AuthContext = createContext();

const API = process.env.REACT_APP_BACKEND_URL;

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      // Check if user has Ghost session via our backend proxy
      const response = await axios.get(`${API}/api/ghost/member`, {
        withCredentials: true
      });
      
      if (response.data) {
        setUser({
          ...response.data,
          is_subscriber: response.data.paid || false
        });
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
        `${API}/api/ghost/send-magic-link`,
        { email }
      );
      return { success: true };
    } catch (error) {
      throw new Error(error.response?.data?.detail || 'Failed to send magic link');
    }
  };

  const logout = async () => {
    // Clear user state
    setUser(null);
    // Redirect to home
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
