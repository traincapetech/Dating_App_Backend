import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    _id: {
      type: String, // Keeping string ID to match existing UUIDs during migration
      required: true,
    },
    fullName: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    phone: {
      type: String,
      trim: true,
    },
    password: {
      type: String,
      required: function () {
        return this.authProvider !== 'google';
      },
    },
    authProvider: {
      type: String,
      enum: ['local', 'google'],
      default: 'local',
    },
    googleId: {
      type: String,
      sparse: true,
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    role: {
      type: String,
      enum: ['user', 'admin', 'moderator'],
      default: 'user',
    },
    passwordResetToken: String,
    passwordResetExpires: Date,
    lastLogin: Date,
  },
  {
    timestamps: true, // Adds createdAt and updatedAt automatically
    _id: false, // We are providing our own _id (UUID)
  },
);

// Virtual for id to match frontend expectation
userSchema.virtual('id').get(function () {
  return this._id;
});

// Configure options for toJSON and toObject
const options = {
  virtuals: true,
  versionKey: false,
  transform: (doc, ret) => {
    delete ret._id;
    return ret;
  },
};

userSchema.set('toJSON', {
  ...options,
  transform: (doc, ret) => {
    delete ret._id;
    delete ret.password; // toJSON removes password for safety
    return ret;
  },
});

userSchema.set('toObject', options); // toObject KEEPS password

const User = mongoose.model('User', userSchema);

export default User;
