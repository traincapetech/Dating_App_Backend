import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import {randomUUID, randomInt} from 'crypto';
import {config} from '../config/env.js';
import {
  createUser,
  findUserByEmail,
  findUserById,
  findUserByGoogleId,
  updateUser,
} from '../models/userModel.js';
import {sendEmailOTP} from './emailService.js';

function generateTokens(user) {
  const payload = {
    sub: user.id || user._id,
    email: user.email,
    tokenVersion: user.tokenVersion || '0',
  };
  const accessToken = jwt.sign(payload, config.jwtSecret, {
    expiresIn: config.jwtExpiresIn,
  });
  const refreshToken = jwt.sign(payload, config.refreshSecret, {
    expiresIn: config.refreshExpiresIn,
  });
  return {accessToken, refreshToken};
}

export async function refreshAccessToken(refreshToken) {
  let decoded;
  try {
    decoded = jwt.verify(refreshToken, config.refreshSecret);
  } catch (err) {
    const error = new Error('Invalid or expired refresh token.');
    error.status = 401;
    throw error;
  }

  const userId = decoded.sub || decoded.userId || decoded.id;
  const user = await findUserById(userId);
  if (!user) {
    const error = new Error('User not found.');
    error.status = 401;
    throw error;
  }

  // Check token version (in case of logout-all-devices)
  if (
    decoded.tokenVersion &&
    user.tokenVersion &&
    decoded.tokenVersion !== user.tokenVersion
  ) {
    const error = new Error('Session has been invalidated. Please log in again.');
    error.status = 401;
    throw error;
  }

  const tokens = generateTokens(user);
  return {
    tokens,
    user: {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      phone: user.phone || '',
    },
  };
}


export async function registerUser({fullName, email, phone, password}) {
  const normalizedEmail = email.trim().toLowerCase();
  const sanitizedName = fullName.trim();
  const sanitizedPhone = phone.trim();

  const existing = await findUserByEmail(normalizedEmail);
  if (existing) {
    const error = new Error('An account already exists with this email.');
    error.status = 409;
    throw error;
  }

  const hashedPassword = await bcrypt.hash(password, config.saltRounds);
  const user = {
    id: randomUUID(),
    fullName: sanitizedName,
    email: normalizedEmail,
    phone: sanitizedPhone,
    password: hashedPassword,
    createdAt: new Date().toISOString(),
  };

  const savedUser = await createUser(user);
  const tokens = generateTokens(savedUser);

  return {
    user: {
      id: savedUser.id,
      fullName: savedUser.fullName,
      email: savedUser.email,
      phone: savedUser.phone,
    },
    tokens,
  };
}

// ── Security constants ────────────────────────────────────────────────────────
const MAX_FAILED_BEFORE_LOCK    = 5;  // Lock account after this many failures
const LOCK_DURATION_MS = 15 * 60 * 1000; // 15 minutes
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Core login with:
 *  - Account lock enforcement
 *  - Failed attempt tracking + auto-lock at 5
 *  - Counter reset on success
 *  - IP tracking + suspicious-activity logging
 */
