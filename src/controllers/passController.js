import Pass from '../models/Pass.js';
import Like from '../models/Like.js';
import {isUserPremium} from '../models/Subscription.js';

export const passUser = async (req, res) => {
  try {
    const {userId, passedUserId} = req.body;
    await Pass.create({userId, passedUserId});
    res.json({success: true});
  } catch (error) {
    res.status(500).json({message: 'Error passing user', error});
  }
};

/**
 * Undo last swipe (premium only)
 * Allows premium users to undo their last pass (reject)
 */
export const undoLastSwipe = async (req, res) => {
  try {
    const {userId} = req.body;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'userId is required',
      });
    }

    // Check if user is premium
    const isPremium = await isUserPremium(userId);
    if (!isPremium) {
      return res.status(403).json({
        success: false,
        message: 'Undo is a premium feature. Upgrade to unlock!',
        requiresPremium: true,
      });
    }

    // Find and remove the most recent pass
    const lastPass = await Pass.findOne({userId})
      .sort({createdAt: -1})
      .limit(1);

    if (!lastPass) {
      // Check for a like to undo
      const lastLike = await Like.findOne({senderId: userId})
        .sort({createdAt: -1})
        .limit(1);

      if (!lastLike) {
        return res.status(404).json({
          success: false,
          message: 'No recent swipe to undo',
        });
      }

      // Undo the like
      await Like.deleteOne({_id: lastLike._id});

      return res.json({
        success: true,
        undoneAction: 'like',
        undoneUserId: lastLike.receiverId,
        message: 'Like undone successfully',
      });
    }

    // Check if pass is within last 5 minutes (optional time limit)
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    if (lastPass.createdAt < fiveMinutesAgo) {
      return res.status(400).json({
        success: false,
        message: 'Can only undo swipes within the last 5 minutes',
      });
    }

    // Undo the pass
    await Pass.deleteOne({_id: lastPass._id});

    res.json({
      success: true,
      undoneAction: 'pass',
      undoneUserId: lastPass.passedUserId,
      message: 'Swipe undone successfully',
    });
  } catch (error) {
    console.error('Error undoing swipe:', error);
    res.status(500).json({
      success: false,
      message: 'Error undoing swipe',
      error: error.message,
    });
  }
};

/**
 * Get undo status - check if user can undo and what they would undo
 */
export const getUndoStatus = async (req, res) => {
  try {
    const {userId} = req.params;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'userId is required',
      });
    }

    // Check premium status
    const isPremium = await isUserPremium(userId);

    // Find most recent action (pass or like)
    const lastPass = await Pass.findOne({userId})
      .sort({createdAt: -1})
      .limit(1);

    const lastLike = await Like.findOne({senderId: userId})
      .sort({createdAt: -1})
      .limit(1);

    // Determine which is more recent
    let canUndo = false;
    let lastAction = null;
    let lastActionTime = null;

    if (lastPass && lastLike) {
      if (lastPass.createdAt > lastLike.createdAt) {
        lastAction = 'pass';
        lastActionTime = lastPass.createdAt;
      } else {
        lastAction = 'like';
        lastActionTime = lastLike.createdAt;
      }
    } else if (lastPass) {
      lastAction = 'pass';
      lastActionTime = lastPass.createdAt;
    } else if (lastLike) {
      lastAction = 'like';
      lastActionTime = lastLike.createdAt;
    }

    // Check if within 5 minute window
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    if (lastActionTime && lastActionTime > fiveMinutesAgo) {
      canUndo = true;
    }

    res.json({
      success: true,
      isPremium,
      canUndo: isPremium && canUndo,
      lastAction,
      lastActionTime,
      requiresPremium: !isPremium && canUndo,
    });
  } catch (error) {
    console.error('Error getting undo status:', error);
    res.status(500).json({
      success: false,
      message: 'Error getting undo status',
      error: error.message,
    });
  }
};

/**
 * Reset all passes for a user
 * This allows a user to see previously passed profiles again
 */
export const resetPasses = async (req, res) => {
  try {
    const {userId} = req.body;
    if (!userId) {
      return res
        .status(400)
        .json({success: false, message: 'userId is required'});
    }
    await Pass.deleteMany({userId});
    res.json({success: true, message: 'Passes reset successfully'});
  } catch (error) {
    console.error('Error resetting passes:', error);
    res.status(500).json({
      success: false,
      message: 'Error resetting passes',
      error: error.message,
    });
  }
};
