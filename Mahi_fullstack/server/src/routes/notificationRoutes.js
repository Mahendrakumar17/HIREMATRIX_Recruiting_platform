const express = require('express');
const Notification = require('../models/Notification');
const { protect } = require('../middleware/auth');

const router = express.Router();

router.get('/', protect, async (req, res) => {
  const notes = await Notification.find({ userId: req.user._id }).sort({ createdAt: -1 });
  res.json(notes);
});

router.patch('/:id/read', protect, async (req, res) => {
  const note = await Notification.findByIdAndUpdate(req.params.id, { read: true }, { returnDocument: 'after' });
  res.json(note);
});

module.exports = router;

