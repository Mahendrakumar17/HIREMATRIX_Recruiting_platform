const mongoose = require('mongoose');

const applicationSchema = new mongoose.Schema({
  jobId: { type: mongoose.Schema.Types.ObjectId, ref: 'Job', required: true },
  applicantId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  resume: { type: String, required: true },
  status: {
    type: String,
    enum: ['Applied', 'Under Review', 'Shortlisted', 'Not Shortlisted', 'Rejected', 'Interview Scheduled', 'Selected'],
    default: 'Applied',
  },
  notes: String,
  statusReason: { type: String, default: '' },
  statusUpdatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  statusUpdatedAt: Date,
  comments: [
    {
      authorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
      authorRole: { type: String, required: true },
      message: { type: String, required: true, trim: true },
      createdAt: { type: Date, default: Date.now },
    },
  ],
  appliedAt: { type: Date, default: Date.now },
}, { timestamps: true });

applicationSchema.index({ jobId: 1, applicantId: 1 }, { unique: true });
module.exports = mongoose.model('Application', applicationSchema);

