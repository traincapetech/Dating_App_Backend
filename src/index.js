import http from 'http';
import app from './app.js';
import {config} from './config/env.js';
import {verifyEmailConnection} from './utils/emailTransporter.js';

const server = http.createServer(app);

server.listen(config.port, () => {
  console.log(`API server listening on port ${config.port}`);
  
  // Verify email connection on startup (non-blocking)
  if (config.email.password) {
    verifyEmailConnection().catch(() => {
      console.warn('Email service verification failed. The server will continue, but email sending may not work.');
    });
  } else {
    console.warn('Email service not configured. OTP emails will not be sent.');
  }
});
