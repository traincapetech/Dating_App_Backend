import {deleteUser, findUserById} from '../src/models/userModel.js';
import {getProfile} from '../src/services/profileService.js';
import {deleteProfile} from '../src/models/profileModel.js';
import {storage} from '../src/storage/index.js';
import {config} from '../src/config/env.js';

// User IDs to delete
const userIdsToDelete = [
  '65dab33a-47cc-4b0a-85d0-62da15fba731',
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

