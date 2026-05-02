import { createContext, useContext, useEffect, useState } from 'react';
import api from './api';

const AuthContext = createContext({ user: null, login: async () => {}, register: async () => {}, logout: () => {} });

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) api.get('/auth/me').then((r) => setUser(r.data)).catch(() => localStorage.removeItem('token'));
  }, []);

  const login = async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password });
    localStorage.setItem('token', data.token);
    setUser(data.user);
  };

  const register = async (payload) => {
    const form = new FormData();
    Object.entries(payload).forEach(([key, value]) => {
      if (value === undefined || value === null || value === '') return;
      if (key === 'resume' && value instanceof File) form.append('resume', value);
      else form.append(key, String(value));
    });
    const { data } = await api.post('/auth/register', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    if (data?.token) {
      localStorage.setItem('token', data.token);
      setUser(data.user);
    }
    return data;
  };

  const logout = () => {
    localStorage.removeItem('token');
    setUser(null);
  };

  return <AuthContext.Provider value={{ user, login, register, logout }}>{children}</AuthContext.Provider>;
};

export const useAuth = () => useContext(AuthContext);
