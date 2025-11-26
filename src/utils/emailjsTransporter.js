import emailjs from '@emailjs/nodejs';
import {config} from '../config/env.js';

export async function sendEmailWithEmailJS({to, subject, html, text, otpCode}) {
  if (!config.email.emailjsServiceId || !config.email.emailjsTemplateId || !config.email.emailjsPublicKey || !config.email.emailjsPrivateKey) {
    throw new Error(
      'EmailJS is not fully configured. Set EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, EMAILJS_PUBLIC_KEY, and EMAILJS_PRIVATE_KEY in environment variables.',
    );
  }

  try {
    // EmailJS template parameters
    const templateParams = {
      to_email: to,
      to_name: to.split('@')[0], // Extract name from email
      subject: subject,
      message: html,
      otp_code: otpCode,
      // You can add more template variables here based on your EmailJS template
    };

    const response = await emailjs.send(
      config.email.emailjsServiceId,
      config.email.emailjsTemplateId,
      templateParams,
      {
        publicKey: config.email.emailjsPublicKey,
        privateKey: config.email.emailjsPrivateKey,
      }
    );

    return response;
  } catch (error) {
    throw new Error(`EmailJS error: ${error.message || 'Failed to send email'}`);
  }
}

export default sendEmailWithEmailJS;

