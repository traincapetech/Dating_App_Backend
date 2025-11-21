import http from 'http';
import app from './app.js';
import {config} from './config/env.js';
import {verifyEmailConnection} from './utils/emailTransporter.js';

const server = http.createServer(app);

server.listen(config.port, () => {
  console.log(`API server listening on port ${config.port}`);
  
  // Log email configuration for debugging
  console.log(`Email config - Host: ${config.email.host}, Port: ${config.email.port}, Secure: ${config.email.secure}`);
  console.log(`Email config - User: ${config.email.user}, From: ${config.email.from}`);
  
  // Verify email connection on startup (non-blocking)
  if (config.email.password) {
    verifyEmailConnection().catch((error) => {
      console.warn('Email service verification failed. The server will continue, but email sending may not work.');
      console.warn('Error details:', error.message);
    });
  } else {
    console.warn('Email service not configured. OTP emails will not be sent.');
  }
});
