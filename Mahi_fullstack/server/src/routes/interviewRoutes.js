const express = require('express');
const Interview = require('../models/Interview');
const Application = require('../models/Application');
const Notification = require('../models/Notification');
const User = require('../models/User');
const Job = require('../models/Job');
const { protect, allowRoles } = require('../middleware/auth');
const { emitToUsers } = require('../sockets/socket');
const { sendMail } = require('../utils/mailer');

const router = express.Router();

router.get('/', protect, async (req, res) => {
  const query = {};
  if (req.user.role === 'Applicant') {
    const apps = await Application.find({ applicantId: req.user._id }).select('_id');
    query.applicationId = { $in: apps.map((a) => a._id) };
  } else if (req.user.role === 'Recruiter') {
    const ownJobs = await Job.find({ postedBy: req.user._id }).select('_id');
    const apps = await Application.find({ jobId: { $in: ownJobs.map((j) => j._id) } }).select('_id');
    query.applicationId = { $in: apps.map((a) => a._id) };
  } else if (req.user.role === 'HiringManager') {
    const assignedJobs = await Job.find({ assignedHiringManagers: req.user._id }).select('_id');
    const apps = await Application.find({ jobId: { $in: assignedJobs.map((j) => j._id) } }).select('_id');
    query.applicationId = { $in: apps.map((a) => a._id) };
  }

  const interviews = await Interview.find(query).populate({ path: 'applicationId', populate: [{ path: 'applicantId', select: 'name email' }, { path: 'jobId', select: 'title postedBy assignedHiringManagers' }] }).populate('interviewerId', 'name role').sort({ scheduledDate: 1 });
  res.json(interviews);
});

router.post('/', protect, allowRoles('Recruiter', 'HR', 'HiringManager', 'Admin'), async (req, res) => {
  const { applicationId, interviewerId, scheduledDate } = req.body;
  const appRecord = await Application.findById(applicationId).populate('jobId');
  if (!appRecord) return res.status(404).json({ message: 'Application not found' });
  if (req.user.role === 'Recruiter' && String(appRecord.jobId.postedBy) !== String(req.user._id)) {
    return res.status(403).json({ message: 'Recruiters can schedule only for their own jobs' });
  }
  const interview = await Interview.create({ applicationId, interviewerId, scheduledDate });
  const app = await Application.findById(applicationId).populate('applicantId').populate('jobId');
  app.status = 'Interview Scheduled';
  await app.save();
  const msg = `Interview scheduled for ${app.jobId.title} on ${new Date(scheduledDate).toLocaleString()}.`;
  const note = await Notification.create({ userId: app.applicantId._id, title: 'Interview Scheduled', message: msg });
  const hiringTeam = await User.find({ role: { $in: ['Recruiter', 'HR', 'HiringManager', 'Admin'] }, isActive: true }).select('_id');
  emitToUsers([app.applicantId._id, ...hiringTeam.map((u) => u._id)], 'notification:new', note);
  await sendMail({ to: app.applicantId.email, subject: 'HireMatrix interview schedule', text: msg });
  res.status(201).json(interview);
});

router.patch('/:id', protect, allowRoles('HiringManager', 'HR', 'Admin'), async (req, res) => {
  const { feedback, result } = req.body;
  const existing = await Interview.findById(req.params.id).populate({
    path: 'applicationId',
    populate: [{ path: 'jobId', select: 'assignedHiringManagers' }],
  });
  if (!existing) return res.status(404).json({ message: 'Interview not found' });
  if (
    req.user.role === 'HiringManager' &&
    !existing.applicationId?.jobId?.assignedHiringManagers?.some((hm) => String(hm) === String(req.user._id))
  ) {
    return res.status(403).json({ message: 'Hiring manager not assigned to this job' });
  }

  const updated = await Interview.findByIdAndUpdate(req.params.id, { feedback, result }, { returnDocument: 'after' }).populate({
    path: 'applicationId',
    populate: [{ path: 'applicantId' }, { path: 'jobId', select: 'title' }],
  });

  const msg = `Interview feedback submitted for ${updated.applicationId?.jobId?.title || 'your application'} with result: ${result}.`;
  const note = await Notification.create({
    userId: updated.applicationId?.applicantId?._id,
    title: 'Interview Feedback Update',
    message: msg,
  });
  const hiringTeam = await User.find({ role: { $in: ['Recruiter', 'HR', 'HiringManager', 'Admin'] }, isActive: true }).select('_id');
  emitToUsers([updated.applicationId?.applicantId?._id, ...hiringTeam.map((u) => u._id)], 'notification:new', note);
  res.json(updated);
});

module.exports = router;

