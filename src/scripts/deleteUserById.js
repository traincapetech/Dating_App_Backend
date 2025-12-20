import {deleteUser, findUserById} from '../models/userModel.js';
import {findProfileByUserId, deleteProfile} from '../models/profileModel.js';
import {getProfile} from '../services/profileService.js';
import {storage} from '../storage/index.js';
import {config} from '../config/env.js';

const userId = process.argv[2];

if (!userId) {
  console.error('❌ Please provide a user ID');
  console.log('Usage: node src/scripts/deleteUserById.js <userId>');
  process.exit(1);
}

async function deleteUserData(userId) {
  try {
    console.log(`\n🗑️  Deleting user: ${userId}`);
    
    // Check if user exists
    const user = await findUserById(userId);
    if (!user) {
      console.log(`  ❌ User not found`);
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
      {name: 'blocks', key: 'blockerId', userIdKey: 'blockerId'},
      {name: 'blocks', key: 'blockedUserId', userIdKey: 'blockedUserId'},
      {name: 'reports', key: 'reporterId', userIdKey: 'reporterId'},
      {name: 'reports', key: 'reportedUserId', userIdKey: 'reportedUserId'},
      {name: 'notificationTokens', key: 'userId', userIdKey: 'userId'},
    ];
    
    for (const collection of collections) {
      try {
        const filePath = `data/${collection.name}.json`;
        const data = await storage.readJson(filePath, []);
        const filtered = data.filter(item => item[collection.userIdKey] !== userId);
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
    console.log(`  ✓ Profile deleted`);
    
    // Delete user
    await deleteUser(userId);
    console.log(`  ✓ User deleted`);
    
    console.log(`\n✅ Successfully deleted all data for user ${userId}`);
  } catch (error) {
    console.error(`  ❌ Error deleting user ${userId}:`, error.message);
    process.exit(1);
  }
}

deleteUserData(userId).then(() => {
  process.exit(0);
});

