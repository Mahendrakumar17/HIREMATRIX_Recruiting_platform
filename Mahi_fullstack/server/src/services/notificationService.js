const Notification = require('../models/Notification');
const { emitToUsers } = require('../sockets/socket');
const { sendMail } = require('../utils/mailer');

const createInAppNotifications = async ({ userIds, title, message, meta = {} }) => {
  if (!Array.isArray(userIds) || !userIds.length) return [];
  const notes = await Notification.insertMany(
    userIds.map((userId) => ({
      userId,
      title,
      message,
      ...meta,
    }))
  );
  notes.forEach((note) => emitToUsers([note.userId], 'notification:new', note));
  return notes;
};

const sendBulkEmail = async ({ recipients, templateBuilder, payload }) => {
  if (!Array.isArray(recipients) || !recipients.length || typeof templateBuilder !== 'function') return;
  await Promise.all(
    recipients.map(async (recipient) => {
      if (!recipient.email) return;
      const template = templateBuilder(payload, recipient);
      await sendMail({
        to: recipient.email,
        subject: template.subject,
        text: template.text,
        html: template.html,
      });
    })
  );
};

module.exports = {
  createInAppNotifications,
  sendBulkEmail,
};
