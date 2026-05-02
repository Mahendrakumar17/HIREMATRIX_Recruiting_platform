const nodemailer = require('nodemailer');

let transporter;
let healthChecked = false;

const createTransporterFromEnv = () => {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: Number(process.env.SMTP_PORT || 587) === 465,
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
  });
};

const createEtherealTransporter = async () => {
  const testAccount = await nodemailer.createTestAccount();
  console.log('Ethereal account created for local testing:', testAccount.user);
  return nodemailer.createTransport({
    host: testAccount.smtp.host,
    port: testAccount.smtp.port,
    secure: testAccount.smtp.secure,
    auth: { user: testAccount.user, pass: testAccount.pass },
  });
};

const verifyTransporter = async () => {
  if (healthChecked) return true;

  // prefer explicit env flag to force ethereal
  const useEtherealFlag = String(process.env.USE_ETHEREAL || '').toLowerCase() === 'true';

  // Initialize transporter based on env unless already created
  if (!transporter) {
    if (useEtherealFlag) {
      transporter = await createEtherealTransporter();
    } else if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
      transporter = createTransporterFromEnv();
    } else {
      console.warn('SMTP configuration missing. Email delivery is disabled.');
      return false;
    }
  }

  try {
    await transporter.verify();
    healthChecked = true;
    console.log('SMTP connection verified');
    return true;
  } catch (error) {
    console.error('SMTP verification failed:', error && error.message ? error.message : error);

    // If verification failed and we're not in production, try Ethereal fallback automatically
    if (process.env.NODE_ENV !== 'production' && !useEtherealFlag) {
      try {
        console.log('Attempting Ethereal fallback for local testing...');
        transporter = await createEtherealTransporter();
        await transporter.verify();
        healthChecked = true;
        console.log('Ethereal SMTP verified (fallback)');
        return true;
      } catch (err2) {
        console.error('Ethereal fallback failed:', err2 && err2.message ? err2.message : err2);
      }
    }

    return false;
  }
};

const sendMail = async ({ to, subject, text, html }) => {
  if (!to) return;
  try {
    if (!transporter) {
      // try to initialize transporter if not already
      await verifyTransporter();
      if (!transporter) throw new Error('No transporter available');
    }

    const info = await transporter.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER || 'no-reply@example.com',
      to,
      subject,
      text,
      html,
    });

    // If using Ethereal, print preview URL
    const preview = nodemailer.getTestMessageUrl(info);
    if (preview) console.log('Email preview URL:', preview);
    return info;
  } catch (error) {
    console.log('Email send failed:', error && error.message ? error.message : error);
    return null;
  }
};

module.exports = {
  sendMail,
  verifyTransporter,
};

