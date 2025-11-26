import http from 'http';
import app from './app.js';
import {config} from './config/env.js';
import {verifyEmailConnection} from './utils/emailTransporter.js';

const server = http.createServer(app);

server.listen(config.port, () => {
  console.log(`API server listening on port ${config.port}`);
  
  // Log email configuration for debugging
  console.log(`Email provider: ${config.email.provider}`);
  console.log(`EMAIL_PROVIDER env: ${process.env.EMAIL_PROVIDER || 'Not set'}`);
  if (config.email.provider === 'emailjs') {
    console.log(`EmailJS configured: ${config.email.emailjsServiceId ? 'Yes' : 'No'}`);
    console.log(`EmailJS Service ID: ${config.email.emailjsServiceId || 'NOT SET - Add EMAILJS_SERVICE_ID to Render secrets'}`);
    console.log(`EmailJS Template ID: ${config.email.emailjsTemplateId || 'NOT SET - Add EMAILJS_TEMPLATE_ID to Render secrets'}`);
    console.log(`EmailJS Public Key: ${config.email.emailjsPublicKey ? 'Set' : 'NOT SET - Add EMAILJS_PUBLIC_KEY to Render secrets'}`);
    console.log(`EmailJS Private Key: ${config.email.emailjsPrivateKey ? 'Set' : 'NOT SET - Add EMAILJS_PRIVATE_KEY to Render secrets'}`);
    if (!config.email.emailjsServiceId) {
      console.error('[ERROR] EmailJS is selected but credentials are missing!');
      console.error('[ACTION] Add these secrets to Render: EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, EMAILJS_PUBLIC_KEY, EMAILJS_PRIVATE_KEY');
    }
  } else if (config.email.provider === 'resend') {
    console.log(`Resend configured: ${config.email.resendApiKey ? 'Yes' : 'No'}`);
    console.log(`Resend from: ${config.email.resendFrom}`);
  } else {
    console.log(`SMTP config - Host: ${config.email.host}, Port: ${config.email.port}, Secure: ${config.email.secure}`);
    console.log(`SMTP config - User: ${config.email.user}, From: ${config.email.from}`);
    
    // Verify SMTP connection on startup (non-blocking) - only for SMTP provider
    if (config.email.password) {
      verifyEmailConnection().catch((error) => {
        console.warn('SMTP connection verification failed. The server will continue, but email sending may not work.');
        console.warn('Error details:', error.message);
      });
    } else {
      console.warn('SMTP password not configured. OTP emails will not be sent via SMTP.');
    }
  }
});
