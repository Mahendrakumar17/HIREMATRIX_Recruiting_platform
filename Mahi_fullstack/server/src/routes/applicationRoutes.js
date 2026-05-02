const express = require('express');
const Application = require('../models/Application');
const Job = require('../models/Job');
const User = require('../models/User');
const upload = require('../middleware/upload');
const { protect, allowRoles } = require('../middleware/auth');
const { validateStatusUpdatePayload, validateRejectPayload } = require('../middleware/validators');
const { createInAppNotifications, sendBulkEmail } = require('../services/notificationService');
const {
  buildApplicationSubmittedTemplate,
  buildRejectedTemplate,
  buildShortlistedTemplate,
  buildInterviewScheduledTemplate,
} = require('../utils/emailTemplates');

const router = express.Router();

const ALLOWED_STATUS = ['Applied', 'Under Review', 'Shortlisted', 'Rejected', 'Interview Scheduled', 'Selected', 'Not Shortlisted'];
const STATUS_TRANSITIONS = {
  Applied: ['Under Review', 'Shortlisted', 'Rejected', 'Not Shortlisted'],
  'Under Review': ['Shortlisted', 'Rejected', 'Interview Scheduled', 'Not Shortlisted'],
  Shortlisted: ['Interview Scheduled', 'Rejected', 'Selected'],
  'Interview Scheduled': ['Selected', 'Rejected'],
  Selected: [],
  Rejected: [],
  'Not Shortlisted': [],
};

const ensureStatusTransition = (currentStatus, nextStatus) => STATUS_TRANSITIONS[currentStatus]?.includes(nextStatus);

const canViewJobApplications = (user, job) => {
  if (user.role === 'Admin') return true;
  if (user.role === 'Recruiter' || user.role === 'HR') return String(job.postedBy) === String(user._id);
  if (user.role === 'HiringManager') {
    return (job.assignedHiringManagers || []).some((hm) => String(hm) === String(user._id));
  }
  return false;
};

const ensureApplicationOwnerAccess = (reqUser, application) => {
  if (reqUser.role === 'Recruiter' && String(application.jobId.postedBy) !== String(reqUser._id)) {
    return 'Recruiters can update applications only on their own jobs';
  }
  if (reqUser.role === 'HiringManager') {
    return 'Hiring managers cannot directly change application status';
  }
  return null;
};

const notifyApplicantStatusChange = async ({ app, status, reason, actionBy }) => {
  const statusMessageMap = {
    'Under Review': `Your application for ${app.jobId.title} is now Under Review.`,
    Shortlisted: `You have been shortlisted for ${app.jobId.title}.`,
    Rejected: `Your application for ${app.jobId.title} was not selected for the next stage.`,
    'Interview Scheduled': `Your interview for ${app.jobId.title} has been scheduled.`,
    Selected: `Congratulations! You have been selected for ${app.jobId.title}.`,
    'Not Shortlisted': `Your application for ${app.jobId.title} is marked as not shortlisted.`,
    Applied: `Your application for ${app.jobId.title} has been submitted.`,
  };

  await createInAppNotifications({
    userIds: [app.applicantId._id],
    title: 'Application Update',
    message: statusMessageMap[status] || `Your application for ${app.jobId.title} is now ${status}.`,
    meta: {
      type: 'application_status_updated',
      entityType: 'Application',
      entityId: app._id,
      actionBy,
    },
  });

  const templateByStatus = {
    Shortlisted: () => buildShortlistedTemplate({ jobTitle: app.jobId.title }),
    Rejected: () => buildRejectedTemplate({ jobTitle: app.jobId.title, reason }),
    'Interview Scheduled': () => buildInterviewScheduledTemplate({ jobTitle: app.jobId.title, when: 'as communicated by the hiring team' }),
    Applied: () => buildApplicationSubmittedTemplate({ jobTitle: app.jobId.title }),
  };

  const fallback = {
    subject: 'HireMatrix application update',
    text: statusMessageMap[status] || `Status changed to ${status}`,
    html: `<p>${statusMessageMap[status] || `Status changed to ${status}`}</p>`,
  };

  await sendBulkEmail({
    recipients: [{ email: app.applicantId.email }],
    templateBuilder: () => (templateByStatus[status] ? templateByStatus[status]() : fallback),
    payload: {},
  });
};

