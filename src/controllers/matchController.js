import Match from '../models/Match.js';
import {getProfile} from '../services/profileService.js';

export const getUserMatches = async (req, res) => {
  try {
    const {userId} = req.params;

    if (!userId) {
      return res
        .status(400)
        .json({success: false, message: 'userId is required'});
    }

    const allMatches = await Match.find({
      users: userId,
      chatEnabled: true,
    }).sort({createdAt: -1});

    // Deduplicate by user pair
    const seenPairs = new Set();
    const matches = allMatches.filter(match => {
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

    // Check for expiration
    if (
      match.status === 'active' &&
      match.expiresAt &&
      new Date() > new Date(match.expiresAt)
    ) {
      match.status = 'expired';
      match.chatEnabled = false; // Disable chat
      await match.save();
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
    const existingMatch = await Match.findOne({
      users: {$all: [userA, userB]},
    });

    if (existingMatch) {
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
