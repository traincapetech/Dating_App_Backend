import {sendSupportEmail} from '../services/emailService.js';

/**
 * Report a problem
 * Sends an email to support with issue details via Brevo
 */
export const reportProblem = async (req, res) => {
  try {
    const {userId, category, details, imageUri, userEmail, userName} = req.body;

    if (!category || !details) {
      return res.status(400).json({
        success: false,
        message: 'Category and details are required',
      });
    }

    const supportEmail = 'pryvo@traincapetech.in';
    const subject = `[Problem Report] ${category} - ${
      userName || userId || 'User'
    }`;

    const html = `
      <!DOCTYPE html>
      <html>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: #FE3C72; padding: 20px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="color: #ffffff; margin: 0;">Pryvo Support</h1>
        </div>
        <div style="background: #ffffff; padding: 20px; border: 1px solid #e5e7eb; border-radius: 0 0 10px 10px;">
          <h2>Problem Report</h2>
          <p><strong>Category:</strong> ${category}</p>
          <p><strong>User ID:</strong> ${userId || 'N/A'}</p>
          <p><strong>User Name:</strong> ${userName || 'N/A'}</p>
          <p><strong>User Email:</strong> ${userEmail || 'N/A'}</p>
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
          <p><strong>Details:</strong></p>
          <p style="background: #f9fafb; padding: 15px; border-radius: 8px;">${details}</p>
          ${
            imageUri && imageUri.startsWith('data:')
              ? `
            <p><strong>Screenshot Included:</strong> (Base64 data in HTML version)</p>
            <img src="${imageUri}" style="max-width: 100%; border-radius: 8px; margin-top: 10px;" />
          `
              : imageUri
              ? `
            <p><strong>Screenshot URL:</strong> ${imageUri}</p>
            <img src="${imageUri}" style="max-width: 100%; border-radius: 8px; margin-top: 10px;" />
          `
              : ''
          }
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
          <p style="font-size: 12px; color: #9ca3af;">Sent via Pryvo Support System (Brevo)</p>
        </div>
      </body>
      </html>
    `;

    const text = `
      Problem Report
      ---------------
      Category: ${category}
      User ID: ${userId || 'N/A'}
      User Name: ${userName || 'N/A'}
      User Email: ${userEmail || 'N/A'}
      
      Details:
      ${details}
      
      ${imageUri ? 'Screenshot included in HTML version.' : ''}
    `;

    await sendSupportEmail({
      toEmail: supportEmail,
      subject,
      html,
      text,
    });

    res.json({
      success: true,
      message: 'Report sent successfully. Our support team has been notified.',
    });
  } catch (error) {
    console.error('Error reporting problem:', error);
    res.status(500).json({
      success: false,
      message: 'Error sending report',
      error: error.message,
    });
  }
};
