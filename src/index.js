import http from 'http';
import app from './app.js';
import {config} from './config/env.js';
import {verifyEmailConnection} from './utils/emailTransporter.js';

const server = http.createServer(app);

server.listen(config.port, async () => {
  console.log(`API server listening on port ${config.port}`);
  
  // Verify email connection on startup
  if (config.email.password) {
    await verifyEmailConnection();
  } else {
    console.warn('Email service not configured. OTP emails will not be sent.');
  }
});
