import cron from 'node-cron';
import Notification from '../models/Notification.js';
import { sendNotification } from '../services/notificationService.js';

export const scheduleNotifications = () => {
  /**
   * Run every minute to check pending notifications
   */
  cron.schedule('* * * * *', async () => {
    try {
      const now = new Date();
      // Get notifications scheduled for now or earlier that haven't been processed
      const scheduledNotifications = await Notification.find({
        status: 'pending',
        scheduledAt: { $exists: true, $lte: now },
      });

      if (scheduledNotifications.length > 0) {
        console.log(`⏰ Found ${scheduledNotifications.length} scheduled notifications. Processing...`);

        // Use Promise.all to process notifications concurrently
        await Promise.all(
          scheduledNotifications.map(async (n) => {
            try {
              // Update status immediately to prevent double processing
              n.status = 'scheduled';
              await n.save();

              await sendNotification({
                title: n.title,
                body: n.body,
                audience: n.audience,
                userIds: n.userIds,
                type: n.type,
                data: n.data,
                createdBy: n.createdBy,
              });
              console.log(`✅ Scheduled notification "${n.title}" sent successfully.`);
            } catch (err) {
              console.error(`❌ Failed to send scheduled notification "${n.title}":`, err.message);
              // Retry Logic: Mark as pending if failed or move to failed status
              n.status = 'failed';
              await n.save();
            }
          })
        );
      }
    } catch (error) {
      console.error('⏰ Scheduler error:', error.message);
    }
  });

  console.log('✅ Notification Scheduler job initialized');
};
