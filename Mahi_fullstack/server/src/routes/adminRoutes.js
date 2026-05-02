const express = require('express');
const User = require('../models/User');
const Job = require('../models/Job');
const Application = require('../models/Application');
const Notification = require('../models/Notification');
const Interview = require('../models/Interview');
const { protect, allowRoles } = require('../middleware/auth');
const { emitToUsers } = require('../sockets/socket');
const { sendMail } = require('../utils/mailer');

const router = express.Router();

router.get('/users', protect, allowRoles('Admin'), async (req, res) => res.json(await User.find().select('-password')));
router.patch('/users/:id', protect, allowRoles('Admin'), async (req, res) => {
  const target = await User.findById(req.params.id);
  if (!target) return res.status(404).json({ message: 'User not found' });
  if (String(target._id) === String(req.user._id) && req.body.isActive === false) {
    return res.status(400).json({ message: 'Admin cannot deactivate own account' });
  }
  if (req.body.role === 'Admin' && target.role !== 'Admin') {
    return res.status(403).json({ message: 'Creating new admin accounts is disabled' });
  }
  if (req.body.isActive === false) {
    const postedJobs = await Job.find({ postedBy: target._id }).select('_id');
    const postedJobIds = postedJobs.map((job) => job._id);
    const appsFromPostedJobs = await Application.find({ jobId: { $in: postedJobIds } }).select('_id');
    const appsFromApplicant = await Application.find({ applicantId: target._id }).select('_id');
    const appIds = [...new Set([...appsFromPostedJobs, ...appsFromApplicant].map((item) => String(item._id)))];

    if (postedJobIds.length) {
      await Job.deleteMany({ _id: { $in: postedJobIds } });
    }
    if (appIds.length) {
      await Interview.deleteMany({ applicationId: { $in: appIds } });
      await Application.deleteMany({ _id: { $in: appIds } });
    }
    await Interview.deleteMany({ interviewerId: target._id });
    await Notification.deleteMany({ userId: target._id });
    await User.deleteOne({ _id: target._id });
    return res.json({ message: 'User deactivated and removed from database', deleted: true });
  }
  return res.json(await User.findByIdAndUpdate(req.params.id, req.body, { returnDocument: 'after' }).select('-password'));
});

router.get('/pending-users', protect, allowRoles('Admin'), async (req, res) => {
  const users = await User.find({
    role: { $in: ['Recruiter', 'HR', 'HiringManager'] },
    approvalStatus: 'Pending',
  }).select('-password');
  res.json(users);
});

router.patch('/users/:id/approval', protect, allowRoles('Admin'), async (req, res) => {
  const { approvalStatus, rejectionReason } = req.body;
  if (!['Approved', 'Rejected'].includes(approvalStatus)) {
    return res.status(400).json({ message: 'approvalStatus must be Approved or Rejected' });
  }

  const user = await User.findById(req.params.id);
  if (!user) return res.status(404).json({ message: 'User not found' });
  if (!['Recruiter', 'HR', 'HiringManager'].includes(user.role)) {
    return res.status(400).json({ message: 'Only recruiter/HR/hiring manager accounts require approval' });
  }

  user.approvalStatus = approvalStatus;
  user.companyVerified = approvalStatus === 'Approved';
  user.approvedBy = req.user._id;
  user.approvedAt = new Date();
  user.rejectionReason = approvalStatus === 'Rejected' ? rejectionReason || 'Company verification failed' : undefined;
  await user.save();

  const message = approvalStatus === 'Approved'
    ? 'Your account has been approved after company verification. You can now login.'
    : `Your account request has been rejected${user.rejectionReason ? `: ${user.rejectionReason}` : '.'}`;

  const note = await Notification.create({
    userId: user._id,
    title: 'Account Verification Update',
    message,
  });
  emitToUsers([user._id], 'notification:new', note);
  await sendMail({ to: user.email, subject: 'HireMatrix account verification update', text: message });

  res.json({ message: 'Approval status updated', user: await User.findById(user._id).select('-password') });
});

router.get('/report', protect, allowRoles('Admin', 'HR'), async (_, res) => {
  const [users, jobs, applications] = await Promise.all([User.countDocuments(), Job.countDocuments(), Application.countDocuments()]);
  const status = await Application.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]);
  res.json({ users, jobs, applications, status });
});

module.exports = router;

