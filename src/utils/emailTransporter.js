import nodemailer from 'nodemailer';
import {config} from '../config/env.js';

let transporter = null;

export function getEmailTransporter() {
  if (transporter) {
    return transporter;
  }

  if (!config.email.password) {
    throw new Error(
      'Email password is not configured. Set EMAIL_PASSWORD in environment variables.',
    );
  }

  const provider = config.email.provider;
  console.log(`[EMAIL] Using provider: ${provider}`);

  let transportOptions;

  if (provider === 'gmail') {
    // Gmail SMTP - most reliable free option
    // Requires App Password: https://myaccount.google.com/apppasswords
    console.log(`[EMAIL] Gmail: ${config.email.user}`);
    transportOptions = {
      service: 'gmail',
      auth: {
        user: config.email.user,
        pass: config.email.password, // Use App Password, NOT regular password
      },
    };
  } else if (provider === 'outlook' || provider === 'hotmail') {
    // Outlook/Hotmail
    console.log(`[EMAIL] Outlook: ${config.email.user}`);
    transportOptions = {
      service: 'hotmail',
      auth: {
        user: config.email.user,
        pass: config.email.password,
      },
    };
  } else {
    // Generic SMTP (Hostinger, custom, etc.)
    console.log(`[EMAIL] SMTP: ${config.email.host}:${config.email.port}, user: ${config.email.user}`);
    transportOptions = {
      host: config.email.host,
      port: config.email.port,
      secure: config.email.secure,
      auth: {
        user: config.email.user,
        pass: config.email.password,
      },
      connectionTimeout: 15000,
      greetingTimeout: 15000,
      socketTimeout: 15000,
      pool: true,
      maxConnections: 1,
      maxMessages: 3,
      tls: {
        rejectUnauthorized: false,
      },
    };
  }

  transporter = nodemailer.createTransport(transportOptions);

  return transporter;
}

export async function verifyEmailConnection() {
  try {
    const transporter = getEmailTransporter();
    // Use a timeout promise to prevent hanging
    const verifyPromise = transporter.verify();
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Connection timeout')), 10000)
    );

    await Promise.race([verifyPromise, timeoutPromise]);
    console.log('Email server connection verified successfully');
    return true;
  } catch (error) {
    console.error('Email server connection failed:', error.message);
    // Don't throw, just log - allow app to continue without email
    return false;
  }
}

export default getEmailTransporter;

