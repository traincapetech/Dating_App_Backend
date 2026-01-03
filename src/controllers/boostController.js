import {asyncHandler} from '../utils/asyncHandler.js';
import {
  createBoost,
  getActiveBoost,
  hasActiveBoost,
  getBoostHistory,
} from '../services/boostService.js';
import {isUserPremium} from '../models/Subscription.js';

/**
 * Create a new boost
 * POST /api/boost/create
 */
export const createBoostController = asyncHandler(async (req, res) => {
  const userId = req.user?.id || req.body.userId;
  if (!userId) {
    return res.status(401).json({error: 'User ID is required'});
  }

  const {duration = 30} = req.body; // Default 30 minutes

  try {
    const boost = await createBoost(userId, duration);
    res.status(200).json({
      success: true,
      boost: {
        id: boost._id,
        userId: boost.userId,
        startTime: boost.startTime,
        endTime: boost.endTime,
        duration: boost.duration,
        isActive: boost.isActive,
      },
      message: 'Profile boosted successfully',
    });
  } catch (error) {
    if (error.message.includes('premium')) {
      return res.status(403).json({
        success: false,
        error: error.message,
        requiresPremium: true,
      });
    }
    if (error.message.includes('already have an active boost')) {
      return res.status(409).json({
        success: false,
        error: error.message,
      });
    }
    res.status(400).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * Get active boost status
 * GET /api/boost/status/:userId
 */
export const getBoostStatusController = asyncHandler(async (req, res) => {
  const userId = req.user?.id || req.params.userId;
  if (!userId) {
    return res.status(401).json({error: 'User ID is required'});
  }

  const boost = await getActiveBoost(userId);
  const isPremium = await isUserPremium(userId);

  res.status(200).json({
    success: true,
    hasActiveBoost: !!boost,
    isPremium,
    boost: boost ? {
      id: boost._id,
      startTime: boost.startTime,
      endTime: boost.endTime,
      duration: boost.duration,
      timeRemaining: Math.max(0, Math.floor((new Date(boost.endTime) - new Date()) / 1000 / 60)), // minutes
    } : null,
  });
});

/**
 * Get boost history
 * GET /api/boost/history/:userId
 */
export const getBoostHistoryController = asyncHandler(async (req, res) => {
  const userId = req.user?.id || req.params.userId;
  if (!userId) {
    return res.status(401).json({error: 'User ID is required'});
  }

  const limit = parseInt(req.query.limit) || 10;
  const history = await getBoostHistory(userId, limit);

  res.status(200).json({
    success: true,
    history: history.map(boost => ({
      id: boost._id,
      startTime: boost.startTime,
      endTime: boost.endTime,
      duration: boost.duration,
      isActive: boost.isActive,
      createdAt: boost.createdAt,
    })),
  });
});

