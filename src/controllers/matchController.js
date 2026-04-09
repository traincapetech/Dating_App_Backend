import Match from '../models/Match.js';
import Message from '../models/Message.js';
import {getProfile} from '../services/profileService.js';
import User from '../models/User.js';
import { resolveDisplayName } from '../utils/nameUtils.js';
import Like from '../models/Like.js';

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Helper to determine the last interaction time for a match
 * and check if it has expired based on 7 days of inactivity.
 */
async function syncMatchExpiration(match) {
  // 1. EXIT GUARD: Secured matches (confirmed dates) never expire.
  if (match.status === 'secured') {
    return false;
  }

  // 2. LIFECYCLE ISOLATION: Only look for messages within the current lifecycle (since createdAt).
  // Using $gte ensures the first message in a new lifecycle is correctly captured.
  const latestMessage = await Message.findOne({
    matchId: match._id,
    timestamp: { $gte: match.createdAt } 
  })
    .sort({timestamp: -1})
    .select('timestamp');

  // 3. ANCHOR: Use latest message timestamp, fallback to current lifecycle start.
  const lastInteractionTime = latestMessage
    ? new Date(latestMessage.timestamp)
    : new Date(match.createdAt);

  const now = new Date();
  const isExpired = now - lastInteractionTime > SEVEN_DAYS_MS;

  // 4. TRANSITION: Active -> Expired (One-Directional)
  if (isExpired && match.status === 'active') {
    match.status = 'expired';
    match.chatEnabled = false;
    await match.save();

    console.log(`[Expiry Sync] Match ${match._id} expired.`);

    // Reset likes to allow re-swiping (Requirement #3)
    try {
      await Like.deleteMany({
        $or: [
          {senderId: match.users[0], receiverId: match.users[1]},
          {senderId: match.users[1], receiverId: match.users[0]},
        ],
      });
    } catch (err) {
      console.error('[Match Reset] Error deleting likes:', err);
    }

    return true;
  }

  // 5. RECOVERY LOGIC: If it's marked expired but has recent interaction, re-enable it
  if (!isExpired && match.status === 'expired') {
    match.status = 'active';
    match.chatEnabled = true;
    console.log(
      `[Expiry Fix] Recovered prematurely expired match: ${match._id}`,
    );
    await match.save();
    return false; // Not expired anymore
  }

  // 6. METADATA SYNC: Keep 'expiresAt' accurate for the UI
  // Only update for active matches to avoid logic conflicts in expired states.
  if (match.status === 'active') {
    const computedExpiresAt = new Date(lastInteractionTime.getTime() + SEVEN_DAYS_MS);
    
    // Update only if mismatch is significant (> 1 minute)
    if (!match.expiresAt || Math.abs(match.expiresAt - computedExpiresAt) > 60000) {
      match.expiresAt = computedExpiresAt;
      await match.save();
    }
  }

  // 7. CLEANUP: If already expired and remains inactive, ensure stale likes are cleaned up (Heal)
  if (match.status === 'expired') {
    const staleThreshold = new Date(Date.now() - SEVEN_DAYS_MS);
    try {
      const {deletedCount} = await Like.deleteMany({
        createdAt: {$lt: staleThreshold},
        $or: [
          {senderId: match.users[0], receiverId: match.users[1]},
          {senderId: match.users[1], receiverId: match.users[0]},
        ],
      });
      if (deletedCount > 0) {
        console.log(
          `[Match Heal] Cleaned ${deletedCount} stale likes for expired match: ${match._id}`,
        );
      }
    } catch (err) {
      console.error('[Match Heal] Error cleaning likes:', err);
    }
    return true;
  }

  return false; // Active
}

