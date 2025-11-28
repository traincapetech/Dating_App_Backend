import http from 'http';
import app from './app.js';
import {config} from './config/env.js';
import {verifyEmailConnection} from './utils/emailTransporter.js';

const server = http.createServer(app);

server.listen(config.port, () => {
  console.log(`API server listening on port ${config.port}`);
  
  // Log storage configuration
  console.log(`\n[Storage Configuration]`);
  console.log(`Storage driver: ${config.storageDriver}`);
  if (config.storageDriver === 'r2') {
    console.log(`R2 Account ID: ${config.r2.accountId ? 'Set' : 'NOT SET'}`);
    console.log(`R2 Access Key ID: ${config.r2.accessKeyId ? 'Set' : 'NOT SET'}`);
    console.log(`R2 Secret Access Key: ${config.r2.secretAccessKey ? 'Set' : 'NOT SET'}`);
    console.log(`R2 Bucket: ${config.r2.bucket || 'NOT SET'}`);
    console.log(`R2 Prefix: ${config.r2.prefix || '(none)'}`);
    console.log(`R2 Public Base URL: ${config.r2.publicBaseUrl || 'NOT SET'}`);
    if (!config.r2.accountId || !config.r2.accessKeyId || !config.r2.secretAccessKey || !config.r2.bucket) {
      console.error('[WARNING] R2 is selected but credentials are incomplete! Files will fail to upload.');
    }
  } else {
    console.log(`[INFO] Using local storage. Files will be saved to: server/data/`);
    console.log(`[INFO] To use R2, set STORAGE_DRIVER=r2 and configure R2 credentials.`);
  }
  
  // Log email configuration for debugging
  console.log(`\n[Email Configuration]`);
  console.log(`Email provider: ${config.email.provider}`);
  console.log(`SMTP config - Host: ${config.email.host}, Port: ${config.email.port}, Secure: ${config.email.secure}`);
  console.log(`SMTP config - User: ${config.email.user}, From: ${config.email.from}`);
  
  // Verify SMTP connection on startup (non-blocking)
  if (config.email.password) {
    verifyEmailConnection().catch((error) => {
      console.warn('SMTP connection verification failed. The server will continue, but email sending may not work.');
      console.warn('Error details:', error.message);
    });
  } else {
    console.warn('SMTP password not configured. OTP emails will not be sent via SMTP.');
  }
});
