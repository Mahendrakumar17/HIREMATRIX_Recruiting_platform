const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true, lowercase: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['Applicant', 'Recruiter', 'HR', 'HiringManager', 'Admin'], default: 'Applicant' },
  approvalStatus: { type: String, enum: ['Pending', 'Approved', 'Rejected'], default: 'Approved' },
  companyVerified: { type: Boolean, default: false },
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  approvedAt: Date,
  rejectionReason: String,
  phone: String,
  resume: String,
  skills: { type: [String], default: [] },
  experience: String,
  companyDetails: {
    companyName: String,
    companyWebsite: String,
    designation: String,
  },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);

