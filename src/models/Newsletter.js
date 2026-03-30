import mongoose from 'mongoose';

/**
 * Newsletter Model
 * Stores email addresses of people who subscribed to the newsletter
 * from the landing page.
 */
const NewsletterSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    index: true,
  },
  status: {
    type: String,
    enum: ['active', 'unsubscribed'],
    default: 'active',
  },
  source: {
    type: String,
    default: 'landing_page',
  },
  subscribedAt: {
    type: Date,
    default: Date.now,
  },
  unsubscribedAt: {
    type: Date,
  },
  isPremium: {
    type: Boolean,
    default: false,
  },
  metadata: {
    ip: { type: String },
    userAgent: { type: String },
  },
});

export default mongoose.model('Newsletter', NewsletterSchema);
