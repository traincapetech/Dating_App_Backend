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
    // Common variable names used in EmailJS templates
    const templateParams = {
      to_email: to,
      to_name: to.split('@')[0], // Extract name from email
      subject: subject,
      message: html,
      otp_code: otpCode,
      // Alternative variable names (uncomment if your template uses these)
      // user_email: to,
      // user_name: to.split('@')[0],
      // verification_code: otpCode,
      // code: otpCode,
    };

    console.log(`[EmailJS] Sending email to ${to} using service ${config.email.emailjsServiceId}, template ${config.email.emailjsTemplateId}`);
    console.log(`[EmailJS] Template params:`, JSON.stringify(templateParams, null, 2));

    const response = await emailjs.send(
      config.email.emailjsServiceId,
      config.email.emailjsTemplateId,
      templateParams,
      {
        publicKey: config.email.emailjsPublicKey,
        privateKey: config.email.emailjsPrivateKey,
      }
    );

    console.log(`[EmailJS] Response:`, JSON.stringify(response, null, 2));
    return response;
  } catch (error) {
    // Log full error details for debugging
    console.error('[EmailJS] Full error:', error);
    console.error('[EmailJS] Error message:', error.message);
    console.error('[EmailJS] Error status:', error.status);
    console.error('[EmailJS] Error text:', error.text);
    
    // Provide more detailed error message
    const errorMessage = error.text || error.message || 'Failed to send email';
    throw new Error(`EmailJS error: ${errorMessage} (Status: ${error.status || 'unknown'})`);
  }
}

export default sendEmailWithEmailJS;

