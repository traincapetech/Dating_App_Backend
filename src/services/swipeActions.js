// src/services/swipeActions.js
import apiClient from './apiClient';

export const likeUser = async (senderId, receiverId) => {
  try {
    const res = await apiClient.post('/swipe/like', { senderId, receiverId });
    return res.data;
  } catch (err) {
    console.error('Like Error:', err?.response?.data || err.message);
    throw err;
  }
};

export const passUser = async (userId, passedUserId) => {
  try {
    const res = await apiClient.post('/swipe/pass', { userId, passedUserId });
    return res.data;
  } catch (err) {
    console.error('Pass Error:', err?.response?.data || err.message);
    throw err;
  }
};
