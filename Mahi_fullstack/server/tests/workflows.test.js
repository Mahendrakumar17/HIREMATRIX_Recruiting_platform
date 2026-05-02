const express = require('express');
const request = require('supertest');

jest.mock('../src/middleware/auth', () => ({
  protect: (req, _res, next) => {
    req.user = { _id: 'recruiter-1', role: 'Recruiter', name: 'Recruiter User', email: 'rec@test.com' };
    next();
  },
  allowRoles: () => (_req, _res, next) => next(),
}));

jest.mock('../src/models/Job', () => ({
  create: jest.fn(),
  findById: jest.fn(),
}));

jest.mock('../src/models/User', () => ({
  find: jest.fn(),
}));

jest.mock('../src/models/Application', () => ({
  findById: jest.fn(),
}));

jest.mock('../src/services/notificationService', () => ({
  createInAppNotifications: jest.fn(async () => []),
  sendBulkEmail: jest.fn(async () => {}),
}));

const Job = require('../src/models/Job');
const User = require('../src/models/User');
const Application = require('../src/models/Application');

describe('critical workflows', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('job creation validates payload', async () => {
    const app = express();
    app.use(express.json());
    app.use('/api/jobs', require('../src/routes/jobRoutes'));
    const res = await request(app).post('/api/jobs').send({ title: 'SDE' });
    expect(res.statusCode).toBe(400);
  });

  test('job creation broadcasts only to applicants', async () => {
    Job.create.mockResolvedValue({
      _id: 'job-1',
      title: 'Backend Engineer',
      company: 'HireMatrix',
      description: 'Build APIs',
    });
    User.find.mockReturnValue({
      select: jest.fn().mockResolvedValue([{ _id: 'a1', email: 'a@test.com', name: 'A' }]),
    });

    const app = express();
    app.use(express.json());
    app.use('/api/jobs', require('../src/routes/jobRoutes'));
    const res = await request(app).post('/api/jobs').send({
      title: 'Backend Engineer',
      company: 'HireMatrix',
      description: 'Build APIs',
      requirements: [],
    });

    expect(res.statusCode).toBe(201);
    expect(User.find).toHaveBeenCalledWith({ role: 'Applicant', isActive: true });
  });

  test('shortlist endpoint blocks non-owner recruiters', async () => {
    Application.findById.mockReturnValue({
      populate: jest.fn().mockReturnValue({
        populate: jest.fn().mockResolvedValue({
          _id: 'app-1',
          jobId: { postedBy: 'another-recruiter', title: 'Role' },
          applicantId: { _id: 'u1', email: 'u1@test.com' },
          status: 'Applied',
          save: jest.fn(),
        }),
      }),
    });

    const app = express();
    app.use(express.json());
    app.use('/api/applications', require('../src/routes/applicationRoutes'));
    const res = await request(app).patch('/api/applications/app-1/shortlist').send({});
    expect(res.statusCode).toBe(403);
  });
});