export async function authenticateUser({ email, password, ip = null, device = null }) {
  const normalizedEmail = email.trim().toLowerCase();

  // SECURITY:  We look up the user but never reveal whether the email
  // exists.  All "bad credentials" paths return the same generic message.
  const user = await findUserByEmail(normalizedEmail);

  // ── 1. ACCOUNT LOCK CHECK ─────────────────────────────────────────────────
  if (user && user.lockUntil && new Date(user.lockUntil) > new Date()) {
    const remainingMs  = new Date(user.lockUntil) - new Date();
    const remainingMin = Math.ceil(remainingMs / 60000);
    const error = new Error(
      `Account temporarily locked. Try again after ${remainingMin} minute${remainingMin !== 1 ? 's' : ''}.`
    );
    error.status = 423; // 423 Locked
    error.remainingMinutes = remainingMin;
    console.warn(`[Auth] Locked account login attempt — email: ${normalizedEmail}, IP: ${ip}`);
    throw error;
  }


  // ── 3. CREDENTIAL VALIDATION ──────────────────────────────────────────────
  const passwordValid =
    user && user.password
      ? await bcrypt.compare(password, user.password)
      : false;

  if (!user || !passwordValid) {
    // Google-only account special case
    if (user && !user.password && user.authProvider === 'google') {
      const error = new Error(
        'This account uses Google Sign-In. Please use the Google button to log in.',
      );
      error.status = 401;
      throw error;
    }

    // ── 3a. INCREMENT FAILED ATTEMPTS ────────────────────────────────────────
    if (user) {
      const newCount = (user.failedAttempts || 0) + 1;
      const updatePayload = { failedAttempts: newCount };

      if (newCount >= MAX_FAILED_BEFORE_LOCK) {
        updatePayload.lockUntil = new Date(Date.now() + LOCK_DURATION_MS);
        console.warn(
          `[Auth Security] Account LOCKED — email: ${normalizedEmail}, IP: ${ip}, attempts: ${newCount}`
        );
      } else {
        console.warn(
          `[Auth Security] Failed attempt ${newCount}/${MAX_FAILED_BEFORE_LOCK} — email: ${normalizedEmail}, IP: ${ip}`
        );
      }

      // Fire-and-forget counter update (don't block response)
      updateUser(user.id, updatePayload).catch(e =>
        console.error('[Auth] Failed to update failed attempt counter:', e.message)
      );
    }

    // Unknown email — same generic message to prevent enumeration
    const error = new Error('Invalid email or password.');
    error.status = 401;
    throw error;
  }

  // ── 4. SUCCESS — reset counters ───────────────────────────────────────────
  updateUser(user.id, {
    failedAttempts: 0,
    lockUntil: null,
    lastLogin: new Date(),
    lastLoginIp: ip,
    lastLoginDevice: device,
  }).catch(e => console.error('[Auth] Failed to reset security counters:', e.message));

  const tokens = generateTokens(user);

  return {
    user: {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      phone: user.phone,
    },
    tokens,
  };
}



export async function changeEmail({userId, newEmail, password}) {
  const normalizedNewEmail = newEmail.trim().toLowerCase();
  const user = await findUserById(userId);
  if (!user) {
    const error = new Error('User not found.');
    error.status = 404;
    throw error;
  }
  const passwordValid = await bcrypt.compare(password, user.password);
  if (!passwordValid) {
    const error = new Error('Invalid password.');
    error.status = 401;
    throw error;
  }
  const existing = await findUserByEmail(normalizedNewEmail);
  if (existing && existing.id !== userId) {
    const error = new Error('An account already exists with this email.');
    error.status = 409;
    throw error;
  }
  const updatedUser = await updateUser(userId, {email: normalizedNewEmail});
  return {
    success: true,
    message: 'Email updated successfully',
    user: {
      id: updatedUser.id,
      fullName: updatedUser.fullName,
      email: updatedUser.email,
      phone: updatedUser.phone,
    },
  };
}

export async function changePassword({userId, currentPassword, newPassword}) {
  const user = await findUserById(userId);
  if (!user) {
    const error = new Error('User not found.');
    error.status = 404;
    throw error;
  }
  const passwordValid = await bcrypt.compare(currentPassword, user.password);
  if (!passwordValid) {
    const error = new Error('Current password is incorrect.');
    error.status = 401;
    throw error;
  }
  const hashedPassword = await bcrypt.hash(newPassword, config.saltRounds);
  await updateUser(userId, {password: hashedPassword});
  return {
    success: true,
    message: 'Password updated successfully',
  };
}

