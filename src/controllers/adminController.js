import {asyncHandler} from '../utils/asyncHandler.js';
import {verifyAdminPassword, createAdmin, getAdmins, updateAdmin, findAdminById} from '../models/Admin.js';
import jwt from 'jsonwebtoken';
import {getSubscriptions, findSubscriptionById, updateSubscription, isUserPremium} from '../models/Subscription.js';
import {getUsers, findUserById, updateUser, deleteUser} from '../models/userModel.js';
import {processRefund} from '../services/paymentService.js';
import {getAllPlans} from '../config/subscriptionPlans.js';

// Admin Login
export const adminLoginController = asyncHandler(async (req, res) => {
  const {email, password} = req.body;

  if (!email || !password) {
    return res.status(400).json({
      success: false,
      message: 'Email and password are required',
    });
  }

  const admin = await verifyAdminPassword(email, password);
  if (!admin) {
    return res.status(401).json({
      success: false,
      message: 'Invalid email or password',
    });
  }

  // Generate JWT token
  const token = jwt.sign(
    {adminId: admin.id, email: admin.email, role: admin.role},
    process.env.JWT_SECRET || 'change-me',
    {expiresIn: process.env.JWT_EXPIRES_IN || '24h'}
  );

  res.status(200).json({
    success: true,
    message: 'Login successful',
    admin: {
      id: admin.id,
      email: admin.email,
      name: admin.name,
      role: admin.role,
      permissions: admin.permissions,
    },
    token,
  });
});

// Get Admin Profile
export const getAdminProfileController = asyncHandler(async (req, res) => {
  const admin = await findAdminById(req.adminId);
  res.status(200).json({
    success: true,
    admin,
  });
});

// ==================== SUBSCRIPTION & PAYMENT MANAGEMENT ====================

// Get All Subscriptions
export const getAllSubscriptionsController = asyncHandler(async (req, res) => {
  const {status, userId, page = 1, limit = 50} = req.query;
  const subscriptions = await getSubscriptions();

  let filtered = subscriptions;

  if (status) {
    filtered = filtered.filter(sub => sub.status === status);
  }

  if (userId) {
    filtered = filtered.filter(sub => sub.userId === userId);
  }

  // Sort by created date (newest first)
  filtered.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  // Pagination
  const startIndex = (page - 1) * limit;
  const endIndex = page * limit;
  const paginated = filtered.slice(startIndex, endIndex);

  res.status(200).json({
    success: true,
    subscriptions: paginated,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total: filtered.length,
      totalPages: Math.ceil(filtered.length / limit),
    },
  });
});

// Get Subscription Details
export const getSubscriptionDetailsController = asyncHandler(async (req, res) => {
  const {subscriptionId} = req.params;
  const subscription = await findSubscriptionById(subscriptionId);

  if (!subscription) {
    return res.status(404).json({
      success: false,
      message: 'Subscription not found',
    });
  }

  res.status(200).json({
    success: true,
    subscription,
  });
});

// Process Refund
export const processRefundController = asyncHandler(async (req, res) => {
  const {subscriptionId, amount, reason} = req.body;

  if (!subscriptionId) {
    return res.status(400).json({
      success: false,
      message: 'Subscription ID is required',
    });
  }

  const subscription = await findSubscriptionById(subscriptionId);
  if (!subscription) {
    return res.status(404).json({
      success: false,
      message: 'Subscription not found',
    });
  }

  // Process refund through payment gateway
  const refundAmount = amount || subscription.price * 100; // Convert to paise
  const refundResult = await processRefund(subscription.transactionId, refundAmount);

  if (!refundResult.success) {
    return res.status(400).json({
      success: false,
      message: 'Refund processing failed',
      error: refundResult.error,
    });
  }

  // Update subscription status
  await updateSubscription(subscriptionId, {
    status: 'refunded',
    refundedAt: new Date().toISOString(),
    refundAmount: refundAmount / 100,
    refundReason: reason || 'Admin refund',
    refundId: refundResult.refundId,
  });

  // Update user premium status
  const isPremium = await isUserPremium(subscription.userId);
  await updateUser(subscription.userId, {
    isPremium: false,
    premiumExpiresAt: null,
  });

  res.status(200).json({
    success: true,
    message: 'Refund processed successfully',
    refund: {
      refundId: refundResult.refundId,
      amount: refundAmount / 100,
      subscriptionId,
    },
  });
});

// Cancel Subscription (Admin)
export const cancelSubscriptionAdminController = asyncHandler(async (req, res) => {
  const {subscriptionId} = req.params;
  const {reason} = req.body;

  const subscription = await findSubscriptionById(subscriptionId);
  if (!subscription) {
    return res.status(404).json({
      success: false,
      message: 'Subscription not found',
    });
  }

  await updateSubscription(subscriptionId, {
    status: 'cancelled',
    cancelledAt: new Date().toISOString(),
    cancellationReason: reason || 'Cancelled by admin',
    cancelledBy: req.adminId,
  });

  res.status(200).json({
    success: true,
    message: 'Subscription cancelled successfully',
  });
});

