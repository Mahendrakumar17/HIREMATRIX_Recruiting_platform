const buildNewJobPostedTemplate = ({ job, applyLink }) => {
  const shortDescription = (job.description || '').slice(0, 220);
  const text = [
    `A new job is posted on HireMatrix.`,
    `Job Title: ${job.title}`,
    `Company: ${job.company}`,
    `Description: ${shortDescription}`,
    `Apply here: ${applyLink}`,
  ].join('\n');
  const html = `
    <h2>New Job Posted</h2>
    <p><strong>Job Title:</strong> ${job.title}</p>
    <p><strong>Company:</strong> ${job.company}</p>
    <p><strong>Description:</strong> ${shortDescription}</p>
    <p><a href="${applyLink}">Apply Now</a></p>
  `;
  return { subject: `HireMatrix new job: ${job.title}`, text, html };
};

const buildApplicationSubmittedTemplate = ({ jobTitle }) => ({
  subject: 'HireMatrix application submitted',
  text: `Your application for ${jobTitle} has been submitted successfully.`,
  html: `<p>Your application for <strong>${jobTitle}</strong> has been submitted successfully.</p>`,
});

const buildShortlistedTemplate = ({ jobTitle }) => ({
  subject: `You have been shortlisted for ${jobTitle}`,
  text: `Congratulations! You have been shortlisted for ${jobTitle}. Our team will contact you with next steps.`,
  html: `<p>Congratulations! You have been <strong>shortlisted</strong> for <strong>${jobTitle}</strong>.</p><p>Our team will contact you with next steps.</p>`,
});

const buildRejectedTemplate = ({ jobTitle, reason }) => ({
  subject: `Update on your application for ${jobTitle}`,
  text: `Thank you for your interest in ${jobTitle}. After careful review, we are moving forward with other candidates at this time.${reason ? ` Note: ${reason}` : ''}`,
  html: `<p>Thank you for your interest in <strong>${jobTitle}</strong>.</p><p>After careful review, we are moving forward with other candidates at this time.</p>${reason ? `<p><strong>Note:</strong> ${reason}</p>` : ''}`,
});

const buildInterviewScheduledTemplate = ({ jobTitle, when }) => ({
  subject: `Interview scheduled for ${jobTitle}`,
  text: `Your interview for ${jobTitle} is scheduled on ${when}.`,
  html: `<p>Your interview for <strong>${jobTitle}</strong> is scheduled on <strong>${when}</strong>.</p>`,
});

module.exports = {
  buildNewJobPostedTemplate,
  buildApplicationSubmittedTemplate,
  buildShortlistedTemplate,
  buildRejectedTemplate,
  buildInterviewScheduledTemplate,
};
