const nodemailer = require('nodemailer');

(async () => {
  try {
    const testAccount = await nodemailer.createTestAccount();
    console.log('Ethereal account created');
    console.log('USER:', testAccount.user);
    console.log('PASS LEN:', testAccount.pass.length);

    const transporter = nodemailer.createTransport({
      host: testAccount.smtp.host,
      port: testAccount.smtp.port,
      secure: testAccount.smtp.secure,
      auth: { user: testAccount.user, pass: testAccount.pass },
    });

    await transporter.verify();
    console.log('Ethereal SMTP verified');

    const info = await transporter.sendMail({
      from: 'Tester <tester@example.com>',
      to: testAccount.user,
      subject: 'Ethereal test email',
      text: 'This is a test email sent via Ethereal',
    });

    console.log('Message sent id:', info.messageId);
    console.log('Preview URL:', nodemailer.getTestMessageUrl(info));
    process.exit(0);
  } catch (err) {
    console.error('Ethereal test failed:', err && err.message ? err.message : err);
    process.exit(1);
  }
})();
