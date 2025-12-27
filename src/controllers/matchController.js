import Match from "../models/Match.js";
import { storage } from '../storage/index.js';

const PROFILES_PATH = 'data/profiles.json';

// Helper to get profile by user ID
async function getProfileByUserId(userId) {
  try {
    const profiles = await storage.readJson(PROFILES_PATH, []);
    return profiles.find(p => p.userId === userId);
  } catch (error) {
    console.error('Error fetching profile:', error);
    return null;
  }
}

export const getUserMatches = async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({ success: false, message: "userId is required" });
    }

    const matches = await Match.find({ 
      users: userId,
      chatEnabled: true  // Only return matches where chat is enabled (not blocked)
    });

    // Enrich matches with profile info of the other user
    const enrichedMatches = await Promise.all(
      matches.map(async (match) => {
        const theirId = match.users.find(u => u !== userId);
        const theirProfile = await getProfileByUserId(theirId);
        
        return {
          _id: match._id,
          users: match.users,
          createdAt: match.createdAt,
          chatEnabled: match.chatEnabled,
          callEnabled: match.callEnabled,
          theirId,
          theirName: theirProfile?.name || theirProfile?.firstName || null,
          theirPhoto: theirProfile?.photos?.[0] || theirProfile?.profilePhoto || null,
        };
      })
    );

    res.json({ success: true, matches: enrichedMatches });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Error fetching matches" });
  }
};

export const getMatchById = async (req, res) => {
  try {
    const { matchId } = req.params;
    const userId = req.headers['x-user-id'] || req.query.userId;

    if (!matchId) {
      return res.status(400).json({ success: false, message: "matchId is required" });
    }

    const match = await Match.findById(matchId);
    
    if (!match) {
      return res.status(404).json({ success: false, message: "Match not found" });
    }

    // Verify user is part of this match
    if (userId && !match.users.includes(userId)) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    const theirId = userId ? match.users.find(u => u !== userId) : null;
    const theirProfile = theirId ? await getProfileByUserId(theirId) : null;

    res.json({ 
      success: true, 
      match: {
        _id: match._id,
        users: match.users,
        createdAt: match.createdAt,
        chatEnabled: match.chatEnabled,
        callEnabled: match.callEnabled,
        theirId,
        theirName: theirProfile?.name || theirProfile?.firstName || null,
        theirPhoto: theirProfile?.photos?.[0] || theirProfile?.profilePhoto || null,
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Error fetching match" });
  }
};

export const createMatch = async (req, res) => {
  try {
    const { userA, userB } = req.body;

    if (!userA || !userB) {
      return res.status(400).json({ success: false, message: "Both userA and userB are required" });
    }

    // Check if match already exists
    const existingMatch = await Match.findOne({
      users: { $all: [userA, userB] }
    });

    if (existingMatch) {
      return res.json({ success: true, match: existingMatch, existing: true });
    }

    const match = await Match.create({
      users: [userA, userB]
    });

    res.status(201).json({ success: true, match, existing: false });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Error creating match" });
  }
};

export const unmatch = async (req, res) => {
  try {
    const { matchId } = req.params;
    const { userId } = req.body;

    if (!matchId || !userId) {
      return res.status(400).json({ success: false, message: "matchId and userId are required" });
    }

    const match = await Match.findById(matchId);
    
    if (!match) {
      return res.status(404).json({ success: false, message: "Match not found" });
    }

    // Verify user is part of this match
    if (!match.users.includes(userId)) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    // Disable chat for this match (unmatch)
    match.chatEnabled = false;
    await match.save();

    res.json({ success: true, message: "Match unmatched successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Error unmatching" });
  }
};