export async function requestPasswordReset(email) {
  const normalizedEmail = email.trim().toLowerCase();
  const user = await findUserByEmail(normalizedEmail);

  // Don't reveal if user exists or not (security best practice)
  if (!user) {
    // Still return success to prevent email enumeration
    return {
      success: true,
      message:
        'If an account exists with this email, a password reset link has been sent.',
    };
  }

  // Generate reset token (6-digit OTP)
  const resetCode = randomInt(100000, 999999).toString();

  // Store reset token with expiration (15 minutes)
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

  // Store in user model
  await updateUser(user.id, {
    passwordResetToken: resetCode,
    passwordResetExpires: expiresAt,
  });

  // Send reset email with the SAME code we stored
  try {
    const {sendEmail} = await import('./emailService.js');

    const emailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Password Reset</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #FE3C72 0%, #E91E63 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="color: #ffffff; margin: 0; font-size: 28px;">Pryvo</h1>
        </div>
        <div style="background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 10px 10px;">
          <h2 style="color: #0D0D0D; margin-top: 0;">Reset Your Password</h2>
          <p style="color: #6B7280; font-size: 16px;">
            You requested to reset your password. Use the code below to reset it.
          </p>
          <div style="background: #F8F9FA; border: 2px dashed #FE3C72; border-radius: 8px; padding: 20px; text-align: center; margin: 30px 0;">
            <div style="font-size: 36px; font-weight: bold; color: #FE3C72; letter-spacing: 8px; font-family: 'Courier New', monospace;">
              ${resetCode}
            </div>
          </div>
          <p style="color: #6B7280; font-size: 14px; margin-bottom: 0;">
            This code will expire in <strong>15 minutes</strong>. If you didn't request this, please ignore this email.
          </p>
        </div>
      </body>
      </html>
    `;
    const emailText = `Reset Your Password - Pryvo\n\nYour reset code is: ${resetCode}\n\nThis code will expire in 15 minutes.`;

    await sendEmail({
      to: normalizedEmail,
      subject: 'Reset your password - Pryvo',
      html: emailHtml,
      text: emailText,
    });

    console.log(`[Password Reset] Code sent to ${normalizedEmail}`);
  } catch (error) {
    console.error('Error sending password reset email:', error);
    // Still return success to prevent email enumeration
  }

  return {
    success: true,
    message:
      'If an account exists with this email, a password reset code has been sent.',
    ...(process.env.NODE_ENV !== 'production' && {
      debugCode: resetCode,
      warning: 'Reset code included for testing only',
    }),
  };
}

export async function resetPassword({email, code, newPassword}) {
  const normalizedEmail = email.trim().toLowerCase();
  const user = await findUserByEmail(normalizedEmail);

  if (!user) {
    const error = new Error('Invalid reset code.');
    error.status = 400;
    throw error;
  }

  // Verify reset code
  if (!user.passwordResetToken || user.passwordResetToken !== code) {
    const error = new Error('Invalid reset code.');
    error.status = 400;
    throw error;
  }

  // Check expiration
  if (
    !user.passwordResetExpires ||
    new Date(user.passwordResetExpires) < new Date()
  ) {
    const error = new Error(
      'Reset code has expired. Please request a new one.',
    );
    error.status = 400;
    throw error;
  }

  // Update password
  const hashedPassword = await bcrypt.hash(newPassword, config.saltRounds);
  await updateUser(user.id, {
    password: hashedPassword,
    passwordResetToken: null,
    passwordResetExpires: null,
  });

  return {
    success: true,
    message: 'Password reset successfully',
  };
}

export async function authenticateWithGoogle({idToken}) {
  // Verify Google ID token
  const response = await fetch(
    `https://oauth2.googleapis.com/tokeninfo?id_token=${idToken}`,
  );

  if (!response.ok) {
    const error = new Error('Invalid Google token.');
    error.status = 401;
    throw error;
  }

  const googleUser = await response.json();
  const {sub: googleId, email, name, picture} = googleUser;

  if (!email) {
    const error = new Error('Google account does not have an email.');
    error.status = 400;
    throw error;
  }

  const normalizedEmail = email.trim().toLowerCase();

  // Check if user already exists by googleId
  let user = await findUserByGoogleId(googleId);

  if (!user) {
    // Check if user exists by email (existing email/password user)
    user = await findUserByEmail(normalizedEmail);

    if (user) {
      // Link existing account with Google
      user = await updateUser(user.id, {
        googleId,
        authProvider: user.authProvider === 'local' ? 'local' : 'google',
      });
    } else {
      // Create new user with Google auth
      const newUser = {
        id: randomUUID(),
        fullName: name || 'Google User',
        email: normalizedEmail,
        phone: '',
        authProvider: 'google',
        googleId,
        isVerified: true, // Google accounts are already verified
        createdAt: new Date().toISOString(),
      };

      user = await createUser(newUser);
    }
  }

  const tokens = generateTokens(user);

  // Determine if this user should go through onboarding:
  // - If they already have a profile, treat them as an existing user
  //   even if the user record itself hasn't been updated since creation.
  let isNewUser = false;
  try {
    const {findProfileByUserId} = await import('../models/profileModel.js');
    const profile = await findProfileByUserId(user.id);
    isNewUser = !profile;
  } catch (e) {
    // If profile lookup fails, fall back to previous heuristic
    console.warn(
      '[Google Auth] Failed to check profile for isNewUser, falling back:',
      e.message,
    );
    isNewUser = !user.updatedAt || user.createdAt === user.updatedAt;
  }

  return {
    user: {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      phone: user.phone || '',
    },
    tokens,
    isNewUser,
  };
}
