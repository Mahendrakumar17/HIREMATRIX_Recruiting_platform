const express = require('express');
const cors = require('cors');

const buildApp = () => {
  const app = express();
  const configuredOrigins = (process.env.CLIENT_URLS || process.env.CLIENT_URL || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

  const corsOrigin = (origin, cb) => {
    if (!origin) return cb(null, true);
    if (!configuredOrigins.length || configuredOrigins.includes(origin)) return cb(null, true);
    return cb(new Error('CORS origin not allowed'));
  };

  app.use(cors({ origin: corsOrigin, credentials: true }));
  app.use(express.json());
  app.use('/uploads', express.static('uploads'));

  app.get('/api/health', (_, res) => res.json({ ok: true }));
  app.use('/api/auth', require('./routes/authRoutes'));
  app.use('/api/jobs', require('./routes/jobRoutes'));
  app.use('/api/applications', require('./routes/applicationRoutes'));
  app.use('/api/interviews', require('./routes/interviewRoutes'));
  app.use('/api/notifications', require('./routes/notificationRoutes'));
  app.use('/api/admin', require('./routes/adminRoutes'));

  return { app, corsOrigin };
};

module.exports = buildApp;
