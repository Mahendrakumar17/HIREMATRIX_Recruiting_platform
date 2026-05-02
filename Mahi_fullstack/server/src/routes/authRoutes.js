const express = require('express');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const signToken = require('../utils/token');
const { protect, allowRoles } = require('../middleware/auth');
const upload = require('../middleware/upload');

const router = express.Router();

router.post('/register', upload.single('resume'), async (req, res) => {
  try {
    const { name, email, password, role, phone, skills, experience, companyName, companyWebsite, designation } = req.body;
    if (!name || !email || !password || !role) {
      return res.status(400).json({ message: 'Name, email, password and role are required' });
    }
    if (role === 'Applicant' && !req.file) {
      return res.status(400).json({ message: 'Resume is mandatory for applicants' });
    }
    if ((role === 'Recruiter' || role === 'HR') && !companyName) {
      return res.status(400).json({ message: 'Company details are required for recruiter/HR onboarding' });
    }
    if (role === 'Admin') {
      return res.status(403).json({ message: 'Admin accounts cannot be self-registered' });
    }
    const exists = await User.findOne({ email });
    if (exists) return res.status(400).json({ message: 'Email already used' });
    const hashed = await bcrypt.hash(password, 10);
    const needsAdminApproval = ['Recruiter', 'HR', 'HiringManager'].includes(role);
    const user = await User.create({
      name,
      email,
      password: hashed,
      role,
      approvalStatus: needsAdminApproval ? 'Pending' : 'Approved',
      companyVerified: !needsAdminApproval,
      phone,
      resume: req.file?.path,
      skills: role === 'Applicant' ? String(skills || '').split(',').map((s) => s.trim()).filter(Boolean) : [],
      experience: role === 'Applicant' ? experience : undefined,
      companyDetails: role === 'Recruiter' || role === 'HR'
        ? { companyName, companyWebsite, designation }
        : undefined,
    });
    if (needsAdminApproval) {
      return res.status(201).json({
        message: 'Account created and waiting for admin approval after company verification.',
      });
    }
    const token = signToken(user);
    res.status(201).json({ token, user: { id: user._id, name: user.name, email: user.email, role: user.role } });
  } catch (e) { res.status(500).json({ message: 'Registration failed' }); }
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email });
  if (!user) return res.status(400).json({ message: 'Invalid credentials' });
  if (['Recruiter', 'HR', 'HiringManager'].includes(user.role) && user.approvalStatus !== 'Approved') {
    const statusMessage = user.approvalStatus === 'Rejected'
      ? `Your account request was rejected${user.rejectionReason ? `: ${user.rejectionReason}` : '.'}`
      : 'Your account is pending admin approval after company verification.';
    return res.status(403).json({ message: statusMessage });
  }
  const ok = await bcrypt.compare(password, user.password);
  if (!ok) return res.status(400).json({ message: 'Invalid credentials' });
  const token = signToken(user);
  res.json({ token, user: { id: user._id, name: user.name, email: user.email, role: user.role } });
});

router.get('/me', protect, async (req, res) => res.json(req.user));
router.get('/hiring-managers', protect, allowRoles('Recruiter', 'HR', 'Admin'), async (req, res) => {
  const users = await User.find({
    role: 'HiringManager',
    isActive: true,
    approvalStatus: 'Approved',
    companyVerified: true,
  }).select('name email');
  res.json(users);
});

module.exports = router;

