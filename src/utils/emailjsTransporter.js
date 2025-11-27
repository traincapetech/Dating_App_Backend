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

    // Use EmailJS REST API directly instead of Node.js SDK
    // According to EmailJS docs, accessToken should be in query params or header
    const apiUrl = `https://api.emailjs.com/api/v1.0/email/send`;
    
    const requestBody = {
      service_id: config.email.emailjsServiceId,
      template_id: config.email.emailjsTemplateId,
      user_id: config.email.emailjsPublicKey,
      template_params: templateParams,
    };

    // Try with accessToken as query parameter first
    const urlWithToken = `${apiUrl}?accessToken=${encodeURIComponent(config.email.emailjsPrivateKey)}`;
    
    const response = await fetch(urlWithToken, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    // Get response text first to handle both JSON and plain text responses
    const responseText = await response.text();
    
    // Try to parse as JSON, but handle plain text errors
    let responseData;
    try {
      responseData = JSON.parse(responseText);
    } catch (parseError) {
      // If it's not JSON, it's likely an error message
      throw new Error(`EmailJS API error: ${responseText} (Status: ${response.status})`);
    }

    if (!response.ok) {
      throw new Error(`EmailJS API error: ${responseData.message || responseText || response.statusText} (Status: ${response.status})`);
    }

    console.log(`[EmailJS] Response:`, JSON.stringify(responseData, null, 2));
    return responseData;
  } catch (error) {
    // Log full error details for debugging
    console.error('[EmailJS] Full error:', error);
    console.error('[EmailJS] Error message:', error.message);
    
    // Provide more detailed error message
    const errorMessage = error.message || 'Failed to send email';
    throw new Error(`EmailJS error: ${errorMessage}`);
  }
}

export default sendEmailWithEmailJS;

