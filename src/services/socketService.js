import {Server} from 'socket.io';
import jwt from 'jsonwebtoken';
import {config} from '../config/env.js';
import Message from '../models/Message.js';
import Match from '../models/Match.js';
import Block from '../models/Block.js';
import {sendPushNotification} from './pushService.js';

let io = null;

// Store user socket mappings
const userSockets = new Map(); // userId -> Set of socket ids
const socketUsers = new Map(); // socketId -> userId
const socketMessageTimestamps = new Map(); // socketId -> number[]

function isRateLimited(socketId, maxPerMinute = 30) {
  const now = Date.now();
  const windowStart = now - 60_000;
  const recent = (socketMessageTimestamps.get(socketId) || []).filter(t => t > windowStart);
  if (recent.length >= maxPerMinute) {
    socketMessageTimestamps.set(socketId, recent);
    return true;
  }
  recent.push(now);
  socketMessageTimestamps.set(socketId, recent);
  return false;
}

export function initSocketServer(httpServer) {
  const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim()).filter(Boolean)
    : '*';

  io = new Server(httpServer, {
    cors: {
      origin: allowedOrigins,
      methods: ['GET', 'POST'],
    },
    transports: ['websocket', 'polling'],
  });

  // Require valid JWT on Socket.IO handshake
  io.use((socket, next) => {
    try {
      const authHeader = socket.handshake.headers?.authorization;
      const token =
        socket.handshake.auth?.token ||
        (authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : null);

      if (!token) {
        return next(new Error('Authentication required'));
      }

      const decoded = jwt.verify(token, config.jwtSecret);
      if (decoded.type === 'refresh') {
        return next(new Error('Invalid token type'));
      }

      const userId = decoded.sub || decoded.userId || decoded.id;
      if (!userId) {
        return next(new Error('Invalid token'));
      }

      socket.userId = String(userId);
      return next();
    } catch {
      return next(new Error('Invalid or expired token'));
    }
  });

  io.on('connection', socket => {
    const authUserId = socket.userId;

    // Automatically register verified socket identity
    const registerVerifiedUser = () => {
      if (!authUserId) return;
      const previouslyOnline = isUserOnline(authUserId);
      socketUsers.set(socket.id, authUserId);
      if (!userSockets.has(authUserId)) {
        userSockets.set(authUserId, new Set());
      }
      userSockets.get(authUserId).add(socket.id);
      if (!previouslyOnline) {
        broadcastUserStatus(authUserId, 'online');
      }
    };

    registerVerifiedUser();

    // Backward-compatible authenticate event — always ignores client-supplied userId
    socket.on('authenticate', () => {
      registerVerifiedUser();
    });

    // Join a chat room (match-based) using verified socket.userId
    socket.on('joinRoom', async ({matchId} = {}) => {
      const userId = socket.userId;
      if (!matchId || !userId) return;

      try {
        if (!/^[0-9a-fA-F]{24}$/.test(matchId)) {
          return;
        }

        const match = await Match.findById(matchId);
        if (match && match.users.includes(userId)) {
          socket.join(matchId);

          const otherUserId = match.users.find(u => u !== userId);
          if (otherUserId) {
            socket.emit('userStatusChanged', {
              userId: otherUserId,
              status: isUserOnline(otherUserId) ? 'online' : 'offline',
              matchId,
            });
          }
        }
      } catch (error) {
        console.error('Error joining room:', error.message);
      }
    });

    // Leave a chat room
    socket.on('leaveRoom', ({matchId} = {}) => {
      if (matchId) {
        socket.leave(matchId);
      }
    });

    // ─── PHOTO SOCIAL ROOMS ───
    socket.on('joinProfileSocial', ({targetUserId} = {}) => {
      if (!targetUserId) return;
      socket.join(`profile_social:${targetUserId}`);
    });

    socket.on('leaveProfileSocial', ({targetUserId} = {}) => {
      if (!targetUserId) return;
      socket.leave(`profile_social:${targetUserId}`);
    });

    // Handle sending messages via socket (uses verified socket.userId)
    socket.on('sendMessage', async (messageData = {}) => {
      const senderId = socket.userId;
      const {matchId, receiverId, text, mediaUrl, mediaType} = messageData;

      if (!matchId || !senderId || !receiverId) return;
      if (!text && !mediaUrl) return;
      if (typeof text === 'string' && text.length > 5000) {
        socket.emit('error', {message: 'Message too long'});
        return;
      }
      if (isRateLimited(socket.id)) {
        socket.emit('error', {message: 'Too many messages. Please slow down.'});
        return;
      }

      if (!/^[0-9a-fA-F]{24}$/.test(matchId)) {
        socket.emit('error', {message: 'Invalid match ID'});
        return;
      }

      try {
        if (text) {
          const {detectChatAbuse} = await import('./moderationService.js');
          const abuseCheck = detectChatAbuse(text);
          if (abuseCheck.isAbusive) {
            socket.emit('error', {
              message: abuseCheck.message || 'Message blocked: Inappropriate content detected.',
            });
            return;
          }
        }

        const match = await Match.findById(matchId);
        if (!match || !match.users.includes(senderId) || !match.users.includes(receiverId)) {
          socket.emit('error', {message: 'Access denied'});
          return;
        }
        if (!match.chatEnabled) {
          socket.emit('error', {message: 'Chat is disabled for this match'});
          return;
        }

        const block = await Block.findOne({
          $or: [
            {blockerId: senderId, blockedId: receiverId},
            {blockerId: receiverId, blockedId: senderId},
          ],
        });

        if (block) {
          socket.emit('error', {message: 'Cannot send message - blocked'});
          return;
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

        await Match.findByIdAndUpdate(matchId, {lastMessageAt: new Date()});

        io.to(matchId).emit('receiveMessage', message);

        const receiverSockets = userSockets.get(receiverId);
        if (receiverSockets && receiverSockets.size > 0) {
          message.status = 'delivered';
          await message.save();

          io.to(matchId).emit('messageStatusUpdate', {
            messageId: message._id,
            status: 'delivered',
            matchId,
          });
        } else {
          try {
            await sendPushNotification(receiverId, {
              title: 'New Message',
              body: text
                ? text.length > 50
                  ? text.substring(0, 50) + '...'
                  : text
                : 'Sent you a photo',
              data: {
                type: 'message',
                matchId,
                senderId,
              },
            });
          } catch (pushError) {
            console.error('Push notification error:', pushError.message);
          }
        }
      } catch (error) {
        console.error('Error sending message via socket:', error.message);
        socket.emit('error', {message: 'Failed to send message'});
      }
    });

    // Handle typing indicator (verified socket.userId & joined room)
    socket.on('typing', ({matchId} = {}) => {
      if (!matchId || !socket.userId || !socket.rooms.has(matchId)) return;
      socket.to(matchId).emit('typing', {matchId, userId: socket.userId});
    });

    // Handle stop typing
    socket.on('stopTyping', ({matchId} = {}) => {
      if (!matchId || !socket.userId || !socket.rooms.has(matchId)) return;
      socket.to(matchId).emit('stopTyping', {matchId, userId: socket.userId});
    });

    // Handle message seen (verified socket.userId)
    socket.on('messageSeen', async ({matchId, messageIds} = {}) => {
      const userId = socket.userId;
      if (!matchId || !userId || !Array.isArray(messageIds) || messageIds.length === 0)
        return;

      if (!/^[0-9a-fA-F]{24}$/.test(matchId) || !socket.rooms.has(matchId)) return;

      try {
        await Message.updateMany(
          {
            _id: {$in: messageIds},
            matchId,
            receiverId: userId,
            status: {$ne: 'seen'},
          },
          {
            $set: {
              status: 'seen',
              seenAt: new Date(),
            },
          },
        );

        socket.to(matchId).emit('messagesSeen', {
          matchId,
          userId,
          messageIds,
          seenAt: new Date(),
        });
      } catch (error) {
        console.error('Error marking messages seen:', error.message);
      }
    });

    // Handle disconnect
    socket.on('disconnect', () => {
      socketMessageTimestamps.delete(socket.id);
      const userId = socketUsers.get(socket.id);

      if (userId) {
        const sockets = userSockets.get(userId);
        if (sockets) {
          sockets.delete(socket.id);
          if (sockets.size === 0) {
            userSockets.delete(userId);
            // Last socket of this user disconnected - user is now offline
            broadcastUserStatus(userId, 'offline');
          }
        }
      }

      socketUsers.delete(socket.id);
      console.log(`📱 Socket disconnected: ${socket.id}`);
    });
  });

  /**
   * Broadcast user status (online/offline) to all their matches
   */
  async function broadcastUserStatus(userId, status) {
    try {
      if (!userId) return;

      const matches = await Match.find({users: userId});
      matches.forEach(match => {
        const matchId = match._id.toString();
        io.to(matchId).emit('userStatusChanged', {
          userId,
          status, // 'online' or 'offline'
          matchId,
        });
      });
    } catch (error) {
      console.error('Error broadcasting user status:', error);
    }
  }

  console.log('🔌 Socket.IO server initialized');
  return io;
}

export function getIO() {
  return io;
}

// Helper to emit to specific user (all their connected sockets)
export function emitToUser(userId, event, data) {
  const sockets = userSockets.get(userId);
  if (sockets && io) {
    sockets.forEach(socketId => {
      io.to(socketId).emit(event, data);
    });
  }
}

// Helper to check if user is online
export function isUserOnline(userId) {
  if (!userId) return false;
  const sockets = userSockets.get(userId.toString());
  return !!(sockets && sockets.size > 0);
}