router.post('/', protect, allowRoles('Applicant'), upload.single('resume'), async (req, res) => {
  const { jobId } = req.body;
  const job = await Job.findById(jobId);
  if (!job) return res.status(404).json({ message: 'Job not found' });
  if (job.deadline && new Date(job.deadline).getTime() < Date.now()) {
    return res.status(400).json({ message: 'Application deadline has passed for this job' });
  }
  const existingApplication = await Application.findOne({ jobId, applicantId: req.user._id }).select('_id status');
  if (existingApplication) {
    return res.status(409).json({
      message: `You have already applied for this job. Current status: ${existingApplication.status}`,
      status: existingApplication.status,
      applicationId: existingApplication._id,
    });
  }

  let app;
  try {
    app = await Application.create({
      jobId,
      applicantId: req.user._id,
      resume: req.file ? req.file.path : 'manual-resume',
    });
  } catch (error) {
    // Protect against race condition duplicate inserts on rapid repeated clicks.
    if (error?.code === 11000) {
      const duplicate = await Application.findOne({ jobId, applicantId: req.user._id }).select('_id status');
      return res.status(409).json({
        message: `You have already applied for this job. Current status: ${duplicate?.status || 'Applied'}`,
        status: duplicate?.status || 'Applied',
        applicationId: duplicate?._id,
      });
    }
    throw error;
  }
  const hiringTeam = await User.find({ role: { $in: ['Recruiter', 'HR', 'Admin'] }, isActive: true }).select('_id email');
  const jobData = await Job.findById(jobId).select('title');
  const teamMessage = `${req.user.name} applied for ${jobData?.title || 'a role'}.`;

  await createInAppNotifications({
    userIds: hiringTeam.map((member) => member._id),
    title: 'New Application',
    message: teamMessage,
    meta: { type: 'application_submitted', entityType: 'Application', entityId: app._id, actionBy: req.user._id },
  });

  await sendBulkEmail({
    recipients: hiringTeam,
    templateBuilder: () => ({ subject: 'HireMatrix new application', text: teamMessage, html: `<p>${teamMessage}</p>` }),
    payload: {},
  });
  await sendBulkEmail({
    recipients: [{ email: req.user.email }],
    templateBuilder: () => buildApplicationSubmittedTemplate({ jobTitle: jobData?.title || 'the role' }),
    payload: {},
  });

  res.status(201).json(app);
});

router.get('/', protect, async (req, res) => {
  const query = req.user.role === 'Applicant' ? { applicantId: req.user._id } : {};
  if (req.user.role === 'Recruiter' || req.user.role === 'HR') {
    const ownJobs = await Job.find({ postedBy: req.user._id }).select('_id');
    query.jobId = { $in: ownJobs.map((j) => j._id) };
  }
  if (req.user.role === 'HiringManager') {
    const assignedJobs = await Job.find({ assignedHiringManagers: req.user._id }).select('_id');
    query.jobId = { $in: assignedJobs.map((j) => j._id) };
  }
  if (req.query.jobId && req.user.role !== 'Applicant') {
    const job = await Job.findById(req.query.jobId).select('postedBy assignedHiringManagers');
    if (!job) return res.status(404).json({ message: 'Job not found' });
    if (!canViewJobApplications(req.user, job)) {
      return res.status(403).json({ message: 'Not authorized to view applicants for this job' });
    }
    query.jobId = req.query.jobId;
  }
  if (req.query.status) query.status = req.query.status;
  if (req.query.applicantId && req.user.role !== 'Applicant') query.applicantId = req.query.applicantId;
  const apps = await Application.find(query)
    .populate('jobId', 'title company')
    .populate('applicantId', 'name email role')
    .sort({ createdAt: -1 });
  res.json(apps);
});

