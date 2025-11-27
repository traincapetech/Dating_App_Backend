import {deleteUser, findUserById} from '../src/models/userModel.js';
import {getProfile} from '../src/services/profileService.js';
import {deleteProfile} from '../src/models/profileModel.js';
import {storage} from '../src/storage/index.js';
import {config} from '../src/config/env.js';

// User IDs to delete
const userIdsToDelete = [
  '4d5ed875-9a59-46d3-a520-53e85bb2c62e',
  '31fb62da-d1d8-485c-92cd-a3292365c48b',
  '294a1d16-0eef-4a95-bc6a-7a8825d878a1',
  'cefc1f0c-8966-4cb5-88e2-56df3cc3743d',
  '4f9ad952-13d4-4824-8173-1602073cce57',
  'bd5d7ac9-ed44-41d7-b4d1-85c74a7a33c9',
  '54a2ec89-5e89-4453-8b19-9ea84b893a2c',
];

async function deleteUserData(userId) {
  try {
    console.log(`\nProcessing user: ${userId}`);
    
    // Check if user exists
    const user = await findUserById(userId);
    if (!user) {
      console.log(`  User not found, skipping...`);
      return;
    }
    
    console.log(`  User: ${user.fullName} (${user.email})`);
    
    // Get profile and delete media files
    const profile = await getProfile(userId);
    if (profile?.media?.media) {
      console.log(`  Found ${profile.media.media.length} media files`);
      
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
    
    // Delete profile
    await deleteProfile(userId);
    console.log(`  ✓ Profile deleted`);
    
    // Delete user
    await deleteUser(userId);
    console.log(`  ✓ User deleted`);
    
    console.log(`  ✅ Successfully deleted all data for ${user.fullName}`);
  } catch (error) {
    console.error(`  ✗ Error deleting user ${userId}:`, error.message);
  }
}

async function main() {
  console.log('Starting bulk user deletion...');
  console.log(`Total users to delete: ${userIdsToDelete.length}\n`);
  
  for (const userId of userIdsToDelete) {
    await deleteUserData(userId);
  }
  
  console.log('\n✅ Bulk deletion completed!');
}

main().catch(console.error);

