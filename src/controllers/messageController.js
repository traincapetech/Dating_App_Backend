import Message from '../models/Message.js';
import Match from '../models/Match.js';
import Block from '../models/Block.js';
import {getIO, isUserOnline, emitToUser} from '../services/socketService.js';
import {sendPushNotification} from '../services/pushService.js';

// Helper to validate MongoDB ObjectId format
function isValidObjectId(id) {
  return /^[0-9a-fA-F]{24}$/.test(id);
}

// Helper to verify user belongs to match
async function verifyMatchAccess(matchId, userId) {
  // Validate matchId format first
  if (!isValidObjectId(matchId)) {
    return {error: 'Invalid match ID format', status: 400};
  }

  const match = await Match.findById(matchId);
  if (!match) {
    return {error: 'Match not found', status: 404};
  }
  if (!match.users.includes(userId)) {
    return {
      error: 'Access denied: You are not part of this match',
      status: 403,
    };
  }
  if (!match.chatEnabled) {
    return {error: 'Chat is disabled for this match', status: 403};
  }
  return {match};
}

// Helper to check if either user has blocked the other
async function checkBlocked(userId1, userId2) {
  const block = await Block.findOne({
    $or: [
      {blockerId: userId1, blockedId: userId2},
      {blockerId: userId2, blockedId: userId1},
    ],
  });
  return !!block;
}

export const getMessages = async (req, res) => {
  try {
    const {matchId} = req.params;
    const userId = req.headers['x-user-id'] || req.query.userId;

    if (!matchId) {
      return res
        .status(400)
        .json({success: false, message: 'matchId is required'});
    }
    if (!userId) {
      return res
        .status(400)
        .json({success: false, message: 'userId is required'});
    }

    // Verify match access
    const access = await verifyMatchAccess(matchId, userId);
    if (access.error) {
      return res
        .status(access.status)
        .json({success: false, message: access.error});
    }

    // Get the other user in the match
    const otherUserId = access.match.users.find(u => u !== userId);

    // Check if blocked
    const isBlocked = await checkBlocked(userId, otherUserId);
    if (isBlocked) {
      return res
        .status(403)
        .json({success: false, message: 'Cannot view messages - user blocked'});
    }

    const messages = await Message.find({matchId}).sort({timestamp: 1});

    // Mark messages as delivered if they were sent to this user
    await Message.updateMany(
      {matchId, receiverId: userId, status: 'sent'},
      {$set: {status: 'delivered'}},
    );

    res.json({success: true, messages});
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching messages',
      error: error.message,
    });
  }
};

export const sendMessage = async (req, res) => {
  try {
    const {matchId, senderId, receiverId, text, mediaUrl, mediaType} = req.body;

    // Validate required fields
    if (!matchId || !senderId || !receiverId) {
      return res.status(400).json({
        success: false,
        message: 'matchId, senderId, and receiverId are required',
      });
    }

    if (!text && !mediaUrl) {
      return res.status(400).json({
        success: false,
        message: 'Either text or mediaUrl is required',
      });
    }

    // Chat abuse detection
    if (text) {
      const {detectChatAbuse} = await import(
        '../services/moderationService.js'
      );
      const abuseCheck = detectChatAbuse(text);

      if (abuseCheck.isAbusive) {
        // Log abuse attempt
        console.warn(
          `[Chat Abuse] User ${senderId} sent abusive message: ${abuseCheck.reason}`,
        );

        // Optionally flag user or block message
        // For now, we'll allow but flag the message
        // In production, you might want to block or warn the user

        // Create a report automatically for high severity
        if (abuseCheck.severity === 'high') {
          const Report = (await import('../models/Report.js')).default;
          try {
            await Report.create({
              reporterId: receiverId, // Receiver reports the sender
              reportedId: senderId,
              matchId,
              reason: 'harassment',
              description: `Auto-flagged: ${abuseCheck.reason}`,
              status: 'pending',
            });
          } catch (reportError) {
            console.error('Error creating auto-report:', reportError);
          }
        }
      }
    }

    // Verify sender has access to this match
    const access = await verifyMatchAccess(matchId, senderId);
    if (access.error) {
      return res
        .status(access.status)
        .json({success: false, message: access.error});
    }

    // Verify receiverId is the other user in the match
    if (!access.match.users.includes(receiverId)) {
      return res.status(403).json({
        success: false,
        message: 'Receiver is not part of this match',
      });
    }

    // Check if blocked
    const isBlocked = await checkBlocked(senderId, receiverId);
    if (isBlocked) {
      return res.status(403).json({
        success: false,
        message: 'Cannot send message - user blocked',
      });
    }

    const message = await Message.create({
      matchId,
      senderId,
      receiverId,
      text: text || null,
      mediaUrl: mediaUrl || null,
      mediaType: mediaType || null,
      status: 'sent',
    });

    // Real-time delivery handling
    const io = getIO();
    if (io) {
      // 1. Emit to sender (for confirmation/update if they used optimistic UI)
      // io.to(senderId).emit('messageSent', message);

      // 2. Emit to receiver via their specific room or match room
      io.to(matchId).emit('receiveMessage', message);

      // 3. Also emit directly to receiver's user sockets (for when they're
      //    on the chat list screen and haven't joined this specific room)
      emitToUser(receiverId, 'receiveMessage', message);

      // 4. Check if receiver is online to update status to 'delivered'
      const receiverOnline = isUserOnline(receiverId);
      console.log(
        `[Push Debug] Receiver ${receiverId} online: ${receiverOnline}`,
      );

      if (receiverOnline) {
        // Mark as delivered immediately
        message.status = 'delivered';
        await message.save();

        // Notify sender that message was delivered
        io.to(matchId).emit('messageStatusUpdate', {
          messageId: message._id,
          status: 'delivered',
          matchId, // Include matchId for easier client-side handling
        });
      } else {
        // Receiver is offline - send push notification
        console.log(
          `[Push Debug] Attempting push notification to ${receiverId}`,
        );
        try {
          const pushTitle = 'New Message'; // You might want to fetch sender name here
          const pushBody = text
            ? text.length > 50
              ? text.substring(0, 50) + '...'
              : text
            : 'Sent you a photo';

          const pushResult = await sendPushNotification(receiverId, {
            title: pushTitle,
            body: pushBody,
            data: {
              type: 'message',
              matchId,
              senderId,
            },
          });
          console.log(`[Push Debug] Push result:`, JSON.stringify(pushResult));
        } catch (pushError) {
          console.error('[Push Notification] Failed:', pushError.message);
        }
      }
    }

    res.json({success: true, message});
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({
      success: false,
      message: 'Error sending message',
      error: error.message,
    });
  }
};

