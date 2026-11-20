import mongoose from 'mongoose';

const otpSchema = new mongoose.Schema({
  email: {type: String, required: true, lowercase: true, trim: true},
  type: {type: String, default: 'email'},
  code: {type: String, required: true},
  verified: {type: Boolean, default: false},
  attempts: {type: Number, default: 0},
  expiresAt: {type: Date, required: true},
  createdAt: {type: Date, default: Date.now},
});

otpSchema.index({email: 1, type: 1}, {unique: true});
// Auto-prune expired OTP documents
otpSchema.index({expiresAt: 1}, {expireAfterSeconds: 600});

const Otp = mongoose.models.Otp || mongoose.model('Otp', otpSchema);

const MAX_VERIFY_ATTEMPTS = 5;

export async function findOTPByEmail(email, type = 'email') {
  return Otp.findOne({email: email.trim().toLowerCase(), type}).lean();
}

export async function createOTP(email, code, type = 'email') {
  const normalized = email.trim().toLowerCase();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

  const doc = await Otp.findOneAndUpdate(
    {email: normalized, type},
    {
      email: normalized,
      type,
      code,
      verified: false,
      attempts: 0,
      expiresAt,
      createdAt: new Date(),
    },
    {upsert: true, new: true, setDefaultsOnInsert: true},
  ).lean();

  return doc;
}

export async function verifyOTP(email, code, type = 'email') {
  const normalized = email.trim().toLowerCase();
  const otp = await Otp.findOne({email: normalized, type});

  if (!otp || otp.verified) {
    return {valid: false, message: 'Invalid OTP code'};
  }

  if (otp.expiresAt < new Date()) {
    return {valid: false, message: 'OTP has expired'};
  }

  if (otp.attempts >= MAX_VERIFY_ATTEMPTS) {
    return {
      valid: false,
      message: 'Too many failed attempts. Please request a new OTP.',
    };
  }

  if (otp.code !== String(code).trim()) {
    otp.attempts += 1;
    await otp.save();
    return {valid: false, message: 'Invalid OTP code'};
  }

  otp.verified = true;
  // Extend short window (15 min) so user can complete signup form after verifying OTP
  otp.expiresAt = new Date(Date.now() + 15 * 60 * 1000);
  await otp.save();

  return {valid: true, message: 'OTP verified successfully'};
}

export async function hasVerifiedOTP(email, type = 'email') {
  const normalized = email.trim().toLowerCase();
  const otp = await Otp.findOne({
    email: normalized,
    type,
    verified: true,
    expiresAt: {$gt: new Date()},
  }).lean();
  return Boolean(otp);
}

export async function deleteOTP(email, type = 'email') {
  const normalized = email.trim().toLowerCase();
  await Otp.deleteMany({email: normalized, type});
}
