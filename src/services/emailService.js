import {randomInt} from 'crypto';
import {createOTP, verifyOTP as verifyOTPModel} from '../models/otpModel.js';
import {getEmailTransporter} from '../utils/emailTransporter.js';
import {config} from '../config/env.js';

// Generate 6-digit OTP
function generateOTP() {
  return randomInt(100000, 999999).toString();
}

// Send email via Brevo (formerly Sendinblue) REST API
async function sendViaBrevo(toEmail, subject, emailHtml, emailText) {
  const {brevoApiKey, brevoSenderEmail, brevoSenderName} = config.email;

  if (!brevoApiKey) {
    throw new Error('Brevo configuration incomplete. Set BREVO_API_KEY');
  }

  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'api-key': brevoApiKey,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      sender: {
        name: brevoSenderName || 'Pryvo',
        email: brevoSenderEmail || 'noreply@pryvo.com',
      },
      to: [{email: toEmail}],
      subject: subject || 'Notification - Pryvo',
      htmlContent: emailHtml,
      textContent: emailText,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      `Brevo failed: ${response.status} - ${
        errorData.message || 'Unknown error'
      }`,
    );
  }

  console.log(`[Brevo] Email sent successfully to ${toEmail}`);
  return true;
}

// Send email via SMTP (nodemailer)
async function sendViaSMTP(toEmail, subject, emailHtml, emailText) {
  const transporter = getEmailTransporter();

  let fromAddress = config.email.user;
  let fromName = 'Pryvo';

  if (config.email.from) {
    const fromMatch = config.email.from.match(/^(.+?)\s*<(.+?)>$/);
    if (fromMatch) {
      fromName = fromMatch[1].trim();
      fromAddress = fromMatch[2].trim();
    } else {
      fromName = config.email.from.trim();
      fromAddress = config.email.user;
    }
  }

  const mailOptions = {
    from: {name: fromName, address: fromAddress},
    to: toEmail,
    subject: subject || 'Notification - Pryvo',
    html: emailHtml,
    text: emailText,
  };

  const sendPromise = transporter.sendMail(mailOptions);
  const timeoutPromise = new Promise((_, reject) =>
    setTimeout(() => reject(new Error('Email send timeout')), 15000),
  );

  await Promise.race([sendPromise, timeoutPromise]);
  console.log(`[SMTP] Email sent successfully to ${toEmail}`);
  return true;
}

/**
 * Generic email sending function
 * Centralizes provider selection and error handling
 */
export async function sendEmail({to, subject, html, text}) {
  try {
    const provider = config.email.provider;

    if (provider === 'brevo') {
      return await sendViaBrevo(to, subject, html, text);
    } else {
      // Fallback to SMTP if configured
      if (config.email.password || config.email.user) {
        return await sendViaSMTP(to, subject, html, text);
      }
      throw new Error('No email provider configured correctly (Brevo or SMTP)');
    }
  } catch (error) {
    console.error(
      `[Email Service] Failed to send email to ${to}:`,
      error.message,
    );
    throw error;
  }
}

// Send email OTP
export async function sendEmailOTP(email) {
  const code = generateOTP();
  await createOTP(email, code, 'email');

  const emailHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Email Verification</title>
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #FE3C72 0%, #E91E63 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
        <h1 style="color: #ffffff; margin: 0; font-size: 28px;">Pryvo</h1>
      </div>
      <div style="background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 10px 10px;">
        <h2 style="color: #0D0D0D; margin-top: 0;">Verify Your Email</h2>
        <p style="color: #6B7280; font-size: 16px;">
          Thank you for signing up! Please use the verification code below to verify your email address.
        </p>
        <div style="background: #F8F9FA; border: 2px dashed #FE3C72; border-radius: 8px; padding: 20px; text-align: center; margin: 30px 0;">
          <div style="font-size: 36px; font-weight: bold; color: #FE3C72; letter-spacing: 8px; font-family: 'Courier New', monospace;">
            ${code}
          </div>
        </div>
        <p style="color: #6B7280; font-size: 14px; margin-bottom: 0;">
          This code will expire in <strong>10 minutes</strong>. If you didn't request this code, please ignore this email.
        </p>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
        <p style="color: #9CA3AF; font-size: 12px; text-align: center; margin: 0;">
          This is an automated message, please do not reply to this email.
        </p>
      </div>
    </body>
    </html>
  `;

  const emailText = `
    Verify Your Email - Pryvo
    
    Your verification code is: ${code}
    
    This code will expire in 10 minutes.
  `;

  try {
    await sendEmail({
      to: email,
      subject: 'Verify your email - Pryvo',
      html: emailHtml,
      text: emailText,
    });

    return {
      success: true,
      message: 'OTP sent to your email',
      expiresIn: 600,
    };
  } catch (error) {
    console.error(
      `[FALLBACK] Email service unavailable. OTP for ${email}: ${code}`,
    );

    return {
      success: true,
      message: 'OTP sent to your email',
      expiresIn: 600,
      ...(process.env.NODE_ENV !== 'production' && {
        debugCode: code,
        warning: 'Email service unavailable - OTP included for testing',
      }),
    };
  }
}

// Send support email (re-added as requested)
export async function sendSupportEmail({toEmail, subject, html, text}) {
  return await sendEmail({
    to: toEmail,
    subject,
    html,
    text,
  });
}

export async function verifyEmailOTP(email, code) {
  const result = await verifyOTPModel(email, code, 'email');
  return result;
}
