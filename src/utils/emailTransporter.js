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

  const transportOptions = {
    host: config.email.host,
    port: config.email.port,
    secure: config.email.secure, // true for 465 (SSL), false for 587 (STARTTLS)
    auth: {
      user: config.email.user,
      pass: config.email.password,
    },
    connectionTimeout: 10000, // 10 seconds connection timeout
    greetingTimeout: 10000, // 10 seconds greeting timeout
    socketTimeout: 10000, // 10 seconds socket timeout
    // Retry configuration
    pool: true,
    maxConnections: 1,
    maxMessages: 3,
  };

  // For port 587 (STARTTLS), we need different TLS options
  if (config.email.port === 587) {
    transportOptions.requireTLS = true; // Require STARTTLS
    transportOptions.tls = {
      rejectUnauthorized: false, // Accept self-signed certificates if needed
      minVersion: 'TLSv1.2',
    };
  } else {
    // For port 465 (SSL)
    transportOptions.tls = {
      rejectUnauthorized: false,
      ciphers: 'SSLv3',
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

