import {storage} from '../storage/index.js';
import bcrypt from 'bcryptjs';

const ADMINS_PATH = 'data/admins.json';

export async function getAdmins() {
  return storage.readJson(ADMINS_PATH, []);
}

export async function findAdminByEmail(email) {
  const admins = await getAdmins();
  return admins.find(admin => admin.email.toLowerCase() === email.toLowerCase());
}

export async function findAdminById(adminId) {
  const admins = await getAdmins();
  return admins.find(admin => admin.id === adminId);
}

export async function createAdmin(adminData) {
  const admins = await getAdmins();
  
  // Check if admin already exists
  const existing = await findAdminByEmail(adminData.email);
  if (existing) {
    throw new Error('Admin with this email already exists');
  }

  // Hash password
  const hashedPassword = await bcrypt.hash(adminData.password, 10);

  const newAdmin = {
    id: `admin_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    email: adminData.email.toLowerCase(),
    password: hashedPassword,
    name: adminData.name,
    role: adminData.role || 'admin', // admin, super_admin, moderator
    permissions: adminData.permissions || [
      'view_users',
      'manage_users',
      'view_subscriptions',
      'manage_subscriptions',
      'process_refunds',
      'view_reports',
      'moderate_content',
      'view_analytics',
    ],
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    lastLoginAt: null,
  };

  admins.push(newAdmin);
  await storage.writeJson(ADMINS_PATH, admins);
  
  // Return admin without password
  const {password, ...adminWithoutPassword} = newAdmin;
  return adminWithoutPassword;
}

export async function updateAdmin(adminId, updates) {
  const admins = await getAdmins();
  const index = admins.findIndex(admin => admin.id === adminId);
  
  if (index === -1) {
    return null;
  }

  // If password is being updated, hash it
  if (updates.password) {
    updates.password = await bcrypt.hash(updates.password, 10);
  }

  const updatedAdmin = {
    ...admins[index],
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  admins[index] = updatedAdmin;
  await storage.writeJson(ADMINS_PATH, admins);
  
  // Return admin without password
  const {password, ...adminWithoutPassword} = updatedAdmin;
  return adminWithoutPassword;
}

export async function verifyAdminPassword(email, password) {
  const admin = await findAdminByEmail(email);
  if (!admin || !admin.isActive) {
    return null;
  }

  const isValid = await bcrypt.compare(password, admin.password);
  if (!isValid) {
    return null;
  }

  // Update last login
  await updateAdmin(admin.id, {lastLoginAt: new Date().toISOString()});

  // Return admin without password
  const {password: _, ...adminWithoutPassword} = admin;
  return adminWithoutPassword;
}

export async function hasPermission(adminId, permission) {
  const admin = await findAdminById(adminId);
  if (!admin || !admin.isActive) {
    return false;
  }

  // Super admin has all permissions
  if (admin.role === 'super_admin') {
    return true;
  }

  return admin.permissions?.includes(permission) || false;
}

