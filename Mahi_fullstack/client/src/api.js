import axios from 'axios';

const host = window.location.hostname;
const api = axios.create({ baseURL: `http://${host}:5001/api` });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export const shortlistApplication = (id) => api.patch(`/applications/${id}/shortlist`);
export const rejectApplication = (id, reason) => api.patch(`/applications/${id}/reject`, { reason });

export default api;