router.patch('/:id/status', protect, allowRoles('Recruiter', 'HR', 'HiringManager', 'Admin'), validateStatusUpdatePayload, async (req, res) => {
  const { status, notes } = req.body;
  if (!ALLOWED_STATUS.includes(status)) {
    return res.status(400).json({ message: 'Invalid status value' });
  }
  const current = await Application.findById(req.params.id).populate('jobId');
  if (!current) return res.status(404).json({ message: 'Application not found' });
  const ownerError = ensureApplicationOwnerAccess(req.user, current);
  if (ownerError) return res.status(403).json({ message: ownerError });

  const allowedByRole = {
    Recruiter: ['Under Review', 'Shortlisted', 'Not Shortlisted', 'Rejected', 'Interview Scheduled'],
    HR: ['Under Review', 'Selected', 'Not Shortlisted', 'Rejected', 'Interview Scheduled'],
    Admin: ['Applied', 'Under Review', 'Shortlisted', 'Not Shortlisted', 'Rejected', 'Interview Scheduled', 'Selected'],
  };
  if (!allowedByRole[req.user.role]?.includes(status)) {
    return res.status(403).json({ message: `Role ${req.user.role} cannot set status to ${status}` });
  }
  if (!ensureStatusTransition(current.status, status) && current.status !== status) {
    return res.status(400).json({ message: `Invalid transition from ${current.status} to ${status}` });
  }

  const app = await Application.findByIdAndUpdate(
    req.params.id,
    { status, notes, statusUpdatedAt: new Date(), statusUpdatedBy: req.user._id },
    { returnDocument: 'after' }
  ).populate('jobId').populate('applicantId');
  if (!app) return res.status(404).json({ message: 'Application not found' });

  await notifyApplicantStatusChange({ app, status, reason: notes, actionBy: req.user._id });
  res.json(app);
});

router.patch('/:id/shortlist', protect, allowRoles('Recruiter', 'HR', 'Admin'), async (req, res) => {
  const current = await Application.findById(req.params.id).populate('jobId').populate('applicantId');
  if (!current) return res.status(404).json({ message: 'Application not found' });
  const ownerError = ensureApplicationOwnerAccess(req.user, current);
  if (ownerError) return res.status(403).json({ message: ownerError });
  if (!ensureStatusTransition(current.status, 'Shortlisted') && current.status !== 'Shortlisted') {
    return res.status(400).json({ message: `Invalid transition from ${current.status} to Shortlisted` });
  }

  current.status = 'Shortlisted';
  current.statusUpdatedAt = new Date();
  current.statusUpdatedBy = req.user._id;
  current.statusReason = '';
  await current.save();
  await notifyApplicantStatusChange({ app: current, status: 'Shortlisted', actionBy: req.user._id });
  res.json(current);
});

router.patch('/:id/reject', protect, allowRoles('Recruiter', 'HR', 'Admin'), validateRejectPayload, async (req, res) => {
  const { reason = '' } = req.body;
  if (typeof reason !== 'string') return res.status(400).json({ message: 'Reason must be text' });
  const current = await Application.findById(req.params.id).populate('jobId').populate('applicantId');
  if (!current) return res.status(404).json({ message: 'Application not found' });
  const ownerError = ensureApplicationOwnerAccess(req.user, current);
  if (ownerError) return res.status(403).json({ message: ownerError });
  if (!ensureStatusTransition(current.status, 'Rejected') && current.status !== 'Rejected') {
    return res.status(400).json({ message: `Invalid transition from ${current.status} to Rejected` });
  }

  current.status = 'Rejected';
  current.statusUpdatedAt = new Date();
  current.statusUpdatedBy = req.user._id;
  current.statusReason = reason.trim();
  await current.save();
  await notifyApplicantStatusChange({ app: current, status: 'Rejected', reason: current.statusReason, actionBy: req.user._id });
  res.json(current);
});

router.post('/:id/comments', protect, allowRoles('Recruiter', 'HR', 'HiringManager', 'Admin'), async (req, res) => {
  const { message } = req.body;
  if (!message?.trim()) return res.status(400).json({ message: 'Comment is required' });
  const app = await Application.findById(req.params.id).populate('jobId', 'title postedBy assignedHiringManagers');
  if (!app) return res.status(404).json({ message: 'Application not found' });
  if (req.user.role === 'Recruiter' && String(app.jobId.postedBy) !== String(req.user._id)) {
    return res.status(403).json({ message: 'Recruiters can comment only on their own jobs' });
  }
  if (
    req.user.role === 'HiringManager' &&
    !app.jobId.assignedHiringManagers.some((hm) => String(hm) === String(req.user._id))
  ) {
    return res.status(403).json({ message: 'Not assigned to this job as hiring manager' });
  }

  app.comments.push({
    authorId: req.user._id,
    authorRole: req.user.role,
    message: message.trim(),
  });
  await app.save();

  await createInAppNotifications({
    userIds: [app.applicantId],
    title: 'Hiring Team Update',
    message: `Team added notes for your ${app.jobId?.title || 'application'}.`,
    meta: { type: 'application_comment', entityType: 'Application', entityId: app._id, actionBy: req.user._id },
  });
  res.json(app);
});

module.exports = router;

