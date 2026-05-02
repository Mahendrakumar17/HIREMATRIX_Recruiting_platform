const mongoose = require('mongoose');

const interviewSchema = new mongoose.Schema({
  applicationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Application', required: true },
  interviewerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  scheduledDate: { type: Date, required: true },
  feedback: String,
  result: { type: String, enum: ['Pending', 'Pass', 'Fail'], default: 'Pending' },
}, { timestamps: true });

module.exports = mongoose.model('Interview', interviewSchema);

