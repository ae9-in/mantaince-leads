import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';

const ses = new SESClient({ region: process.env.AWS_REGION || 'us-east-1' });
const FROM_EMAIL = process.env.SES_FROM_EMAIL || 'noreply@admateine.com';

/**
 * Send email when agent assignments change
 */
export async function sendAssignmentNotification(params) {
  const { toEmail, userName, addedSubVerticals, removedSubVerticals } = params;
  if (addedSubVerticals.length === 0 && removedSubVerticals.length === 0) return;

  try {
    await ses.send(new SendEmailCommand({
      Destination: { ToAddresses: [toEmail] },
      Source:      `AdMateine <${FROM_EMAIL}>`,
      Message: {
        Subject: { Data: 'Your lead assignments have been updated' },
        Body: {
          Html: {
            Data: `
              <p>Hi ${userName},</p>
              <p>Your lead area assignments have been updated by an admin.</p>
              ${addedSubVerticals.length > 0
                ? `<p><strong>Added:</strong> ${addedSubVerticals.join(', ')}</p>`
                : ''}
              ${removedSubVerticals.length > 0
                ? `<p><strong>Removed:</strong> ${removedSubVerticals.join(', ')}</p>`
                : ''}
              <p>Log in to see your updated lead pipeline.</p>
            `,
          },
        },
      },
    }));
  } catch (error) {
    console.error('[SES] Failed to send assignment notification:', error.message);
  }
}

/**
 * Send email when CSV bulk lead import job completes
 */
export async function sendImportCompleteNotification(params) {
  const { toEmail, inserted, rejected, exportUrl } = params;

  try {
    await ses.send(new SendEmailCommand({
      Destination: { ToAddresses: [toEmail] },
      Source: `AdMateine <${FROM_EMAIL}>`,
      Message: {
        Subject: { Data: `Import complete — ${inserted} leads imported` },
        Body: {
          Html: {
            Data: `
              <p>Your lead import has finished.</p>
              <p>✅ <strong>${inserted}</strong> leads imported successfully.</p>
              ${rejected > 0
                ? `<p>⚠️ <strong>${rejected}</strong> rows were rejected (invalid data).</p>`
                : ''}
              <p><a href="${exportUrl}">Download error report</a></p>
            `,
          },
        },
      },
    }));
  } catch (error) {
    console.error('[SES] Failed to send import notification:', error.message);
  }
}
