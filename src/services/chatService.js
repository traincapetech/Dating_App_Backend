// src/services/chatService.js
import apiClient from './apiClient';

export const fetchMessages = async (matchId) => {
    if (!matchId) return []; // <-- PREVENT ERRORS WHEN NO MATCH ID IS PROVIDED
    try {
        const res = await apiClient.get(`/chat/${matchId}`);
        return res.data || [];
      } catch (err) {
        console.log("❌ fetchMessages error:", err?.response?.data);
        return []; // <-- fallback JSON
      }
};

export const sendMessageApi = async ({ matchId, senderId, receiverId, text, mediaUrl }) => {

  const res = await apiClient.post('/chat', {
    matchId,
    senderId,
    receiverId,
    text,
    mediaUrl: mediaUrl || null,
  });
  return res.data; // saved message
};

export const fetchMatches = async (userId) => {
  const res = await apiClient.get(`/matches/${userId}`);
  return res.data;
};
