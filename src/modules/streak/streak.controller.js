import streakService from './streak.service.js';

export const getLeaderboard = async (req, res) => {
  try {
    const flag = process.env.FEATURE_STREAK_ENABLED;
    if (flag !== undefined && flag !== 'true') {
      return res
        .status(200)
        .json({success: true, leaderboard: [], message: 'Feature disabled'});
    }
    const leaderboard = await streakService.getLeaderboard(50);
    res.status(200).json({success: true, leaderboard});
  } catch (error) {
    console.error('[Streak Controller] getLeaderboard error:', error);
    res.status(500).json({success: false, message: 'Internal server error'});
  }
};

export const getPairStreak = async (req, res) => {
  try {
    const {userId, partnerId} = req.query;
    if (!userId || !partnerId) {
      return res
        .status(400)
        .json({
          success: false,
          message: 'Both userId and partnerId are required',
        });
    }

    const flag = process.env.FEATURE_STREAK_ENABLED;
    if (flag !== undefined && flag !== 'true') {
      return res.status(200).json({success: true, streak: null});
    }

    const streak = await streakService.getPairStreak(userId, partnerId);
    res.status(200).json({success: true, streak});
  } catch (error) {
    console.error('[Streak Controller] getPairStreak error:', error);
    res.status(500).json({success: false, message: 'Internal server error'});
  }
};

export const getUserStreaks = async (req, res) => {
  try {
    const {userId} = req.query;
    if (!userId) {
      return res
        .status(400)
        .json({success: false, message: 'userId is required'});
    }

    const flag = process.env.FEATURE_STREAK_ENABLED;
    if (flag !== undefined && flag !== 'true') {
      return res.status(200).json({success: true, streaks: []});
    }

    const streaks = await streakService.getUserStreaks(userId);
    res.status(200).json({success: true, streaks});
  } catch (error) {
    console.error('[Streak Controller] getUserStreaks error:', error);
    res.status(500).json({success: false, message: 'Internal server error'});
  }
};
