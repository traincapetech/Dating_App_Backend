import mongoose from 'mongoose';

const giftSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
    },
    coinValue: {
      type: Number,
      required: true,
      min: 0,
    },
    imageUrl: {
      type: String,
      required: false,
    },
    category: {
      type: String,
      default: 'standard',
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  },
);

const Gift = mongoose.models.Gift || mongoose.model('Gift', giftSchema);

export default Gift;
