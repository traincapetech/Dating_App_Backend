import mongoose from 'mongoose';

const ReportSchema = new mongoose.Schema({
  reporterId: { type: String, required: true, index: true },
  reportedId: { type: String, required: true, index: true },
  matchId: { type: String },
  reason: {
    type: String,
    required: true,
    enum: ['harassment', 'spam', 'inappropriate_content', 'fake_profile', 'underage', 'other'],
  },
  description: { type: String },
  status: {
    type: String,
    enum: ['pending', 'reviewed', 'resolved', 'dismissed'],
    default: 'pending',
  },
  createdAt: { type: Date, default: Date.now },
  resolvedAt: { type: Date },
});

export default mongoose.model('Report', ReportSchema);

