const bcrypt = require('bcryptjs');
const User = require('../models/User');

const DEFAULT_ADMIN = {
  name: 'Default Admin',
  email: 'hirematrixmahendra@gmail.com',
  password: '23110010328@Mahi',
};

module.exports = async () => {
  const existingAdmin = await User.findOne({ role: 'Admin' });
  if (existingAdmin) return;

  const hashedPassword = await bcrypt.hash(DEFAULT_ADMIN.password, 10);
  await User.create({
    name: DEFAULT_ADMIN.name,
    email: DEFAULT_ADMIN.email,
    password: hashedPassword,
    role: 'Admin',
    approvalStatus: 'Approved',
    companyVerified: true,
    isActive: true,
  });

  console.log('Default admin account created.');
};
