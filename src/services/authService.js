import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import {randomUUID, randomInt} from 'crypto';
import {config} from '../config/env.js';
import {createUser, findUserByEmail, findUserById, updateUser} from '../models/userModel.js';
import {sendEmailOTP} from './emailService.js';

function generateTokens(user) {
  const payload = {sub: user.id, email: user.email};
  const accessToken = jwt.sign(payload, config.jwtSecret, {
    expiresIn: config.jwtExpiresIn,
  });
  const refreshToken = jwt.sign(payload, config.refreshSecret, {
    expiresIn: config.refreshExpiresIn,
  });
  return {accessToken, refreshToken};
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

export async function authenticateUser({email, password}) {
  const normalizedEmail = email.trim().toLowerCase();
  const user = await findUserByEmail(normalizedEmail);
  if (!user) {
    const error = new Error('Invalid email or password.');
    error.status = 401;
    throw error;
  }

  const passwordValid = await bcrypt.compare(password, user.password);
  if (!passwordValid) {
    const error = new Error('Invalid email or password.');
    error.status = 401;
    throw error;
  }

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
      message: 'If an account exists with this email, a password reset link has been sent.',
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

  // Send reset email via email service
  try {
    // Reuse email OTP service but with password reset template
    await sendEmailOTP(normalizedEmail);
    // Note: In production, you'd want a separate email template for password reset
  } catch (error) {
    console.error('Error sending password reset email:', error);
    // Still return success to prevent email enumeration
  }

  return {
    success: true,
    message: 'If an account exists with this email, a password reset code has been sent.',
    ...(process.env.NODE_ENV !== 'production' && { 
      debugCode: resetCode,
      warning: 'Reset code included for testing only' 
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
  if (!user.passwordResetExpires || new Date(user.passwordResetExpires) < new Date()) {
    const error = new Error('Reset code has expired. Please request a new one.');
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

