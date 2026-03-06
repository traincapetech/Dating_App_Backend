import eventEmitter from './eventEmitter.js';
import streakService from './streak.service.js';
import Message from '../../models/Message.js';
import Like from '../../models/Like.js';
import ProfileComment from '../../models/ProfileComment.js';
import Match from '../../models/Match.js';

// 1. Setup Listeners for activity events
eventEmitter.on('activity:engagement', async data => {
  try {
    const {fromUser, toUser, type} = data;
    if (!fromUser || !toUser) return;

    await streakService.handleEngagement(fromUser, toUser, type);
  } catch (error) {
    console.error('[Streak] Listener processing error:', error);
  }
});

// 2. Setup Mongoose Hooks to emit events (to avoid modifying controllers directly)
// This ensures that whenever any engagement document is created, the event is emitted
Message.post('save', function (doc) {
  console.log(
    `[Streak Listener] Message saved! Triggering engagement for ${doc.senderId} -> ${doc.receiverId}`,
  );
  eventEmitter.emit('activity:engagement', {
    fromUser: doc.senderId,
    toUser: doc.receiverId,
    type: 'message',
  });
});

// Start streak on initial match
Match.post('save', function (doc) {
  if (doc.users && doc.users.length >= 2) {
    eventEmitter.emit('activity:engagement', {
      fromUser: doc.users[0],
      toUser: doc.users[1],
      type: 'match',
    });
  }
});

Like.post('save', function (doc) {
  eventEmitter.emit('activity:engagement', {
    fromUser: doc.senderId,
    toUser: doc.receiverId,
    type: 'like',
  });
});

ProfileComment.post('save', function (doc) {
  eventEmitter.emit('activity:engagement', {
    fromUser: doc.senderId,
    toUser: doc.receiverId,
    type: 'comment',
  });
});

// Note: If a Gift model existed, we'd add it here.
// Gift.post('save', ...);

console.log('✅ Streak listeners and hooks ready.');

export default eventEmitter;
