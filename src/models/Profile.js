import mongoose from 'mongoose';

const profileSchema = new mongoose.Schema(
  {
    _id: {
      type: String,
      required: true,
    },
    userId: {
      type: String,
      ref: 'User',
      required: true,
      unique: true, // One profile per user
    },
    basicInfo: {
      firstName: String,
      lastName: String,
      gender: String,
      showGenderOnProfile: Boolean,
      dob: String, // ISO Date string
      bio: String,
      hometown: String,
      work: String,
      education: String,
      location: String,
      locationDetails: {
        lat: Number,
        lng: Number,
        source: String,
        timestamp: Number,
      },
    },
    datingPreferences: {
      whoToDate: [String],
      datingIntention: String,
      relationshipType: String,
      showIntentionOnProfile: Boolean,
      showRelationshipTypeOnProfile: Boolean,
      ageRange: {
        min: Number,
        max: Number,
      },
      distance: Number,
      global: Boolean,
    },
    lifestyle: {
      drink: String,
      smokeTobacco: String,
      smokeWeed: String,
      drugs: String,
      religiousBeliefs: String,
      politicalBeliefs: String,
      interests: [String],
      pets: [String],
    },
    personalDetails: {
      height: String,
      educationLevel: String,
      children: String,
      hasChildren: String,
      familyPlans: String,
      ethnicity: String,
      hometown: String,
      workplace: String,
      jobTitle: String,
      school: String,
      starSign: String,
      languages: [String],
    },
    profilePrompts: {
      type: Map,
      of: new mongoose.Schema(
        {
          question: String,
          answer: String,
        },
        {_id: false},
      ),
    },
    media: {
      media: [
        {
          id: String,
          type: {type: String, enum: ['image', 'video', 'photo']},
          url: String,
          thumbnail: String,
        },
      ],
    },
    location: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point',
      },
      coordinates: {
        type: [Number], // [longitude, latitude]
        default: [0, 0],
      },
    },
    isPaused: {
      type: Boolean,
      default: false,
    },
    isHidden: {
      type: Boolean,
      default: false,
    },
    moderationStatus: {
      type: String,
      enum: ['pending', 'approved', 'rejected', 'flagged'],
      default: 'pending',
    },
    moderationFlags: [String],
    moderationRiskScore: Number,
    autoReviewedAt: Date,
    views: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
    _id: false,
  },
);

// Helper to check if coordinates are valid (not null, not [0,0], within range)
const isValidLocation = coords => {
  if (!coords || !Array.isArray(coords) || coords.length !== 2) return false;
  const [lng, lat] = coords;
  if (lng === 0 && lat === 0) return false;
  if (lat < -90 || lat > 90) return false;
  if (lng < -180 || lng > 180) return false;
  return true;
};

// Index for geo-spatial queries
profileSchema.index({location: '2dsphere'});

// Pre-save hook for location synchronization and validation
profileSchema.pre('save', async function () {
  // 1. Sync from basicInfo.locationDetails if present and changed
  const locDetails = this.basicInfo?.locationDetails;
  if (locDetails && locDetails.lat !== undefined && locDetails.lng !== undefined) {
    // Sync to GeoJSON format [lng, lat]
    this.location = {
      type: 'Point',
      coordinates: [locDetails.lng, locDetails.lat],
    };
  }

  // 2. Validate coordinates before saving
  if (this.location && this.location.coordinates) {
    if (!isValidLocation(this.location.coordinates)) {
      // If invalid, we reset to [0,0] or null? 
      // Requirement says reject invalid, but we don't want to crash the save if it's just missing.
      // However, we MUST NOT index [0,0] as a valid location.
      // Let's set it to null if invalid to avoid 2dsphere index errors and "global leak"
      if (this.location.coordinates[0] === 0 && this.location.coordinates[1] === 0) {
        // Technically [0,0] is a valid coordinate on the equator/prime meridian intersection,
        // but in our app it's a default/placeholder. 
        // We will treat it as "unassigned" and nullify it for the engine.
        this.location = undefined;
      }
    }
  }
});

// Virtual for id
profileSchema.virtual('id').get(function () {
  return this._id;
});

// Virtual to check if profile has a valid location for discovery
profileSchema.virtual('hasValidLocation').get(function () {
  return isValidLocation(this.location?.coordinates);
});

profileSchema.set('toJSON', {
  virtuals: true,
  versionKey: false,
  transform: (doc, ret) => {
    delete ret._id;
    return ret;
  },
});

const Profile = mongoose.model('Profile', profileSchema);

export default Profile;