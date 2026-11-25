import Block from '../models/Block.js';
import Report from '../models/Report.js';
import Match from '../models/Match.js';
import Profile from '../models/Profile.js';
import Pass from '../models/Pass.js';

/**
 * Block a user
 */
export const blockUser = async (req, res) => {
  try {
    const blockerId = req.user.id;
    const { blockedId, reason } = req.body;

    if (!blockedId) {
      return res.status(400).json({
        success: false,
        message: 'blockedId is required',
      });
    }

    if (blockerId === blockedId) {
      return res.status(400).json({
        success: false,
        message: 'Cannot block yourself',
      });
    }

    // Check if already blocked — return idempotent success so retries never fail
    const existingBlock = await Block.findOne({ blockerId, blockedId });
    if (existingBlock) {
      return res.json({
        success: true,
        alreadyBlocked: true,
        message: 'User blocked successfully',
        block: existingBlock,
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
    const blockerId = req.user.id;
    const { blockedId } = req.body;

    if (!blockedId) {
      return res.status(400).json({
        success: false,
        message: 'blockedId is required',
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

    // Also remove any existing Pass record so the unblocked user can
    // reappear in the discovery feed on the next refresh.
    await Pass.findOneAndDelete({ userId: blockerId, passedUserId: blockedId });

    res.json({
      success: true,
      message: 'User unblocked successfully. They may appear in your discovery again.',
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
    const userId = req.user.id;
    if (req.params.userId && req.params.userId !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden',
      });
    }

    const blocks = await Block.find({ blockerId: userId });
    const blockedUserIds = blocks.map(b => b.blockedId);

    // Fetch profile data for blocked users
    const profiles = await Profile.find({ userId: { $in: blockedUserIds } });
    const profileMap = profiles.reduce((acc, p) => {
      acc[p.userId] = {
        name: `${p.basicInfo?.firstName || ''} ${p.basicInfo?.lastName || ''}`.trim() || 'Pryvo User',
        photo: p.media?.media?.[0]?.url || p.photos?.[0] || null,
      };
      return acc;
    }, {});

    res.json({
      success: true,
      blockedUsers: blocks.map(b => ({
        blockedId: b.blockedId,
        blockedAt: b.createdAt,
        reason: b.reason,
        name: profileMap[b.blockedId]?.name || 'Pryvo User',
        photo: profileMap[b.blockedId]?.photo || null,
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
    const userId = req.user.id;
    const { otherUserId } = req.params;
    if (req.params.userId && req.params.userId !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden',
      });
    }

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
    const reporterId = req.user.id;
    const { reportedId, matchId, reason, description } = req.body;

    if (!reportedId || !reason) {
      return res.status(400).json({
        success: false,
        message: 'reportedId and reason are required',
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
    const blockerId = req.user.id;
    const { blockedId, matchId, reason, description } = req.body;

    if (!blockedId) {
      return res.status(400).json({
        success: false,
        message: 'blockedId is required',
      });
    }

    // Create block (idempotent — safe against double-taps / race conditions)
    let existingBlock = await Block.findOne({ blockerId, blockedId });
    if (!existingBlock) {
      try {
        existingBlock = await Block.create({
          blockerId,
          blockedId,
          reason: reason || null,
        });
      } catch (dupErr) {
        if (dupErr?.code !== 11000) throw dupErr;
      }

      // Disable chat
      await Match.updateMany(
        { users: { $all: [blockerId, blockedId] } },
        { $set: { chatEnabled: false } }
      );
    }

    // Create report if reason provided (normalize spacing & fallback to 'other' so blocking never fails)
    let reportId = null;
    if (reason) {
      const validReasons = ['harassment', 'spam', 'inappropriate_content', 'fake_profile', 'underage', 'other'];
      const normalized = String(reason).trim().toLowerCase().replace(/\s+/g, '_');
      const safeReason = validReasons.includes(normalized) ? normalized : 'other';
      const report = await Report.create({
        reporterId: blockerId,
        reportedId: blockedId,
        matchId: matchId || null,
        reason: safeReason,
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