// Get Payment Statistics
export const getPaymentStatsController = asyncHandler(async (req, res) => {
  const subscriptions = await getSubscriptions();
  const now = new Date();

  const stats = {
    total: subscriptions.length,
    active: subscriptions.filter(s => s.status === 'active').length,
    cancelled: subscriptions.filter(s => s.status === 'cancelled').length,
    expired: subscriptions.filter(s => s.status === 'expired').length,
    refunded: subscriptions.filter(s => s.status === 'refunded').length,
    totalRevenue: subscriptions
      .filter(s => s.status === 'active' || s.status === 'expired')
      .reduce((sum, s) => sum + (s.price || 0), 0),
    monthlyRevenue: subscriptions
      .filter(s => {
        const created = new Date(s.createdAt);
        const monthAgo = new Date(now);
        monthAgo.setMonth(monthAgo.getMonth() - 1);
        return created >= monthAgo && (s.status === 'active' || s.status === 'expired');
      })
      .reduce((sum, s) => sum + (s.price || 0), 0),
    byPlan: {},
  };

  // Group by plan
  subscriptions.forEach(sub => {
    if (!stats.byPlan[sub.planId]) {
      stats.byPlan[sub.planId] = {count: 0, revenue: 0};
    }
    stats.byPlan[sub.planId].count++;
    if (sub.status === 'active' || sub.status === 'expired') {
      stats.byPlan[sub.planId].revenue += sub.price || 0;
    }
  });

  res.status(200).json({
    success: true,
    stats,
  });
});

// ==================== USER MANAGEMENT ====================

// Get All Users
export const getAllUsersController = asyncHandler(async (req, res) => {
  const {page = 1, limit = 50, search, isPremium} = req.query;
  let users = await getUsers();

  // Filter by search
  if (search) {
    const searchLower = search.toLowerCase();
    users = users.filter(user =>
      user.email?.toLowerCase().includes(searchLower) ||
      user.fullName?.toLowerCase().includes(searchLower) ||
      user.phone?.includes(search)
    );
  }

  // Filter by premium status
  if (isPremium !== undefined) {
    users = users.filter(user => user.isPremium === (isPremium === 'true'));
  }

  // Sort by created date (newest first)
  users.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

  // Pagination
  const startIndex = (page - 1) * limit;
  const endIndex = page * limit;
  const paginated = users.slice(startIndex, endIndex);

  // Remove sensitive data
  const sanitized = paginated.map(user => {
    const {password, ...userWithoutPassword} = user;
    return userWithoutPassword;
  });

  res.status(200).json({
    success: true,
    users: sanitized,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total: users.length,
      totalPages: Math.ceil(users.length / limit),
    },
  });
});

// Get User Details
export const getUserDetailsController = asyncHandler(async (req, res) => {
  const {userId} = req.params;
  const user = await findUserById(userId);

  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'User not found',
    });
  }

  // Get user's subscriptions
  const subscriptions = await getSubscriptions();
  const userSubscriptions = subscriptions.filter(s => s.userId === userId);

  const {password, ...userWithoutPassword} = user;

  res.status(200).json({
    success: true,
    user: userWithoutPassword,
    subscriptions: userSubscriptions,
  });
});

// Suspend/Activate User
export const toggleUserStatusController = asyncHandler(async (req, res) => {
  const {userId} = req.params;
  const {suspended, reason} = req.body;

  const user = await findUserById(userId);
  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'User not found',
    });
  }

  await updateUser(userId, {
    isSuspended: suspended,
    suspensionReason: reason,
    suspendedAt: suspended ? new Date().toISOString() : null,
    suspendedBy: req.adminId,
  });

  res.status(200).json({
    success: true,
    message: `User ${suspended ? 'suspended' : 'activated'} successfully`,
  });
});

// Delete User
export const deleteUserController = asyncHandler(async (req, res) => {
  const {userId} = req.params;
  const {reason} = req.body;

  const user = await findUserById(userId);
  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'User not found',
    });
  }

  await deleteUser(userId);

  res.status(200).json({
    success: true,
    message: 'User deleted successfully',
  });
});

// ==================== ANALYTICS ====================

// Get Dashboard Analytics
export const getDashboardAnalyticsController = asyncHandler(async (req, res) => {
  const users = await getUsers();
  const subscriptions = await getSubscriptions();
  const now = new Date();
  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const analytics = {
    users: {
      total: users.length,
      active: users.filter(u => !u.isSuspended).length,
      suspended: users.filter(u => u.isSuspended).length,
      premium: users.filter(u => u.isPremium).length,
      newLast30Days: users.filter(u => {
        const created = new Date(u.createdAt || 0);
        return created >= thirtyDaysAgo;
      }).length,
    },
    subscriptions: {
      total: subscriptions.length,
      active: subscriptions.filter(s => s.status === 'active').length,
      revenue: {
        total: subscriptions
          .filter(s => s.status === 'active' || s.status === 'expired')
          .reduce((sum, s) => sum + (s.price || 0), 0),
        last30Days: subscriptions
          .filter(s => {
            const created = new Date(s.createdAt);
            return created >= thirtyDaysAgo && (s.status === 'active' || s.status === 'expired');
          })
          .reduce((sum, s) => sum + (s.price || 0), 0),
      },
    },
    plans: getAllPlans().map(plan => ({
      id: plan.id,
      name: plan.name,
      price: plan.price,
      count: subscriptions.filter(s => s.planId === plan.id).length,
    })),
  };

  res.status(200).json({
    success: true,
    analytics,
  });
});