export const getUserMatches = async (req, res) => {
  try {
    const {userId} = req.params;

    if (!userId) {
      return res
        .status(400)
        .json({success: false, message: 'userId is required'});
    }

    // Include all possible match states for evaluation/display
    const allMatches = await Match.find({
      users: userId,
      $or: [
        {chatEnabled: true},
        {status: 'active'},
        {status: 'secured'},
        {status: 'expired'},
      ],
    }).sort({lastMessageAt: -1, createdAt: -1});

    // Check expiration and potentially update matches
    // Note: We process them sequentially to ensure DB consistency during the fetch
    const activeMatches = [];
    for (const match of allMatches) {
      const isExpired = await syncMatchExpiration(match);
      if (!isExpired) {
        activeMatches.push(match);
      }
    }

    // Deduplicate by user pair
    const seenPairs = new Set();
    const matches = activeMatches.filter(match => {
      const pairKey = [...match.users].sort().join(':');
      if (seenPairs.has(pairKey)) return false;
      seenPairs.add(pairKey);
      return true;
    });

    // Enrich matches with profile info of the other user
    const enrichedMatches = (
      await Promise.all(
        matches.map(async match => {
          const theirId = match.users.find(u => u !== userId);
          const theirProfile = await getProfile(theirId);

          // HIDE matches if the other user has paused their profile
          if (!theirProfile || theirProfile.isPaused || theirProfile.isHidden) {
            return null;
          }

          const theirUser = await (async () => {
            try {
              const User = (await import('../models/User.js')).default;
              return await User.findById(theirId);
            } catch (e) {
              return null;
            }
          })();

          return {
            _id: match._id,
            users: match.users,
            createdAt: match.createdAt,
            lastMessageAt: match.lastMessageAt || match.createdAt,
            chatEnabled: match.chatEnabled,
            callEnabled: match.callEnabled,
            theirId,
            theirName: resolveDisplayName(theirProfile, theirUser),
            theirPhoto:
              theirProfile?.media?.media?.[0]?.url ||
              theirProfile?.photos?.[0] ||
              null,
            theirAge:
              theirProfile?.basicInfo?.age ||
              theirProfile?.personalDetails?.age ||
              theirProfile?.age ||
              null,
          };
        }),
      )
    ).filter(Boolean);

    res.json({success: true, matches: enrichedMatches});
  } catch (error) {
    console.error(error);
    res.status(500).json({success: false, message: 'Error fetching matches'});
  }
};

