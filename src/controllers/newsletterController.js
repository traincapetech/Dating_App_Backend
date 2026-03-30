/**
 * Newsletter Controller
 * Handles email subscriptions and broadcast emails
 */

import Newsletter from '../models/Newsletter.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { z } from 'zod';
import { config } from '../config/env.js';
import SibApiV3Sdk from 'sib-api-v3-sdk';

export const subscribe = asyncHandler(async (req, res) => {
  const { email, source, isPremium } = req.body;
  if (!email) {
    return res.status(400).json({ success: false, message: 'Email is required' });
  }

  // Upsert: Find and update or create
  const subscriber = await Newsletter.findOneAndUpdate(
    { email: email.toLowerCase() },
    { 
      status: 'active',
      source: source || 'landing_page',
      isPremium: isPremium || false,
      subscribedAt: new Date(),
      metadata: {
        ip: req.ip,
        userAgent: req.get('user-agent'),
      }
    },
    { upsert: true, new: true }
  );

  res.status(200).json({
    success: true,
    message: 'Successfully subscribed to the newsletter!',
    subscriber
  });
});

/**
 * Unsubscribe from newsletter
 * POST /api/newsletter/unsubscribe
 */
export const unsubscribe = asyncHandler(async (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ success: false, message: 'Email is required' });
  }

  const subscriber = await Newsletter.findOneAndUpdate(
    { email: email.toLowerCase() },
    { 
      status: 'unsubscribed',
      unsubscribedAt: new Date() 
    },
    { new: true }
  );

  if (!subscriber) {
    return res.status(404).json({ success: false, message: 'Subscriber not found' });
  }

  res.status(200).json({
    success: true,
    message: 'Successfully unsubscribed.',
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
    subscribers,
  });
});

/**
 * Send a broadcast email to specific audience segments
 * POST /api/newsletter/send
 * (Admin only)
 */
export const sendNewsletter = asyncHandler(async (req, res) => {
  const { from, subject, content, html, emails, segment } = req.body;

  if (!subject || (!content && !html) || !emails || !Array.isArray(emails) || emails.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'Subject, content/html, and a valid array of emails are required',
    });
  }

  if (emails.length > 50) {
    return res.status(400).json({
      success: false,
      message: 'Maximum 50 recipients allowed per batch according to current settings',
    });
  }

  // Initialize Brevo API
  const defaultClient = SibApiV3Sdk.ApiClient.instance;
  const apiKey = defaultClient.authentications['api-key'];
  apiKey.apiKey = process.env.BREVO_API_KEY || config.email.pass;

  const apiInstance = new SibApiV3Sdk.TransactionalEmailsApi();
  const sendSmtpEmail = new SibApiV3Sdk.SendSmtpEmail();

  // Brevo email configuration
  sendSmtpEmail.subject = subject;
  sendSmtpEmail.htmlContent = html || content;
  sendSmtpEmail.textContent = content || '';
  
  // Hardcoded sender per requirements
  sendSmtpEmail.sender = { 
    name: "Pryvo Team", 
    email: "pryvo@traincapetech.in" 
  };
  
  // Brevo requires 'to' to be an array of objects
  sendSmtpEmail.to = emails.map(email => ({ email }));

  try {
    const data = await apiInstance.sendTransacEmail(sendSmtpEmail);
    res.status(200).json({
      success: true,
      message: `Newsletter broadcast complete. Sent to ${emails.length} subscribers in segment: ${segment || 'Custom'}.`,
      messageId: data.messageId,
    });
  } catch (error) {
    console.error('Brevo API Error:', error.response ? error.response.text : error.message);
    let errorMessage = error.message;
    if (error.response && error.response.text) {
      try {
        errorMessage = JSON.parse(error.response.text).message;
      } catch (e) {
        errorMessage = error.response.text;
      }
    }
    res.status(400).json({
      success: false,
      message: `Failed to send newsletter via Brevo: ${errorMessage}`,
    });
  }
});
