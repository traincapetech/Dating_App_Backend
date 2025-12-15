import { Server } from "socket.io";
import Message from "../models/Message.js";
import Match from "../models/Match.js";
import Block from "../models/Block.js";
import { sendPushNotification } from "./pushService.js";

let io = null;

// Store user socket mappings
const userSockets = new Map(); // userId -> Set of socket ids
const socketUsers = new Map(); // socketId -> userId

export function initSocketServer(httpServer) {
  io = new Server(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    },
    transports: ["websocket", "polling"]
  });

  io.on("connection", (socket) => {
    console.log(`📱 Socket connected: ${socket.id}`);

    // Authenticate user and map socket
    socket.on("authenticate", ({ userId }) => {
      if (!userId) return;
      
      // Store mapping
      socketUsers.set(socket.id, userId);
      
      if (!userSockets.has(userId)) {
        userSockets.set(userId, new Set());
      }
      userSockets.get(userId).add(socket.id);
      
      console.log(`👤 User ${userId} authenticated on socket ${socket.id}`);
    });

    // Join a chat room (match-based)
    socket.on("joinRoom", async ({ matchId, userId }) => {
      if (!matchId || !userId) return;
      
      // Verify user belongs to match
      try {
        // Validate matchId is a valid ObjectId
        if (!/^[0-9a-fA-F]{24}$/.test(matchId)) {
          console.log(`⚠️ Invalid matchId format: ${matchId}`);
          return;
        }
        
        const match = await Match.findById(matchId);
        if (match && match.users.includes(userId)) {
          socket.join(matchId);
          console.log(`🚪 Socket ${socket.id} joined room ${matchId}`);
        } else {
          console.log(`⚠️ User ${userId} not authorized for room ${matchId}`);
        }
      } catch (error) {
        console.error("Error joining room:", error.message);
      }
    });

    // Leave a chat room
    socket.on("leaveRoom", ({ matchId }) => {
      if (matchId) {
        socket.leave(matchId);
        console.log(`🚪 Socket ${socket.id} left room ${matchId}`);
      }
    });

    // Handle sending messages via socket
    socket.on("sendMessage", async (messageData) => {
      const { matchId, senderId, receiverId, text, mediaUrl, mediaType } = messageData;
      
      if (!matchId || !senderId || !receiverId) return;
      
      // Validate matchId is a valid ObjectId
      if (!/^[0-9a-fA-F]{24}$/.test(matchId)) {
        socket.emit("error", { message: "Invalid match ID" });
        return;
      }
      
      try {
        // Verify match access
        const match = await Match.findById(matchId);
        if (!match || !match.users.includes(senderId)) {
          socket.emit("error", { message: "Access denied" });
          return;
        }

        // Check blocks
        const block = await Block.findOne({
          $or: [
            { blockerId: senderId, blockedId: receiverId },
            { blockerId: receiverId, blockedId: senderId }
          ]
        });
        
        if (block) {
          socket.emit("error", { message: "Cannot send message - blocked" });
          return;
        }

        // Save message to database
        const message = await Message.create({
          matchId,
          senderId,
          receiverId,
          text: text || null,
          mediaUrl: mediaUrl || null,
          mediaType: mediaType || null,
          status: 'sent'
        });

        // Emit to room (both users if connected)
        io.to(matchId).emit("receiveMessage", message);

        // Check if receiver is online
        const receiverSockets = userSockets.get(receiverId);
        if (receiverSockets && receiverSockets.size > 0) {
          // Mark as delivered immediately if online
          message.status = 'delivered';
          await message.save();
          
          io.to(matchId).emit("messageStatusUpdate", {
            messageId: message._id,
            status: 'delivered'
          });
        } else {
          // Send push notification if offline
          try {
            await sendPushNotification(receiverId, {
              title: "New Message",
              body: text ? (text.length > 50 ? text.substring(0, 50) + '...' : text) : "Sent you a photo",
              data: {
                type: 'message',
                matchId,
                senderId
              }
            });
          } catch (pushError) {
            console.error("Push notification error:", pushError);
          }
        }

      } catch (error) {
        console.error("Error sending message via socket:", error);
        socket.emit("error", { message: "Failed to send message" });
      }
    });

    // Handle typing indicator
    socket.on("typing", async ({ matchId, userId }) => {
      if (!matchId || !userId) return;
      
      // Broadcast to others in the room
      socket.to(matchId).emit("typing", { matchId, userId });
    });

    // Handle stop typing
    socket.on("stopTyping", async ({ matchId, userId }) => {
      if (!matchId || !userId) return;
      
      socket.to(matchId).emit("stopTyping", { matchId, userId });
    });

    // Handle message seen
    socket.on("messageSeen", async ({ matchId, userId, messageIds }) => {
      if (!matchId || !userId || !messageIds || !Array.isArray(messageIds)) return;
      
      // Validate matchId is a valid ObjectId
      if (!/^[0-9a-fA-F]{24}$/.test(matchId)) return;
      
      try {
        // Update messages in database
        await Message.updateMany(
          { 
            _id: { $in: messageIds },
            receiverId: userId,
            status: { $ne: 'seen' }
          },
          { 
            $set: { 
              status: 'seen',
              seenAt: new Date()
            } 
          }
        );

        // Notify sender(s) in the room
        socket.to(matchId).emit("messagesSeen", { 
          matchId, 
          userId, 
          messageIds,
          seenAt: new Date()
        });

      } catch (error) {
        console.error("Error marking messages seen:", error);
      }
    });

    // Handle disconnect
    socket.on("disconnect", () => {
      const userId = socketUsers.get(socket.id);
      
      if (userId) {
        const sockets = userSockets.get(userId);
        if (sockets) {
          sockets.delete(socket.id);
          if (sockets.size === 0) {
            userSockets.delete(userId);
          }
        }
      }
      
      socketUsers.delete(socket.id);
      console.log(`📱 Socket disconnected: ${socket.id}`);
    });
  });

  console.log("🔌 Socket.IO server initialized");
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
  const sockets = userSockets.get(userId);
  return sockets && sockets.size > 0;
}

