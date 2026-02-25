import {getUsersScheduledForDeletion} from '../services/gdprService.js';
import {deleteUser, findUserById} from '../models/userModel.js';
import {getProfile} from '../services/profileService.js';
import {deleteProfile} from '../models/profileModel.js';
import {storage} from '../storage/index.js';
import {config} from '../config/env.js';

/**
 * GDPR Automated Deletion Cron Job
 * Runs daily to permanently delete user data after grace period
 *
 * This implements the data deletion policy:
 * - Accounts scheduled for deletion are kept for 30 days (grace period)
 * - After grace period, all data is permanently deleted
 * - Includes: user account, profile, media files, matches, messages, etc.
 */

/**
 * Delete user data completely (same logic as deleteUserController)
 */
async function deleteUserDataCompletely(userId) {
  try {
    console.log(`\n🗑️  [GDPR Deletion] Processing user: ${userId}`);

    const user = await findUserById(userId);
    if (!user) {
      console.log('  ❌ User not found, skipping...');
      return;
    }

    console.log(`  👤 User: ${user.fullName || user.email || userId}`);

    // Get profile and delete media files
    const profile = await getProfile(userId);
    if (profile?.media?.media) {
      console.log(`  📸 Found ${profile.media.media.length} media files`);

      for (const mediaItem of profile.media.media) {
        if (mediaItem.url) {
          try {
            // Extract file path from URL
            let filePath = null;

            if (mediaItem.url.includes('/api/files/')) {
              filePath = new URL(mediaItem.url).pathname.replace('/api/files/', '');
            } else if (mediaItem.url.includes('r2.cloudflarestorage.com') ||
                       (config.r2.publicBaseUrl && mediaItem.url.includes(config.r2.publicBaseUrl))) {
              const urlObj = new URL(mediaItem.url);
              filePath = urlObj.pathname.replace(/^\//, '');
            } else {
              const urlObj = new URL(mediaItem.url);
              filePath = urlObj.pathname.replace(/^\//, '');
              const profilesIndex = filePath.indexOf('profiles/');
              if (profilesIndex !== -1) {
                filePath = filePath.substring(profilesIndex);
              }
            }

            if (filePath) {
              await storage.deleteObject(filePath);
              console.log(`    ✓ Deleted: ${filePath}`);
            }
          } catch (error) {
            console.error(`    ✗ Failed to delete: ${mediaItem.url}`, error.message);
          }
        }
      }
    }

    // Delete from other collections
    const collections = [
      {name: 'matches', key: 'users', userIdKey: 'userId'},
      {name: 'messages', key: 'senderId', userIdKey: 'senderId'},
      {name: 'messages', key: 'receiverId', userIdKey: 'receiverId'},
      {name: 'likes', key: 'likerId', userIdKey: 'likerId'},
      {name: 'likes', key: 'likedUserId', userIdKey: 'likedUserId'},
      {name: 'passes', key: 'passerId', userIdKey: 'passerId'},
      {name: 'passes', key: 'passedUserId', userIdKey: 'passedUserId'},
      {name: 'blocks', key: 'blockerId', userIdKey: 'blockerId'},
      {name: 'blocks', key: 'blockedUserId', userIdKey: 'blockedUserId'},
      {name: 'reports', key: 'reporterId', userIdKey: 'reporterId'},
      {name: 'reports', key: 'reportedUserId', userIdKey: 'reportedUserId'},
      {name: 'notificationTokens', key: 'userId', userIdKey: 'userId'},
      {name: 'boosts', key: 'userId', userIdKey: 'userId'},
    ];

    for (const collection of collections) {
      try {
        const filePath = `data/${collection.name}.json`;
        const data = await storage.readJson(filePath, []);
        const filtered = data.filter(item => {
          // Handle array fields (like matches.users)
          if (collection.key === 'users' && Array.isArray(item.users)) {
            return !item.users.includes(userId);
          }
          return item[collection.userIdKey] !== userId;
        });
        if (filtered.length < data.length) {
          await storage.writeJson(filePath, filtered);
          console.log(`  ✓ Deleted from ${collection.name}: ${data.length - filtered.length} record(s)`);
        }
      } catch (error) {
        // Collection might not exist, that's okay
      }
    }

    // Delete profile
    await deleteProfile(userId);
    console.log('  ✓ Profile deleted');

    // Delete user
    await deleteUser(userId);
    console.log('  ✓ User deleted');

    console.log(`\n✅ Successfully deleted all data for user ${userId}`);
  } catch (error) {
    console.error(`  ❌ Error deleting user ${userId}:`, error.message);
    throw error;
  }
}

/**
 * Process scheduled deletions
 */
export async function processScheduledDeletions() {
  try {
    console.log('\n🔄 [GDPR Deletion Cron] Starting scheduled deletion process...');
    const now = new Date();

    // Get users scheduled for deletion (grace period has passed)
    const usersToDelete = await getUsersScheduledForDeletion(now);

    if (usersToDelete.length === 0) {
      console.log('  ✓ No users scheduled for deletion');
      return {deleted: 0, errors: 0};
    }

    console.log(`  📋 Found ${usersToDelete.length} user(s) scheduled for deletion`);

    let deleted = 0;
    let errors = 0;

    for (const user of usersToDelete) {
      try {
        await deleteUserDataCompletely(user.id);
        deleted++;
      } catch (error) {
        console.error(`  ❌ Failed to delete user ${user.id}:`, error.message);
        errors++;
      }
    }

    console.log(`\n✅ [GDPR Deletion Cron] Completed: ${deleted} deleted, ${errors} errors`);

    return {deleted, errors};
  } catch (error) {
    console.error('❌ [GDPR Deletion Cron] Error processing deletions:', error);
    throw error;
  }
}

/**
 * Run the cron job (can be called directly or scheduled)
 */
if (import.meta.url === `file://${process.argv[1]}`) {
  // Run directly if called from command line
  processScheduledDeletions()
    .then(result => {
      console.log('\n📊 Deletion Summary:', result);
      process.exit(0);
    })
    .catch(error => {
      console.error('❌ Fatal error:', error);
      process.exit(1);
    });
}

