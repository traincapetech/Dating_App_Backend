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

  transporter = nodemailer.createTransport({
    host: config.email.host,
    port: config.email.port,
    secure: config.email.secure, // true for 465, false for other ports
    auth: {
      user: config.email.user,
      pass: config.email.password,
    },
  });

  return transporter;
}

export async function verifyEmailConnection() {
  try {
    const transporter = getEmailTransporter();
    await transporter.verify();
    console.log('Email server connection verified successfully');
    return true;
  } catch (error) {
    console.error('Email server connection failed:', error);
    return false;
  }
}

export default getEmailTransporter;

