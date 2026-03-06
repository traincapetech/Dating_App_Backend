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

// Index for geo-spatial queries
profileSchema.index({location: '2dsphere'});

// Virtual for id
profileSchema.virtual('id').get(function () {
  return this._id;
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
