const multer = require('multer');

const storage = multer.diskStorage({
  destination: (_, __, cb) => cb(null, 'uploads/'),
  filename: (_, file, cb) => cb(null, `${Date.now()}-${file.originalname.replace(/\s+/g, '_')}`),
});

module.exports = multer({ storage, limits: { fileSize: 2 * 1024 * 1024 } });

