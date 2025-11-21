import {Resend} from 'resend';
import {config} from '../config/env.js';

let resendClient = null;

export function getResendClient() {
  if (resendClient) {
    return resendClient;
  }

  if (!config.email.resendApiKey) {
    throw new Error(
      'Resend API key is not configured. Set RESEND_API_KEY in environment variables.',
    );
  }

  resendClient = new Resend(config.email.resendApiKey);
  return resendClient;
}

export async function sendEmailWithResend({to, subject, html, text}) {
  const resend = getResendClient();
  
  const result = await resend.emails.send({
    from: config.email.resendFrom,
    to,
    subject,
    html,
    text,
  });

  if (result.error) {
    throw new Error(result.error.message || 'Failed to send email via Resend');
  }

  return result;
}

export default getResendClient;

