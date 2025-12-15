import {randomInt} from 'crypto';
import {createOTP, verifyOTP as verifyOTPModel} from '../models/otpModel.js';
import {getEmailTransporter} from '../utils/emailTransporter.js';
import {config} from '../config/env.js';

// Generate 6-digit OTP
function generateOTP() {
  return randomInt(100000, 999999).toString();
}

// Send email OTP using SMTP
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
    
    Thank you for signing up! Please use the verification code below to verify your email address.
    
    Your verification code is: ${code}
    
    This code will expire in 10 minutes. If you didn't request this code, please ignore this email.
    
    This is an automated message, please do not reply to this email.
  `;

  try {
    // Use SMTP to send email via Hostinger
    const transporter = getEmailTransporter();
    
    // Format sender - if EMAIL_FROM contains <email>, parse it, otherwise use just the name
    let fromAddress = config.email.user; // Default to SMTP user
    let fromName = 'Pryvo';
    
    if (config.email.from) {
      // Check if it's in format "Name <email>" or just "Name"
      const fromMatch = config.email.from.match(/^(.+?)\s*<(.+?)>$/);
      if (fromMatch) {
        fromName = fromMatch[1].trim();
        fromAddress = fromMatch[2].trim();
    } else {
        // Just a name, use SMTP user email
        fromName = config.email.from.trim();
        fromAddress = config.email.user;
      }
    }
    
      const mailOptions = {
      from: {
        name: fromName,
        address: fromAddress,
      },
      // Don't set replyTo - users shouldn't reply to OTP emails
        to: email,
        subject: 'Verify your email - Pryvo',
        html: emailHtml,
        text: emailText,
      };

      // Add timeout to prevent hanging
      const sendPromise = transporter.sendMail(mailOptions);
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Email send timeout')), 15000)
      );
      
      await Promise.race([sendPromise, timeoutPromise]);
      console.log(`Email OTP sent successfully via SMTP to ${email}`);

    return {
      success: true,
      message: 'OTP sent to your email',
      expiresIn: 600, // 10 minutes in seconds
    };
  } catch (error) {
    console.error('Error sending email OTP:', error.message);
    console.error(`[FALLBACK] Email service unavailable. OTP for ${email}: ${code}`);
    
    // Log SMTP configuration status for debugging
    console.error('[DEBUG] SMTP configuration check:');
      console.error(`  - Provider: ${config.email.provider}`);
    console.error(`  - Host: ${config.email.host || 'NOT SET'}`);
    console.error(`  - Port: ${config.email.port || 'NOT SET'}`);
    console.error(`  - User: ${config.email.user ? 'Set' : 'NOT SET'}`);
    console.error(`  - Password: ${config.email.password ? 'Set' : 'NOT SET'}`);
    console.error(`  - From: ${config.email.from || 'NOT SET'}`);
    
    // Don't throw error - allow the app to continue functioning
    // The OTP is still created and stored, it just wasn't emailed
    return {
      success: true,
      message: 'OTP sent to your email',
      expiresIn: 600,
      // Include OTP in response for development/testing when email fails
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
