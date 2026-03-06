import streakService from './streak.service.js';
import fs from 'fs';

const logFile = 'D:\\Mohit_pryvo\\Dating_App\\server\\streak_debug.log';
const log = msg => {
  try {
    const line = `[${new Date().toISOString()}] ${msg}\n`;
    fs.appendFileSync(logFile, line);
    console.log(msg);
  } catch (err) {}
};

export const getLeaderboard = async (req, res) => {
  try {
    if (process.env.FEATURE_STREAK_ENABLED !== 'true') {
      return res
        .status(200)
        .json({success: true, leaderboard: [], message: 'Feature disabled'});
    }

    console.log('[Streak Controller] Fetching leaderboard');
    const leaderboard = await streakService.getLeaderboard(50);
    res.status(200).json({success: true, leaderboard});
  } catch (error) {
    console.error('[Streak Controller] Error:', error);
    res.status(500).json({success: false, message: 'Internal server error'});
  }
};

export const getPairStreak = async (req, res) => {
  try {
    const {userId, partnerId} = req.query;

    if (!userId || !partnerId) {
      return res.status(400).json({
        success: false,
        message: 'Both userId and partnerId are required',
      });
    }

    const flag = process.env.FEATURE_STREAK_ENABLED;
    if (flag !== undefined && flag !== 'true') {
      return res.status(200).json({success: true, streak: null});
    }

    log(
      `[Streak Controller] Fetching pair streak for ${userId} & ${partnerId}`,
    );
    const streak = await streakService.getPairStreak(userId, partnerId);
    log(
      `[Streak Controller] Pair streak for ${userId} & ${partnerId}: ${
        streak ? streak.streakCount : 'None'
      }`,
    );
    res.status(200).json({success: true, streak});
  } catch (error) {
    log(`[Streak Controller] Pair streak error: ${error.message}`);
    res.status(500).json({success: false, message: 'Internal server error'});
  }
};

export const getUserStreaks = async (req, res) => {
  try {
    const {userId} = req.query;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'userId is required',
      });
    }

    const flag = process.env.FEATURE_STREAK_ENABLED;
    if (flag !== undefined && flag !== 'true') {
      return res.status(200).json({success: true, streaks: []});
    }

    log(`[Streak Controller] Fetching streaks for user ${userId}`);
    const streaks = await streakService.getUserStreaks(userId);
    log(
      `[Streak Controller] Found ${streaks.length} streaks for user ${userId}`,
    );
    res.status(200).json({success: true, streaks});
  } catch (error) {
    log(`[Streak Controller] User streaks error: ${error.message}`);
    res.status(500).json({success: false, message: 'Internal server error'});
  }
};
