const validateJobPayload = (req, res, next) => {
  const { title, company, description, requirements } = req.body;
  if (!title || !company || !description) {
    return res.status(400).json({ message: 'title, company and description are required' });
  }
  if (requirements && !Array.isArray(requirements)) {
    return res.status(400).json({ message: 'requirements must be an array' });
  }
  next();
};

const validateStatusUpdatePayload = (req, res, next) => {
  if (!req.body.status || typeof req.body.status !== 'string') {
    return res.status(400).json({ message: 'status is required' });
  }
  next();
};

const validateRejectPayload = (req, res, next) => {
  const { reason } = req.body;
  if (reason !== undefined && typeof reason !== 'string') {
    return res.status(400).json({ message: 'reason must be a string when provided' });
  }
  next();
};

module.exports = {
  validateJobPayload,
  validateStatusUpdatePayload,
  validateRejectPayload,
};
