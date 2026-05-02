const mongoose = require('mongoose');

const jobSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String, required: true },
  requirements: { type: [String], default: [] },
  company: { type: String, required: true },
  deadline: Date,
  postedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  assignedHiringManagers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
}, { timestamps: true });

module.exports = mongoose.model('Job', jobSchema);