export const markMessagesSeen = async (req, res) => {
  try {
    const {matchId} = req.params;
    const {userId} = req.body;

    if (!matchId || !userId) {
      return res
        .status(400)
        .json({success: false, message: 'matchId and userId are required'});
    }

    // Verify match access
    const access = await verifyMatchAccess(matchId, userId);
    if (access.error) {
      return res
        .status(access.status)
        .json({success: false, message: access.error});
    }

    // Mark all messages sent TO this user as seen
    const result = await Message.updateMany(
      {matchId, receiverId: userId, status: {$ne: 'seen'}},
      {$set: {status: 'seen', seenAt: new Date()}},
    );

    // Notify the other user (sender) that their messages were seen
    const io = getIO();
    if (io && result.modifiedCount > 0) {
      // We need to know which messages were updated to be precise,
      // but for now we can just signal that "all previous messages" are seen
      // OR specifically fetch the IDs of messages that were just updated.

      // Simplified: Just emit event saying "messages seen by userId in matchId"
      // The client can update all "sent/delivered" messages from this user to "seen"
      io.to(matchId).emit('messagesSeen', {
        matchId,
        userId, // Who saw the messages
        seenAt: new Date(),
      });
    }

    res.json({
      success: true,
      message: 'Messages marked as seen',
      modifiedCount: result.modifiedCount,
    });
  } catch (error) {
    console.error('Error marking messages seen:', error);
    res.status(500).json({
      success: false,
      message: 'Error marking messages seen',
      error: error.message,
    });
  }
};

export const getLastMessages = async (req, res) => {
  try {
    const {matchIds} = req.body;
    const userId = req.headers['x-user-id'] || req.query.userId;

    if (!matchIds || !Array.isArray(matchIds)) {
      return res
        .status(400)
        .json({success: false, message: 'matchIds array is required'});
    }

    const lastMessages = await Promise.all(
      matchIds.map(async matchId => {
        const message = await Message.findOne({matchId})
          .sort({timestamp: -1})
          .limit(1);

        // Get unread count for this user
        const unreadCount = await Message.countDocuments({
          matchId,
          receiverId: userId,
          status: {$ne: 'seen'},
        });

        return {matchId, lastMessage: message, unreadCount};
      }),
    );

    res.json({success: true, lastMessages});
  } catch (error) {
    console.error('Error fetching last messages:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching last messages',
      error: error.message,
    });
  }
};

export const deleteMessage = async (req, res) => {
  try {
    const {messageId} = req.params;
    const {userId} = req.body; // Or get from req.headers['x-user-id']

    if (!messageId) {
      return res
        .status(400)
        .json({success: false, message: 'messageId is required'});
    }

    const message = await Message.findById(messageId);
    if (!message) {
      return res
        .status(404)
        .json({success: false, message: 'Message not found'});
    }

    console.log(
      `[Delete Message] Requesting User: ${userId}, Message Sender: ${message.senderId}`,
    );

    // Only allow sender to delete
    if (message.senderId.toString() !== userId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'You can only delete your own messages',
      });
    }

    await Message.findByIdAndDelete(messageId);

    res.json({success: true, message: 'Message deleted'});
  } catch (error) {
    console.error('Error deleting message:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting message',
      error: error.message,
    });
  }
};
