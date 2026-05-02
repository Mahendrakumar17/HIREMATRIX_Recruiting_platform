const express = require('express');
const Job = require('../models/Job');
const User = require('../models/User');
const { createInAppNotifications, sendBulkEmail } = require('../services/notificationService');
const { buildNewJobPostedTemplate } = require('../utils/emailTemplates');
const { protect, allowRoles } = require('../middleware/auth');
const { validateJobPayload } = require('../middleware/validators');

const router = express.Router();

router.get('/', protect, async (req, res) => {
  const query = {};
  if (req.user.role === 'Recruiter' || req.user.role === 'HR') {
    query.postedBy = req.user._id;
  } else if (req.user.role === 'HiringManager') {
    query.assignedHiringManagers = req.user._id;
  }
  const jobs = await Job.find(query).populate('postedBy', 'name role').populate('assignedHiringManagers', 'name email').sort({ createdAt: -1 });
  res.json(jobs);
});

router.post('/', protect, allowRoles('Recruiter', 'HR', 'Admin'), validateJobPayload, async (req, res) => {
  const payload = {
    ...req.body,
    postedBy: req.user._id,
    requirements: (req.body.requirements || []).filter(Boolean),
    assignedHiringManagers: req.body.assignedHiringManagers || [],
  };
  const job = await Job.create(payload);
  const activeApplicants = await User.find({ role: 'Applicant', isActive: true }).select('_id email name');
  const applyLink = `${process.env.CLIENT_BASE_URL || process.env.CLIENT_URL || 'http://localhost:5173'}/dashboard/jobs`;
  const shortDescription = (job.description || '').slice(0, 160);
  const message = `New job posted: ${job.title} at ${job.company}. ${shortDescription}`;

  await createInAppNotifications({
    userIds: activeApplicants.map((user) => user._id),
    title: 'New Job Posted',
    message,
    meta: { type: 'new_job_posted', entityType: 'Job', entityId: job._id, actionBy: req.user._id },
  });

  sendBulkEmail({
    recipients: activeApplicants,
    templateBuilder: ({ job: jobPayload, applyLink: jobApplyLink }) =>
      buildNewJobPostedTemplate({ job: jobPayload, applyLink: jobApplyLink }),
    payload: { job, applyLink },
  }).catch((error) => console.error('Job broadcast email failed:', error.message));

  res.status(201).json(job);
});

router.put('/:id', protect, allowRoles('Recruiter', 'HR', 'Admin'), async (req, res) => {
  const existing = await Job.findById(req.params.id);
  if (!existing) return res.status(404).json({ message: 'Job not found' });
  if (req.user.role === 'Recruiter' && String(existing.postedBy) !== String(req.user._id)) {
    return res.status(403).json({ message: 'Recruiters can update only their own jobs' });
  }
  const job = await Job.findByIdAndUpdate(req.params.id, req.body, { returnDocument: 'after' });
  res.json(job);
});

router.delete('/:id', protect, allowRoles('Recruiter', 'HR', 'Admin'), async (req, res) => {
  const existing = await Job.findById(req.params.id);
  if (!existing) return res.status(404).json({ message: 'Job not found' });
  if (req.user.role === 'Recruiter' && String(existing.postedBy) !== String(req.user._id)) {
    return res.status(403).json({ message: 'Recruiters can delete only their own jobs' });
  }
  await existing.deleteOne();
  res.json({ message: 'Job deleted' });
});

module.exports = router;

