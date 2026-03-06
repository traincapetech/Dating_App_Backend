import {sendPushNotification} from '../../services/pushService.js';

class StreakNotification {
  /**
   * Send push notification for streak increment
   */
  async sendIncrement(userId, partnerId, count) {
    try {
      await sendPushNotification(userId, {
        title: '🔥 Streak Growing!',
        body: `You and your partner have a ${count}-day streak! Keep it going!`,
        data: {
          type: 'STREAK_INCREMENT',
          count: count.toString(),
          partnerId: partnerId.toString(),
          feature: 'streak',
        },
      });
    } catch (error) {
      console.error('[Streak Notification] Increment error:', error);
    }
  }

  /**
   * Send warning notification when streak is about to break (20-22 hours)
   */
  async sendWarning(userId, partnerId) {
    try {
      await sendPushNotification(userId, {
        title: '⚠️ Streak Warning!',
        body: "Don't let your streak break! Send a message or react now.",
        data: {
          type: 'STREAK_WARNING',
          partnerId: partnerId.toString(),
          feature: 'streak',
        },
      });
    } catch (error) {
      console.error('[Streak Notification] Warning error:', error);
    }
  }

  /**
   * Send notification for streak reset
   */
  async sendReset(userId, partnerId) {
    try {
      await sendPushNotification(userId, {
        title: '❌ Streak Broken!',
        body: 'Oops! Your streak with your partner has been reset. Start a new one today!',
        data: {
          type: 'STREAK_RESET',
          partnerId: partnerId.toString(),
          feature: 'streak',
        },
      });
    } catch (error) {
      console.error('[Streak Notification] Reset error:', error);
    }
  }
}

export default new StreakNotification();
