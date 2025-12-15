import http from "http";
import mongoose from "mongoose";
import app from "./app.js";
import { config } from "./config/env.js";
import { verifyEmailConnection } from "./utils/emailTransporter.js";
import { initSocketServer } from "./services/socketService.js";

// Create Server
const server = http.createServer(app);

// Initialize Socket.IO
initSocketServer(server);

const startServer = async () => {
  try {
    // Connect DB first
    await mongoose.connect(config.mongoUri);

    console.log("📌 MongoDB Connected Successfully");

    // Start API + Socket server after DB connection
    server.listen(config.port, () => {
      console.log(`🚀 API & Socket Server running on port ${config.port}`);

      // Log storage configuration
      console.log(`\n[Storage Configuration]`);
      console.log(`Storage driver: ${config.storageDriver}`);
      if (config.storageDriver === "r2") {
        console.log(`R2 Account ID: ${config.r2.accountId ? "Set" : "NOT SET"}`);
        console.log(`R2 Access Key ID: ${config.r2.accessKeyId ? "Set" : "NOT SET"}`);
        console.log(`R2 Secret Access Key: ${config.r2.secretAccessKey ? "Set" : "NOT SET"}`);
        console.log(`R2 Bucket: ${config.r2.bucket || "NOT SET"}`);
        console.log(`R2 Prefix: ${config.r2.prefix || "(none)"}`);
        console.log(`R2 Public Base URL: ${config.r2.publicBaseUrl || "NOT SET"}`);
        if (!config.r2.accountId || !config.r2.accessKeyId || !config.r2.secretAccessKey || !config.r2.bucket) {
          console.error("[WARNING] R2 is selected but credentials are incomplete!");
        }
      } else {
        console.log("[INFO] Using local storage → server/data/");
        console.log("[INFO] To use R2, set STORAGE_DRIVER=r2 and configure R2 credentials.");
      }

      // Email Configuration
      console.log(`\n[Email Configuration]`);
      console.log(`Email provider: ${config.email.provider}`);
      console.log(`SMTP Host: ${config.email.host}`);
      console.log(`SMTP Port: ${config.email.port}`);
      console.log(`SMTP Secure: ${config.email.secure}`);
      console.log(`SMTP User: ${config.email.user}`);

      if (config.email.password) {
        verifyEmailConnection().catch((error) => {
          console.warn("SMTP connection failed. Email will not work.");
          console.warn("Error:", error.message);
        });
      } else {
        console.warn("SMTP password missing → OTP email disabled.");
      }
    });
  } catch (error) {
    console.error("❌ Failed to connect MongoDB:", error);
    process.exit(1);
  }
};

startServer();
