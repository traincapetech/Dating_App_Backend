/**
 * Newsletter Controller
 * Handles email subscriptions and broadcast emails
 */

import Newsletter from "../models/Newsletter.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { z } from "zod";
import nodemailer from "nodemailer";
import { config } from "../config/env.js";

// Validation schema for subscription
const subscribeSchema = z.object({
  email: z.string().email("Invalid email address"),
});

/**
 * Subscribe to newsletter
 * POST /api/newsletter/subscribe
 */
export const subscribe = asyncHandler(async (req, res) => {
  const { email } = subscribeSchema.parse(req.body);

  // Check if already subscribed
  const existing = await Newsletter.findOne({ email });
  if (existing) {
    if (existing.status === 'active') {
      return res.status(400).json({
        success: false,
        message: "This email is already subscribed"
      });
    } else {
      // Re-activate
      existing.status = 'active';
      existing.subscribedAt = new Date();
      await existing.save();
      return res.status(200).json({
        success: true,
        message: "Successfully re-subscribed to our newsletter!"
      });
    }
  }

  // Create new subscription
  await Newsletter.create({
    email,
    metadata: {
      source: req.body.source || 'landing_page',
      ip: req.ip,
      userAgent: req.get('user-agent')
    }
  });

  res.status(201).json({
    success: true,
    message: "Thank you for subscribing to our newsletter!"
  });
});

/**
 * Get all newsletter subscribers
 * GET /api/newsletter
 * (Admin only)
 */
export const getSubscribers = asyncHandler(async (req, res) => {
  const subscribers = await Newsletter.find().sort({ subscribedAt: -1 });
  res.status(200).json({
    success: true,
    count: subscribers.length,
    subscribers
  });
});

/**
 * Send a broadcast email to all active subscribers
 * POST /api/newsletter/send
 * (Admin only)
 */
export const sendNewsletter = asyncHandler(async (req, res) => {
  const { subject, content, html } = req.body;

  if (!subject || (!content && !html)) {
    return res.status(400).json({
      success: false,
      message: "Subject and content are required"
    });
  }

  const activeSubscribers = await Newsletter.find({ status: 'active' });
  
  if (activeSubscribers.length === 0) {
    return res.status(400).json({
      success: false,
      message: "No active subscribers found"
    });
  }

  // Configure transporter (using Brevo/config settings)
  const transporter = nodemailer.createTransport({
    host: config.email.host,
    port: config.email.port,
    secure: config.email.secure,
    auth: {
      user: config.email.user,
      pass: config.email.pass,
    },
  });

  // In a real production app, you'd use a queue/worker (Bull, etc.)
  // and a proper ESP like SendGrid/Brevo's transactional API for bulk
  // For now, we'll do it sequentially for simplicity
  const results = {
    total: activeSubscribers.length,
    success: 0,
    failed: 0
  };

  const emailPromises = activeSubscribers.map(sub => {
    return transporter.sendMail({
      from: `"Pryvo Newsletter" <${config.email.user}>`,
      to: sub.email,
      subject: subject,
      text: content,
      html: html || content,
    }).then(() => {
      results.success++;
    }).catch(err => {
      console.error(`Failed to send newsletter to ${sub.email}:`, err.message);
      results.failed++;
    });
  });

  await Promise.all(emailPromises);

  res.status(200).json({
    success: true,
    message: `Newsletter broadcast complete. Sent to ${results.success} subscribers, ${results.failed} failed.`,
    results
  });
});