export const getMatchById = async (req, res) => {
  try {
    const {matchId} = req.params;
    const userId = req.headers['x-user-id'] || req.query.userId;

    if (!matchId) {
      return res
        .status(400)
        .json({success: false, message: 'matchId is required'});
    }

    const match = await Match.findById(matchId);

    if (!match) {
      return res.status(404).json({success: false, message: 'Match not found'});
    }

    // Check for expiration using dynamic inactivity logic (7 days)
    const isExpired = await syncMatchExpiration(match);

    if (isExpired) {
      // Optional: We could still return the match object but with status: expired
      // but the existing logic seems to handle it by saving and proceeding.
    }

    // Verify user is part of this match
    if (userId && !match.users.includes(userId)) {
      return res.status(403).json({success: false, message: 'Access denied'});
    }

    const theirId = userId ? match.users.find(u => u !== userId) : null;
    const [theirProfile, theirUser] = await Promise.all([
      theirId ? getProfile(theirId) : Promise.resolve(null),
      theirId
        ? (async () => {
            try {
              const User = (await import('../models/User.js')).default;
              return await User.findById(theirId);
            } catch (e) {
              return null;
            }
          })()
        : Promise.resolve(null),
    ]);

    const theirName = resolveDisplayName(theirProfile, theirUser);

    res.json({
      success: true,
      match: {
        _id: match._id,
        users: match.users,
        createdAt: match.createdAt,
        chatEnabled: match.chatEnabled,
        callEnabled: match.callEnabled,
        theirId,
        theirName,
        theirPhoto:
          theirProfile?.media?.media?.[0]?.url ||
          theirProfile?.photos?.[0] ||
          null,
        theirAge:
          theirProfile?.basicInfo?.age ||
          theirProfile?.personalDetails?.age ||
          theirProfile?.age ||
          null,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({success: false, message: 'Error fetching match'});
  }
};

export const scheduleDate = async (req, res) => {
  try {
    const {matchId} = req.params;
    const {date, description, type} = req.body; // type: 'video' or 'in-person'
    const userId = req.body.userId; // From auth middleware usually, but taking from body if not attached yet

    if (!matchId || !date) {
      return res
        .status(400)
        .json({success: false, message: 'Match ID and Date are required'});
    }

    const match = await Match.findById(matchId);
    if (!match) {
      return res.status(404).json({success: false, message: 'Match not found'});
    }

    // Verify user
    if (!match.users.includes(userId)) {
      return res.status(403).json({success: false, message: 'Access denied'});
    }

    if (match.status === 'expired') {
      return res.status(400).json({
        success: false,
        message: 'Cannot schedule date for expired match',
      });
    }

    // Update match
    match.dateScheduled = new Date(date);
    match.status = 'secured';
    match.expiresAt = null; // Remove expiration
    await match.save();

    res.json({
      success: true,
      message: 'Date scheduled successfully! Match secured.',
      match,
    });
  } catch (error) {
    console.error('Error scheduling date:', error);
    res.status(500).json({success: false, message: 'Error scheduling date'});
  }
};

export const createMatch = async (req, res) => {
  try {
    const {userA, userB} = req.body;

    if (!userA || !userB) {
      return res
        .status(400)
        .json({success: false, message: 'Both userA and userB are required'});
    }

    // Check if match already exists
    let existingMatch = await Match.findOne({
      users: {$all: [userA, userB]},
    });

    if (existingMatch) {
      // If it was unmatched or expired, re-enable it
      if (!existingMatch.chatEnabled || existingMatch.status !== 'active') {
        existingMatch.chatEnabled = true;
        existingMatch.status = 'active';
        existingMatch.createdAt = new Date(); // Reset lifecycle for expiration logic
        await existingMatch.save();
      }
      return res.json({success: true, match: existingMatch, existing: true});
    }

    const match = await Match.create({
      users: [userA, userB],
    });

    // Send email notifications (using same pattern as likeController)
    try {
      // Import at top level instead of dynamic imports
      const Profile = (await import('../models/Profile.js')).default;
      const User = (await import('../models/User.js')).default;
      const {sendMatchEmail} = await import(
        '../services/emailNotificationService.js'
      );

      // Helper function to get profile info (same as likeController)
      const getProfileInfo = async userId => {
        const [profile, user] = await Promise.all([
          Profile.findOne({userId}),
          User.findById(userId),
        ]);

        return {
          name: resolveDisplayName(profile, user),
          photo: profile?.media?.media?.[0]?.url || null,
          email: user?.email,
        };
      };

      const infoA = await getProfileInfo(userA);
      const infoB = await getProfileInfo(userB);

      // Send emails to both users
      if (infoA.email) {
        sendMatchEmail(infoA.email, infoB.name, infoB.photo).catch(err =>
          console.error('Match email error:', err),
        );
      }
      if (infoB.email) {
        sendMatchEmail(infoB.email, infoA.name, infoA.photo).catch(err =>
          console.error('Match email error:', err),
        );
      }
    } catch (emailError) {
      console.error('Failed to send match emails:', emailError);
      // Don't block response
    }

    res.status(201).json({success: true, match, existing: false});
  } catch (error) {
    console.error(error);
    res.status(500).json({success: false, message: 'Error creating match'});
  }
};

export const unmatch = async (req, res) => {
  try {
    const {matchId} = req.params;
    const {userId} = req.body;

    if (!matchId || !userId) {
      return res
        .status(400)
        .json({success: false, message: 'matchId and userId are required'});
    }

    const match = await Match.findById(matchId);

    if (!match) {
      return res.status(404).json({success: false, message: 'Match not found'});
    }

    // Verify user is part of this match
    if (!match.users.includes(userId)) {
      return res.status(403).json({success: false, message: 'Access denied'});
    }

    // Fully expire the match so both users appear in each other's
    // "Previous Interactions" and can re-swipe each other (Bug fix)
    match.chatEnabled = false;
    match.status = 'expired';
    await match.save();

    // Delete likes between the two users so re-swiping is allowed
    try {
      await Like.deleteMany({
        $or: [
          {senderId: match.users[0], receiverId: match.users[1]},
          {senderId: match.users[1], receiverId: match.users[0]},
        ],
      });
    } catch (err) {
      console.error('[Unmatch] Error deleting likes:', err);
    }

    res.json({success: true, message: 'Match unmatched successfully'});
  } catch (error) {
    console.error(error);
    res.status(500).json({success: false, message: 'Error unmatching'});
  }
};

// NEW: Get expired matches for "Previous Interactions" section
export const getPreviousInteractions = async (req, res) => {
  try {
    const {userId} = req.params;

    if (!userId) {
      return res
        .status(400)
        .json({success: false, message: 'userId is required'});
    }

    // Fetch all matches for the user to determine current active state (Requirement #2: Prevent duplicates)
    const [expiredMatches, activeMatches] = await Promise.all([
      // Include expired matches AND legacy unmatched records (chatEnabled: false, status: active)
      // The legacy case existed before the unmatch fix that now correctly sets status: 'expired'
      Match.find({
        users: userId,
        $or: [
          { status: 'expired' },
          { status: 'active', chatEnabled: false },
        ],
      }).sort({ lastMessageAt: -1, createdAt: -1 }),
      Match.find({ users: userId, status: { $in: ['active', 'secured'] }, chatEnabled: { $ne: false } })
    ]);

    // Create a set of users who are ALREADY active matches
    // These should NEVER appear as "previous" interactions
    const activeUserIds = new Set();
    activeMatches.forEach(m => {
      const otherId = m.users.find(u => u !== userId);
      if (otherId) activeUserIds.add(otherId);
    });

    // Enrich and filter matches
    const uniqueUserIds = new Set();
    const enrichedMatches = (
      await Promise.all(
        expiredMatches.map(async match => {
          const theirId = match.users.find(u => u !== userId);
          
          // 🛑 CRITICAL FILTER: If they are active matches OR already in the prev list, skip (Requirement #2)
          if (!theirId || activeUserIds.has(theirId) || uniqueUserIds.has(theirId)) {
            return null;
          }
          uniqueUserIds.add(theirId);

          const theirProfile = await getProfile(theirId);

          // HIDE matches if the other user has paused their profile
          if (!theirProfile || theirProfile.isPaused || theirProfile.isHidden) {
            return null;
          }

          const theirUser = await (async () => {
            try {
              return await User.findById(theirId);
            } catch (e) {
              return null;
            }
          })();

          return {
            _id: match._id,
            users: match.users,
            createdAt: match.createdAt,
            lastMessageAt: match.lastMessageAt || match.createdAt,
            status: match.status,
            theirId,
            theirName: resolveDisplayName(theirProfile, theirUser),
            theirPhoto:
              theirProfile?.media?.media?.[0]?.url ||
              theirProfile?.photos?.[0] ||
              null,
            theirAge:
              theirProfile?.basicInfo?.age ||
              theirProfile?.personalDetails?.age ||
              theirProfile?.age ||
              null,
          };
        }),
      )
    ).filter(Boolean);

    res.json({success: true, matches: enrichedMatches});
  } catch (error) {
    console.error('[getPreviousInteractions] Error:', error);
    res
      .status(500)
      .json({success: false, message: 'Error fetching previous interactions'});
  }
};
