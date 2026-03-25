import Match from '../models/Match.js';
import Message from '../models/Message.js';
import {getProfile} from '../services/profileService.js';

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Helper to determine the last interaction time for a match
 * and check if it has expired based on 7 days of inactivity.
 */
async function syncMatchExpiration(match) {
  if (match.status === 'secured' || !match.expiresAt) {
    return false; // Secured matches never expire
  }

  // Get latest message for this match
  const latestMessage = await Message.findOne({matchId: match._id})
    .sort({timestamp: -1})
    .select('timestamp');

  const lastInteractionTime = latestMessage
    ? new Date(latestMessage.timestamp)
    : new Date(match.createdAt);

  const now = new Date();
  const isExpired = now - lastInteractionTime > SEVEN_DAYS_MS;

  if (isExpired && match.status === 'active') {
    match.status = 'expired';
    match.chatEnabled = false;
    await match.save();
    return true;
  }

  // RECOVERY LOGIC: If it's marked expired but has recent interaction, re-enable it
  if (!isExpired && match.status === 'expired') {
    match.status = 'active';
    match.chatEnabled = true;
    console.log(
      `[Expiry Fix] Recovered prematurely expired match: ${match._id}`,
    );
    await match.save();
    return false;
  }

  // Optional: Keep expiresAt field synced with the 7-day rule for legacy reasons or visibility
  const newExpiresAt = new Date(lastInteractionTime.getTime() + SEVEN_DAYS_MS);
  if (!match.expiresAt || Math.abs(match.expiresAt - newExpiresAt) > 60000) {
    // Only update if difference > 1 min to avoid constant saves
    match.expiresAt = newExpiresAt;
    await match.save();
  }

  return false;
}

export const getUserMatches = async (req, res) => {
  try {
    const {userId} = req.params;

    if (!userId) {
      return res
        .status(400)
        .json({success: false, message: 'userId is required'});
    }

    // Include matches that are either active OR were marked as expired
    // (so we can re-evaluate them for recovery)
    const allMatches = await Match.find({
      users: userId,
      $or: [{chatEnabled: true}, {status: 'expired'}],
    }).sort({createdAt: -1});

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
    const enrichedMatches = await Promise.all(
      matches.map(async match => {
        const theirId = match.users.find(u => u !== userId);
        const theirProfile = await getProfile(theirId);

        return {
          _id: match._id,
          users: match.users,
          createdAt: match.createdAt,
          chatEnabled: match.chatEnabled,
          callEnabled: match.callEnabled,
          theirId,
          theirName:
            theirProfile?.basicInfo?.firstName || theirProfile?.name || null,
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
    );

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
    const theirProfile = theirId ? await getProfile(theirId) : null;

    res.json({
      success: true,
      match: {
        _id: match._id,
        users: match.users,
        createdAt: match.createdAt,
        chatEnabled: match.chatEnabled,
        callEnabled: match.callEnabled,
        theirId,
        theirName:
          theirProfile?.basicInfo?.firstName || theirProfile?.name || null,
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
        const profile = await Profile.findOne({userId});
        const user = await User.findById(userId);

        return {
          name:
            profile?.basicInfo?.firstName ||
            user?.fullName ||
            user?.name ||
            'Someone',
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

    // Disable chat for this match (unmatch)
    match.chatEnabled = false;
    await match.save();

    res.json({success: true, message: 'Match unmatched successfully'});
  } catch (error) {
    console.error(error);
    res.status(500).json({success: false, message: 'Error unmatching'});
  }
};
