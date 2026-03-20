import mongoose from 'mongoose';
import PhotoInteraction from '../models/PhotoInteraction.js';
import { getIO } from '../services/socketService.js';
import { sendPushNotification } from '../services/pushService.js';

/**
 * Atomic Toggle Like with Idempotency
 */
export const toggleSocialLike = async (req, res) => {
  const { photoId, photoUrl, targetUserId } = req.body;
  const senderId = req.user.id;

  console.log("[PhotoSocial] REQ USER:", req.user);
  console.log("[PhotoSocial] REQ BODY:", req.body);

  if (!photoId || !targetUserId) {
    return res.status(400).json({ success: false, message: 'Missing required fields' });
  }

  try {
    const existing = await PhotoInteraction.findOneAndDelete({
      senderId,
      photoId,
      type: 'like'
    });

    let action = 'unliked';
    let interactionId = null;

    if (!existing) {
      const newLike = await PhotoInteraction.create({
        senderId,
        targetUserId,
        photoId,
        photoUrl,
        type: 'like'
      });
      action = 'liked';
      interactionId = newLike._id;
    }

    const stats = await getInteractionCounts(targetUserId, photoId);

    const io = getIO();
    if (io) {
      io.to(`profile_social:${targetUserId}`).emit('photo:interaction', {
        interactionId,
        action,
        photoId,
        photoUrl,
        type: 'like',
        senderId,
        counts: stats
      });
    }

    if (action === 'liked') {
      await sendPushNotification(targetUserId, {
        title: 'New Photo Like 💖',
        body: `${req.user.firstName || req.user.name || 'Someone'} liked your photo!`,
        data: { type: 'SOCIAL_PHOTO_REACTION', photoId, action: 'like' }
      }).catch(err => console.error('[PhotoSocial] Push Notify Error:', err));
    }

    return res.json({ success: true, action, counts: stats });
  } catch (error) {
    console.error('[PhotoSocial] ToggleLike Error:', error);
    res.status(500).json({ success: false, message: 'Failed to process like' });
  }
};

export const addSocialComment = async (req, res) => {
  const { photoId, photoUrl, targetUserId, text } = req.body;
  const senderId = req.user.id;

  console.log("[PhotoSocial] REQ USER:", req.user);
  console.log("[PhotoSocial] REQ BODY:", req.body);

  if (!photoId || !targetUserId || !text) {
    return res.status(400).json({ success: false, message: 'Missing required fields' });
  }

  try {
    const newComment = await PhotoInteraction.create({
      senderId,
      targetUserId,
      photoId,
      photoUrl,
      type: 'comment',
      text
    });

    const stats = await getInteractionCounts(targetUserId, photoId);

    const io = getIO();
    if (io) {
      io.to(`profile_social:${targetUserId}`).emit('photo:interaction', {
        interactionId: newComment._id,
        action: 'commented',
        photoId,
        photoUrl,
        type: 'comment',
        senderId,
        text,
        createdAt: newComment.createdAt,
        counts: stats
      });
    }

    await sendPushNotification(targetUserId, {
      title: 'New Photo Comment 💬',
      body: `${req.user.firstName || req.user.name || 'Someone'} commented on your photo: "${text.substring(0, 30)}..."`,
      data: { type: 'SOCIAL_PHOTO_REACTION', photoId, action: 'comment' }
    }).catch(err => console.error('[PhotoSocial] Push Notify Error:', err));

    return res.json({ success: true, comment: newComment, counts: stats });
  } catch (error) {
    console.error('[PhotoSocial] AddComment Error:', error);
    res.status(500).json({ success: false, message: 'Failed to post comment' });
  }
};

export const getPhotoDetails = async (req, res) => {
  const { photoId } = req.params;
  const { cursor, limit = 20 } = req.query;
  const viewerId = req.user.id;

  console.log("[PhotoSocial] REQ USER:", req.user);
  console.log("[PhotoSocial] REQ PARAMS:", req.params);

  try {
    const firstInter = await PhotoInteraction.findOne({ photoId });
    if (!firstInter) {
      return res.json({ success: true, counts: { likes: 0, comments: 0 }, comments: [] });
    }

    const targetUserId = firstInter.targetUserId;
    const isOwner = viewerId === targetUserId;

    // 📊 Fetch Aggregated Counts
    let counts = await getInteractionCounts(targetUserId, photoId);

    // ❗ PRIVACY RULE: Hide total counts for non-owners
    if (!isOwner) {
      counts = { likes: 0, comments: 0, hidden: true };
    }

    // 📜 Fetch Paginated Comments
    const query = { photoId, type: 'comment' };
    if (cursor) {
      query.createdAt = { $lt: new Date(cursor) };
    }

    const comments = await PhotoInteraction.find(query)
      .sort({ createdAt: -1, _id: -1 })
      .limit(parseInt(limit))
      .populate('senderId', 'name photo');

    // ❗ PRIVACY RULE: Non-owners only see THEIR OWN comments
    const secureComments = comments.filter(c => {
      if (isOwner) return true;
      // Use string comparison for safety with ObjectIds
      return c.senderId._id.toString() === viewerId.toString();
    }).map(c => c.toObject());

    return res.json({
      success: true,
      counts,
      comments: secureComments,
      hasMore: comments.length === parseInt(limit) // Check full fetched list for pagination indicator
    });

  } catch (error) {
    console.error('[photoSocialController] Error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch details' });
  }
};

export const getProfileSocialStats = async (req, res) => {
  const { userId } = req.params;
  const viewerId = req.user.id;

  console.log("[PhotoSocial] REQ USER:", req.user);
  console.log("[PhotoSocial] REQ PARAMS:", req.params);

  try {
    const isOwner = userId === viewerId;

    const stats = await PhotoInteraction.aggregate([
      { $match: { targetUserId: userId } },
      {
        $group: {
          _id: "$photoId",
          likes: { $sum: { $cond: [{ $eq: ["$type", "like"] }, 1, 0] } },
          comments: { $sum: { $cond: [{ $eq: ["$type", "comment"] }, 1, 0] } },
          isLiked: {
            $max: {
              $cond: [
                { $and: [{ $eq: ["$type", "like"] }, { $eq: ["$senderId", viewerId] }] },
                true,
                false
              ]
            }
          }
        }
      }
    ]);

    const result = stats.reduce((acc, curr) => {
      // ❗ PRIVACY RULE: Hide public counts for non-owners
      acc[curr._id] = { 
        likes: isOwner ? curr.likes : 0, 
        commentsCount: isOwner ? curr.comments : 0,
        isLiked: !!curr.isLiked
      };
      return acc;
    }, {});

    res.json({ success: true, stats: result });
  } catch (error) {
    console.error('[PhotoSocial] ProfileStats Error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch profile stats' });
  }
};

async function getInteractionCounts(targetUserId, photoId) {
  const result = await PhotoInteraction.aggregate([
    { $match: { photoId: photoId } },
    {
      $group: {
        _id: "$photoId",
        likes: { $sum: { $cond: [{ $eq: ["$type", "like"] }, 1, 0] } },
        comments: { $sum: { $cond: [{ $eq: ["$type", "comment"] }, 1, 0] } }
      }
    }
  ]);
  return result[0] ? { likes: result[0].likes, comments: result[0].comments } : { likes: 0, comments: 0 };
}
