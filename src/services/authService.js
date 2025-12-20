import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import {randomUUID} from 'crypto';
import {config} from '../config/env.js';
import {createUser, findUserByEmail, findUserById, updateUser} from '../models/userModel.js';

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

