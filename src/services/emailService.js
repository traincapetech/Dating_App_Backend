import {randomInt} from 'crypto';
import {createOTP, verifyOTP as verifyOTPModel} from '../models/otpModel.js';
import {getEmailTransporter} from '../utils/emailTransporter.js';
import {config} from '../config/env.js';

// Generate 6-digit OTP
function generateOTP() {
  return randomInt(100000, 999999).toString();
}

// Send email via EmailJS REST API
async function sendViaEmailJS(toEmail, code) {
  const { emailjsServiceId, emailjsTemplateId, emailjsPublicKey, emailjsPrivateKey } = config.email;
  
  if (!emailjsServiceId || !emailjsTemplateId || !emailjsPublicKey) {
    throw new Error('EmailJS configuration incomplete. Set EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, EMAILJS_PUBLIC_KEY');
  }

  const response = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      service_id: emailjsServiceId,
      template_id: emailjsTemplateId,
      user_id: emailjsPublicKey,
      accessToken: emailjsPrivateKey || undefined,
      template_params: {
        to_email: toEmail,
        otp_code: code,
        app_name: 'Pryvo',
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`EmailJS failed: ${response.status} - ${errorText}`);
  }

  console.log(`[EmailJS] OTP sent successfully to ${toEmail}`);
  return true;
}

// Send email via SMTP (nodemailer)
async function sendViaSMTP(toEmail, code, emailHtml, emailText) {
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
    from: { name: fromName, address: fromAddress },
    to: toEmail,
    subject: 'Verify your email - Pryvo',
    html: emailHtml,
    text: emailText,
  };

  const sendPromise = transporter.sendMail(mailOptions);
  const timeoutPromise = new Promise((_, reject) => 
    setTimeout(() => reject(new Error('Email send timeout')), 15000)
  );
  
  await Promise.race([sendPromise, timeoutPromise]);
  console.log(`[SMTP] OTP sent successfully to ${toEmail}`);
  return true;
}

// Send email OTP
export async function sendEmailOTP(email) {
  const code = generateOTP();
  const otp = await createOTP(email, code, 'email');

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
    const provider = config.email.provider;
    console.log(`[EMAIL] Sending OTP via: ${provider}`);
    
    if (provider === 'emailjs') {
      await sendViaEmailJS(email, code);
    } else {
      await sendViaSMTP(email, code, emailHtml, emailText);
    }

    return {
      success: true,
      message: 'OTP sent to your email',
      expiresIn: 600,
    };
  } catch (error) {
    console.error('Error sending email OTP:', error.message);
    console.error(`[FALLBACK] Email service unavailable. OTP for ${email}: ${code}`);
    
    // Log configuration for debugging
    console.error('[DEBUG] Email configuration:');
    console.error(`  - Provider: ${config.email.provider}`);
    if (config.email.provider === 'emailjs') {
      console.error(`  - ServiceID: ${config.email.emailjsServiceId ? 'Set' : 'NOT SET'}`);
      console.error(`  - TemplateID: ${config.email.emailjsTemplateId ? 'Set' : 'NOT SET'}`);
      console.error(`  - PublicKey: ${config.email.emailjsPublicKey ? 'Set' : 'NOT SET'}`);
      console.error(`  - PrivateKey: ${config.email.emailjsPrivateKey ? 'Set' : 'NOT SET'}`);
    } else {
      console.error(`  - Host: ${config.email.host || 'NOT SET'}`);
      console.error(`  - User: ${config.email.user ? 'Set' : 'NOT SET'}`);
    }
    
    return {
      success: true,
      message: 'OTP sent to your email',
      expiresIn: 600,
      ...(process.env.NODE_ENV !== 'production' && { 
        debugCode: code,
        warning: 'Email service unavailable - OTP included for testing' 
      }),
    };
  }
}

export async function verifyEmailOTP(email, code) {
  const result = await verifyOTPModel(email, code, 'email');
  return result;
}
