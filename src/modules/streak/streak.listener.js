import eventEmitter from './eventEmitter.js';
import streakService from './streak.service.js';

/**
 * Streak Listener
 *
 * Listens for 'activity:engagement' events emitted by controllers / socket handlers
 * and delegates to streakService.handleEngagement().
 *
 * We do NOT use Mongoose post-save hooks here to avoid double-counting:
 *   - Controllers explicitly emit 'activity:engagement' after each qualifying action
 *   - The socket handler also emits for real-time messages
 *
 * Qualifying event types: 'chat', 'like', 'comment', 'gift', 'match'
 */
eventEmitter.on('activity:engagement', async data => {
  try {
    const {fromUser, toUser, type} = data;
    if (!fromUser || !toUser) {
      console.warn('[Streak Listener] Missing fromUser or toUser — skipping.');
      return;
    }
    console.log(
      `[Streak Listener] event received → type=${type} from=${fromUser} to=${toUser}`,
    );
    await streakService.handleEngagement(fromUser, toUser, type);
  } catch (err) {
    console.error('[Streak Listener] Error processing engagement event:', err);
  }
});

console.log('✅ Streak listener ready.');

export default eventEmitter;
