import {storage} from '../storage/index.js';

const OTP_PATH = 'data/otps.json';

export async function getOTPs() {
  return storage.readJson(OTP_PATH, []);
}

export async function findOTPByEmail(email) {
  const otps = await getOTPs();
  return otps.find(otp => otp.email.toLowerCase() === email.toLowerCase());
}

export async function createOTP(email, code, type = 'email') {
  const otps = await getOTPs();
  const existingIndex = otps.findIndex(
    otp => otp.email.toLowerCase() === email.toLowerCase() && otp.type === type,
  );

  const otpData = {
    email: email.toLowerCase(),
    code,
    type,
    expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(), // 10 minutes
    createdAt: new Date().toISOString(),
    verified: false,
  };

  if (existingIndex >= 0) {
    otps[existingIndex] = otpData;
  } else {
    otps.push(otpData);
  }

  await storage.writeJson(OTP_PATH, otps);
  return otpData;
}

export async function verifyOTP(email, code, type = 'email') {
  const otps = await getOTPs();
  const otp = otps.find(
    otp =>
      otp.email.toLowerCase() === email.toLowerCase() &&
      otp.code === code &&
      otp.type === type &&
      !otp.verified,
  );

  if (!otp) {
    return {valid: false, message: 'Invalid OTP code'};
  }

  const expiresAt = new Date(otp.expiresAt);
  if (expiresAt < new Date()) {
    return {valid: false, message: 'OTP has expired'};
  }

  // Mark as verified
  otp.verified = true;
  await storage.writeJson(OTP_PATH, otps);

  return {valid: true, message: 'OTP verified successfully'};
}

export async function deleteOTP(email, type = 'email') {
  const otps = await getOTPs();
  const filtered = otps.filter(
    otp =>
      !(
        otp.email.toLowerCase() === email.toLowerCase() && otp.type === type
      ),
  );
  await storage.writeJson(OTP_PATH, filtered);
}

