import Block from '../models/Block.js';
import Report from '../models/Report.js';
import Match from '../models/Match.js';

/**
 * Block a user
 */
export const blockUser = async (req, res) => {
  try {
    const { blockerId, blockedId, reason } = req.body;

    if (!blockerId || !blockedId) {
      return res.status(400).json({
        success: false,
        message: 'blockerId and blockedId are required',
      });
    }

    if (blockerId === blockedId) {
      return res.status(400).json({
        success: false,
        message: 'Cannot block yourself',
      });
    }

    // Check if already blocked
    const existingBlock = await Block.findOne({ blockerId, blockedId });
    if (existingBlock) {
      return res.status(400).json({
        success: false,
        message: 'User is already blocked',
      });
    }

    // Create block
    const block = await Block.create({
      blockerId,
      blockedId,
      reason: reason || null,
    });

    // Disable chat in any matches between these users
    await Match.updateMany(
      { users: { $all: [blockerId, blockedId] } },
      { $set: { chatEnabled: false } }
    );

    res.json({
      success: true,
      message: 'User blocked successfully',
      block,
    });

  } catch (error) {
    console.error('Error blocking user:', error);
    res.status(500).json({
      success: false,
      message: 'Error blocking user',
      error: error.message,
    });
  }
};

/**
 * Unblock a user
 */
export const unblockUser = async (req, res) => {
  try {
    const { blockerId, blockedId } = req.body;

    if (!blockerId || !blockedId) {
      return res.status(400).json({
        success: false,
        message: 'blockerId and blockedId are required',
      });
    }

    const result = await Block.findOneAndDelete({ blockerId, blockedId });

    if (!result) {
      return res.status(404).json({
        success: false,
        message: 'Block not found',
      });
    }

    // Re-enable chat in matches (only if not blocked by the other user)
    const reverseBlock = await Block.findOne({
      blockerId: blockedId,
      blockedId: blockerId,
    });

    if (!reverseBlock) {
      await Match.updateMany(
        { users: { $all: [blockerId, blockedId] } },
        { $set: { chatEnabled: true } }
      );
    }

    res.json({
      success: true,
      message: 'User unblocked successfully',
    });

  } catch (error) {
    console.error('Error unblocking user:', error);
    res.status(500).json({
      success: false,
      message: 'Error unblocking user',
      error: error.message,
    });
  }
};

/**
 * Get list of blocked users
 */
export const getBlockedUsers = async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'userId is required',
      });
    }

    const blocks = await Block.find({ blockerId: userId });

    res.json({
      success: true,
      blockedUsers: blocks.map(b => ({
        blockedId: b.blockedId,
        blockedAt: b.createdAt,
        reason: b.reason,
      })),
    });

  } catch (error) {
    console.error('Error getting blocked users:', error);
    res.status(500).json({
      success: false,
      message: 'Error getting blocked users',
      error: error.message,
    });
  }
};

/**
 * Check if a user is blocked
 */
export const checkBlocked = async (req, res) => {
  try {
    const { userId, otherUserId } = req.params;

    const block = await Block.findOne({
      $or: [
        { blockerId: userId, blockedId: otherUserId },
        { blockerId: otherUserId, blockedId: userId },
      ],
    });

    res.json({
      success: true,
      isBlocked: !!block,
      blockedBy: block ? block.blockerId : null,
    });

  } catch (error) {
    console.error('Error checking block status:', error);
    res.status(500).json({
      success: false,
      message: 'Error checking block status',
      error: error.message,
    });
  }
};

/**
 * Report a user
 */
export const reportUser = async (req, res) => {
  try {
    const { reporterId, reportedId, matchId, reason, description } = req.body;

    if (!reporterId || !reportedId || !reason) {
      return res.status(400).json({
        success: false,
        message: 'reporterId, reportedId, and reason are required',
      });
    }

    if (reporterId === reportedId) {
      return res.status(400).json({
        success: false,
        message: 'Cannot report yourself',
      });
    }

    const validReasons = ['harassment', 'spam', 'inappropriate_content', 'fake_profile', 'underage', 'other'];
    if (!validReasons.includes(reason)) {
      return res.status(400).json({
        success: false,
        message: `Invalid reason. Valid reasons: ${validReasons.join(', ')}`,
      });
    }

    // Create report
    const report = await Report.create({
      reporterId,
      reportedId,
      matchId: matchId || null,
      reason,
      description: description || null,
    });

    res.json({
      success: true,
      message: 'User reported successfully. Our team will review this report.',
      reportId: report._id,
    });

  } catch (error) {
    console.error('Error reporting user:', error);
    res.status(500).json({
      success: false,
      message: 'Error reporting user',
      error: error.message,
    });
  }
};

/**
 * Block and report a user in one action
 */
export const blockAndReport = async (req, res) => {
  try {
    const { blockerId, blockedId, matchId, reason, description } = req.body;

    if (!blockerId || !blockedId) {
      return res.status(400).json({
        success: false,
        message: 'blockerId and blockedId are required',
      });
    }

    // Create block (if not exists)
    const existingBlock = await Block.findOne({ blockerId, blockedId });
    if (!existingBlock) {
      await Block.create({
        blockerId,
        blockedId,
        reason: reason || null,
      });

      // Disable chat
      await Match.updateMany(
        { users: { $all: [blockerId, blockedId] } },
        { $set: { chatEnabled: false } }
      );
    }

    // Create report if reason provided
    let reportId = null;
    if (reason) {
      const report = await Report.create({
        reporterId: blockerId,
        reportedId: blockedId,
        matchId: matchId || null,
        reason,
        description: description || null,
      });
      reportId = report._id;
    }

    res.json({
      success: true,
      message: 'User blocked and reported successfully',
      reportId,
    });

  } catch (error) {
    console.error('Error blocking and reporting user:', error);
    res.status(500).json({
      success: false,
      message: 'Error blocking and reporting user',
      error: error.message,
    });
  }
};

