/**
 * Standardize Name Resolution across all systems (HomeScreen, Comments, Matches, Likes)
 * Prioritizes Profile.basicInfo over User.fullName with fallback to 'Unknown'.
 */
export const resolveDisplayName = (profile, user) => {
  const profileName = `${profile?.basicInfo?.firstName || ''} ${profile?.basicInfo?.lastName || ''}`.trim();
  
  // Proven HomeScreen Logic provided by USER:
  // Use profile name if it exists and is different from signup name, else fallback.
  return profileName && profileName !== user?.fullName 
    ? profileName 
    : user?.fullName || "Unknown";
};