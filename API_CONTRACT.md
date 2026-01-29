# Pryvo Dating App - API Contract v1.0

> **Base URL:** `http://localhost:3000/api` (development)  
> **Last Updated:** 2026-01-29

---

## Table of Contents
1. [Authentication](#1-authentication)
2. [Profile Management](#2-profile-management)
3. [Discovery & Matching](#3-discovery--matching)
4. [Comments (Icebreakers)](#4-comments-icebreakers)
5. [Chat & Messaging](#5-chat--messaging)
6. [Boost (Priority Profiles)](#6-boost-priority-profiles)
7. [Subscriptions & Payments](#7-subscriptions--payments)
8. [Notifications](#8-notifications)
9. [Newsletter](#9-newsletter)
10. [Admin Panel](#9-admin-panel)
11. [User Safety](#10-user-safety)
12. [GDPR & Privacy](#11-gdpr--privacy)
13. [Error Handling](#12-error-handling)

---

## Common Headers

### User Authentication
```
Authorization: Bearer <jwt_token>
```

### Admin Authentication
```
Authorization: Bearer <admin_jwt_token>
x-admin-token: <admin_jwt_token>
```

### Rate Limiting Headers (Returned)
```
RateLimit-Limit: 100
RateLimit-Remaining: 95
RateLimit-Reset: 1706524800
```

---

## 1. Authentication

### POST `/api/auth/signup`
Create a new user account.

**Rate Limit:** 10 requests per 15 minutes

**Request:**
```json
{
  "fullName": "string (2-80 chars, required)",
  "email": "string (valid email, required)",
  "phone": "string (5-20 chars, required)",
  "password": "string (6-64 chars, required)"
}
```

**Response (201):**
```json
{
  "success": true,
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "fullName": "John Doe"
  },
  "token": "jwt_token"
}
```

---

### POST `/api/auth/login`
Authenticate existing user.

**Rate Limit:** 10 requests per 15 minutes

**Request:**
```json
{
  "email": "string (required)",
  "password": "string (min 6 chars, required)"
}
```

**Response (200):**
```json
{
  "success": true,
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "fullName": "John Doe"
  },
  "token": "jwt_token"
}
```

---

### POST `/api/auth/change-email`
Update user's email address.

**Auth Required:** Yes (JWT)

**Request:**
```json
{
  "userId": "uuid (required)",
  "newEmail": "string (valid email, required)",
  "password": "string (min 6 chars, required)"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Email updated successfully"
}
```

---

### POST `/api/auth/change-password`
Update user's password.

**Auth Required:** Yes (JWT)

**Request:**
```json
{
  "userId": "uuid (required)",
  "currentPassword": "string (min 6 chars, required)",
  "newPassword": "string (6-64 chars, required)"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Password updated successfully"
}
```

---

### POST `/api/auth/forgot-password`
Request password reset code (sent via email).

**Rate Limit:** 3 requests per hour

**Request:**
```json
{
  "email": "string (valid email, required)"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Reset code sent to your email"
}
```

---

### POST `/api/auth/reset-password`
Reset password using email code.

**Rate Limit:** 3 requests per hour

**Request:**
```json
{
  "email": "string (valid email, required)",
  "code": "string (6 digits, required)",
  "newPassword": "string (6-64 chars, required)"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Password reset successfully"
}
```

---

### POST `/api/auth/logout-all-devices`
Invalidate all JWT tokens for user.

**Auth Required:** Yes (JWT)

**Request:**
```json
{
  "userId": "uuid (optional, from token)"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Logged out from all devices successfully"
}
```

---

### DELETE `/api/auth/user/:userId`
Delete user account.

**Auth Required:** Yes (JWT)

**Response (200):**
```json
{
  "success": true,
  "message": "User and profile deleted successfully"
}
```

---

## 2. Profile Management

### POST `/api/profile/basic-info`
Save/update basic profile info.

**Request:**
```json
{
  "userId": "uuid (required)",
  "firstName": "string (1-50 chars, optional)",
  "lastName": "string (1-50 chars, optional)",
  "dob": "string (YYYY-MM-DD, optional)",
  "gender": "Man | Woman | Non Binary (optional)",
  "showGenderOnProfile": "boolean (optional)",
  "location": "string (optional)",
  "locationDetails": {
    "lat": "number (required)",
    "lng": "number (required)",
    "source": "string (optional)",
    "timestamp": "number (optional)"
  }
}
```

**Response (200):**
```json
{
  "profile": { /* full profile object */ }
}
```

---

### POST `/api/profile/dating-preferences`
Save dating preferences.

**Request:**
```json
{
  "userId": "uuid (required)",
  "whoToDate": ["Men", "Women", "Nonbinary People", "Everyone"],
  "datingIntention": "string (optional)",
  "relationshipType": "Monogamy | Non-Monogamy (optional)",
  "showIntentionOnProfile": "boolean (optional)",
  "showRelationshipTypeOnProfile": "boolean (optional)"
}
```

---

### POST `/api/profile/personal-details`
Save personal details.

**Request:**
```json
{
  "userId": "uuid (required)",
  "familyPlans": "string (optional)",
  "hasChildren": "string (optional)",
  "ethnicity": "string (optional)",
  "height": "string (optional)",
  "hometown": "string (optional)",
  "workplace": "string (optional)",
  "jobTitle": "string (optional)",
  "school": "string (optional)",
  "educationLevel": "string (optional)"
}
```

---

### POST `/api/profile/lifestyle`
Save lifestyle preferences.

**Request:**
```json
{
  "userId": "uuid (required)",
  "drink": "string (optional)",
  "smokeTobacco": "string (optional)",
  "smokeWeed": "string (optional)",
  "useDrugs": "string (optional)",
  "politicalBeliefs": "string (optional)",
  "religiousBeliefs": "string (optional)",
  "interests": ["string"] 
}
```

---

### POST `/api/profile/profile-prompts`
Save profile prompts (icebreakers).

**Request:**
```json
{
  "userId": "uuid (required)",
  "aboutMe": {
    "prompt": "string",
    "answer": "string"
  },
  "selfCare": {
    "prompt": "string",
    "answer": "string"
  },
  "gettingPersonal": {
    "prompt": "string",
    "answer": "string"
  }
}
```

---

### POST `/api/profile/media`
Save profile photos/videos.

**Request:**
```json
{
  "userId": "uuid (required)",
  "media": [
    {
      "type": "photo | video",
      "url": "string (required)",
      "order": "number (required)"
    }
  ]
}
```

---

### POST `/api/profile/upload-image`
Upload a single image.

**Request:**
```json
{
  "userId": "uuid (required)",
  "imageUri": "string (base64 data URI, required)",
  "fileName": "string (optional)",
  "contentType": "string (default: image/jpeg)"
}
```

**Response (200):**
```json
{
  "success": true,
  "url": "https://pub-xxx.r2.dev/profiles/userId/images/uuid.jpg",
  "message": "Image uploaded successfully",
  "storageDriver": "r2",
  "filePath": "profiles/userId/images/uuid.jpg"
}
```

---

### GET `/api/profile/:userId`
Get user profile.

**Response (200):**
```json
{
  "profile": {
    "userId": "uuid",
    "basicInfo": { /* BasicInfo object */ },
    "datingPreferences": { /* DatingPreferences object */ },
    "personalDetails": { /* PersonalDetails object */ },
    "lifestyle": { /* Lifestyle object */ },
    "profilePrompts": { /* ProfilePrompts object */ },
    "media": {
      "media": [{ "type": "photo", "url": "...", "order": 0 }]
    },
    "isPaused": false,
    "isHidden": false
  }
}
```

---

### PUT `/api/profile/update`
Update any profile section.

**Request:**
```json
{
  "userId": "uuid (required)",
  "basicInfo": { /* partial BasicInfo */ },
  "datingPreferences": { /* partial */ },
  "personalDetails": { /* partial */ },
  "lifestyle": { /* partial */ },
  "profilePrompts": { /* partial */ },
  "isPaused": "boolean",
  "isHidden": "boolean"
}
```

---

### POST `/api/profile/pause`
Pause/unpause profile visibility.

**Request:**
```json
{
  "userId": "uuid (required)",
  "isPaused": "boolean (required)"
}
```

---

### GET `/api/profile/discover`
Get discovery feed profiles.

**Query Parameters:**
| Param | Type | Description |
|-------|------|-------------|
| `excludeUserId` | string | User to exclude |
| `useMatching` | boolean | Use compatibility scoring |
| `minScore` | number | Minimum match score |
| `maxDistance` | number | Max distance in km |
| `sortBy` | string | 'score', 'distance', 'recent' |
| `limit` | number | Max profiles to return |
| `educationLevel` | string | Filter by education |
| `minHeight` | number | Filter by min height |
| `maxHeight` | number | Filter by max height |

**Response (200):**
```json
{
  "profiles": [
    {
      "userId": "uuid",
      "basicInfo": { /* ... */ },
      "media": { /* ... */ },
      "matchScore": 85,
      "distance": 5.2
    }
  ]
}
```

---

### DELETE `/api/profile/:userId`
Delete user profile (keeps account).

**Auth Required:** Yes (JWT)

---

## 3. Discovery & Matching

### POST `/api/swipe/like`
Like a user.

**Rate Limit:** 100 per hour

**Request:**
```json
{
  "senderId": "uuid (required)",
  "receiverId": "uuid (required)",
  "isPremium": "boolean (optional)",
  "likedContent": {
    "type": "profile | photo | prompt",
    "photoIndex": "number (if photo)",
    "photoUrl": "string (if photo)",
    "promptId": "string (if prompt)",
    "promptQuestion": "string (if prompt)",
    "promptAnswer": "string (if prompt)",
    "comment": "string (max 200 chars, optional)"
  }
}
```

**Response (200):**
```json
{
  "success": true,
  "isMatch": false,
  "dailyLikeInfo": {
    "count": 5,
    "limit": 50,
    "remaining": 45,
    "isPremium": false
  }
}
```

**Response (Match Created):**
```json
{
  "success": true,
  "isMatch": true,
  "match": {
    "_id": "matchId",
    "users": ["userId1", "userId2"],
    "createdAt": "2026-01-29T10:00:00Z"
  },
  "dailyLikeInfo": { /* ... */ }
}
```

---

### POST `/api/swipe/pass`
Pass on a user.

**Request:**
```json
{
  "userId": "uuid (required)",
  "passedUserId": "uuid (required)"
}
```

---

### POST `/api/swipe/undo`
Undo last swipe (premium only).

**Request:**
```json
{
  "userId": "uuid (required)"
}
```

**Response (200):**
```json
{
  "success": true,
  "undoneAction": "pass | like",
  "undoneUserId": "uuid",
  "message": "Swipe undone successfully"
}
```

**Response (403 - Not Premium):**
```json
{
  "success": false,
  "message": "Undo is a premium feature. Upgrade to unlock!",
  "requiresPremium": true
}
```

---

### GET `/api/swipe/undo-status/:userId`
Check if user can undo.

**Response (200):**
```json
{
  "success": true,
  "isPremium": false,
  "canUndo": false,
  "lastAction": "pass | like | null",
  "lastActionTime": "timestamp | null",
  "requiresPremium": true
}
```

---

### GET `/api/swipe/likes/:userId`
Get users who liked you.

**Response (200):**
```json
{
  "success": true,
  "count": 5,
  "likes": [
    {
      "userId": "uuid",
      "likedAt": "timestamp",
      "name": "Jane",
      "age": 25,
      "photo": "url"
    }
  ],
  "isPremiumRequired": false
}
```

---

### GET `/api/swipe/likes-count/:userId`
Get count of pending likes.

**Response (200):**
```json
{
  "success": true,
  "count": 5
}
```

---

### GET `/api/swipe/daily-likes/:userId`
Get daily like usage info.

**Response (200):**
```json
{
  "success": true,
  "count": 15,
  "limit": 50,
  "remaining": 35,
  "isPremium": false
}
```

---

### GET `/api/match/:userId`
Get all matches for user.

**Response (200):**
```json
{
  "success": true,
  "matches": [
    {
      "_id": "matchId",
      "users": ["userId1", "userId2"],
      "createdAt": "timestamp",
      "lastMessage": { /* ... */ },
      "otherUser": {
        "name": "Jane",
        "photo": "url"
      }
    }
  ]
}
```

---

### GET `/api/match/detail/:matchId`
Get match details.

---

### POST `/api/match/:matchId/unmatch`
Unmatch a user.

**Request:**
```json
{
  "userId": "uuid (required)"
}
```

---

## 4. Chat & Messaging

### GET `/api/chat/:matchId`
Get messages for a match.

**Query Parameters:**
| Param | Type | Description |
|-------|------|-------------|
| `userId` | string | Current user ID |
| `limit` | number | Max messages |
| `before` | string | Cursor for pagination |

**Response (200):**
```json
{
  "success": true,
  "messages": [
    {
      "_id": "messageId",
      "matchId": "matchId",
      "senderId": "userId",
      "content": "Hello!",
      "type": "text | image | gif",
      "mediaUrl": "string | null",
      "status": "sent | delivered | seen",
      "createdAt": "timestamp"
    }
  ]
}
```

---

### POST `/api/chat`
Send a message.

**Rate Limit:** 50 per minute

**Request:**
```json
{
  "matchId": "uuid (required)",
  "senderId": "uuid (required)",
  "content": "string (max 2000 chars)",
  "type": "text | image | gif (default: text)",
  "mediaUrl": "string (required for image/gif)"
}
```

---

### POST `/api/chat/:matchId/seen`
Mark messages as seen.

**Request:**
```json
{
  "userId": "uuid (required)"
}
```

---

### POST `/api/chat/last-messages`
Get last message for multiple matches (batch).

**Request:**
```json
{
  "matchIds": ["matchId1", "matchId2"]
}
```

---

### POST `/api/media/chat`
Upload chat media.

**Rate Limit:** 10 per 10 minutes

**Request:**
```json
{
  "imageUri": "string (base64)",
  "userId": "uuid"
}
```

---

## 5. Subscriptions & Payments

### GET `/api/subscription/plans`
Get available subscription plans.

**Response (200):**
```json
{
  "success": true,
  "plans": [
    {
      "id": "premium_monthly",
      "name": "Premium Monthly",
      "price": 999,
      "currency": "INR",
      "duration": 30,
      "features": ["Unlimited likes", "See who likes you", "Undo swipes"]
    }
  ]
}
```

---

### GET `/api/subscription/status/:userId`
Get user's subscription status.

**Response (200):**
```json
{
  "success": true,
  "isPremium": true,
  "subscription": {
    "_id": "subId",
    "planId": "premium_monthly",
    "status": "active",
    "startDate": "timestamp",
    "endDate": "timestamp",
    "autoRenew": true
  }
}
```

---

### POST `/api/subscription/payment/order`
Create Stripe payment order.

**Request:**
```json
{
  "userId": "uuid",
  "planId": "premium_monthly"
}
```

---

### POST `/api/subscription/payment/verify`
Verify payment and activate subscription.

**Request:**
```json
{
  "userId": "uuid",
  "paymentIntentId": "string",
  "planId": "premium_monthly"
}
```

---

### POST `/api/subscription/cancel/:subscriptionId`
Cancel subscription.

---

### POST `/api/subscription/auto-renew/:subscriptionId`
Toggle auto-renewal.

**Request:**
```json
{
  "enabled": "boolean"
}
```

---

## 6. Notifications

### POST `/api/notifications/register`
Register FCM token.

**Request:**
```json
{
  "userId": "uuid (required)",
  "token": "string (FCM token, required)",
  "platform": "ios | android (optional)"
}
```

---

### POST `/api/notifications/unregister`
Remove FCM token.

**Request:**
```json
{
  "userId": "uuid",
  "token": "string"
}
```

---

### GET `/api/notifications/preferences/:userId`
Get notification preferences.

**Response (200):**
```json
{
  "success": true,
  "preferences": {
    "newMatches": true,
    "newMessages": true,
    "newLikes": true,
    "promotions": false
  }
}
```

---

### PUT `/api/notifications/preferences/:userId`
Update preferences.

**Request:**
```json
{
  "newMatches": true,
  "newMessages": true,
  "newLikes": false
}
```

---

## 9. Newsletter

### POST `/api/newsletter/subscribe`
Subscribe an email to the newsletter.

**Rate Limit:** 10 requests per 15 minutes

**Request:**
```json
{
  "email": "string (valid email, required)",
  "source": "string (optional, e.g. 'landing_page')"
}
```

**Response (201):**
```json
{
  "success": true,
  "message": "Thank you for subscribing to our newsletter!"
}
```

---

### GET `/api/newsletter`
Get list of all subscribers.

**Auth Required:** Yes (Admin JWT)

**Response (200):**
```json
{
  "success": true,
  "count": 150,
  "subscribers": [
    {
      "email": "user@example.com",
      "status": "active",
      "subscribedAt": "timestamp"
    }
  ]
}
```

---

### POST `/api/newsletter/send`
Send a broadcast newsletter to all active subscribers.

**Auth Required:** Yes (Admin JWT)

**Request:**
```json
{
  "subject": "string (required)",
  "content": "string (text version, required)",
  "html": "string (html version, optional)"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Newsletter broadcast complete. Sent to 150 subscribers, 0 failed.",
  "results": {
    "total": 150,
    "success": 150,
    "failed": 0
  }
}
```

---

## 10. Admin Panel

### POST `/api/admin/login`
Admin login.

**Request:**
```json
{
  "email": "admin@pryvo.com",
  "password": "string"
}
```

**Response (200):**
```json
{
  "success": true,
  "admin": { "id": "...", "email": "...", "role": "super_admin" },
  "token": "admin_jwt_token"
}
```

---

### Admin Endpoints (Require Admin Auth)

| Endpoint | Method | Permission | Description |
|----------|--------|------------|-------------|
| `/api/admin/profile` | GET | - | Get admin profile |
| `/api/admin/dashboard/analytics` | GET | view_analytics | Dashboard stats |
| `/api/admin/subscriptions` | GET | view_subscriptions | List subscriptions |
| `/api/admin/subscriptions/:id` | GET | view_subscriptions | Subscription details |
| `/api/admin/subscriptions/:id/refund` | POST | process_refunds | Process refund |
| `/api/admin/subscriptions/:id/cancel` | POST | manage_subscriptions | Cancel sub |
| `/api/admin/payments/stats` | GET | view_subscriptions | Payment stats |
| `/api/admin/users` | GET | view_users | List users |
| `/api/admin/users/:id` | GET | view_users | User details |
| `/api/admin/users/:id/suspend` | POST | manage_users | Suspend user |
| `/api/admin/users/:id` | DELETE | manage_users | Delete user |
| `/api/admin/reports` | GET | view_reports | List reports |
| `/api/admin/reports/:id` | GET | view_reports | Report details |
| `/api/admin/reports/:id/status` | PUT | view_reports | Update status |
| `/api/admin/profiles/pending` | GET | moderate_content | Pending profiles |
| `/api/admin/profiles/flagged` | GET | moderate_content | Flagged profiles |
| `/api/admin/profiles/:id/moderate` | POST | moderate_content | Moderate profile |

---

## 11. User Safety

### POST `/api/users/block`
Block a user.

**Request:**
```json
{
  "userId": "uuid (blocker)",
  "blockedUserId": "uuid (blocked)"
}
```

---

### POST `/api/users/unblock`
Unblock a user.

---

### GET `/api/users/blocked/:userId`
Get blocked users list.

---

### GET `/api/users/check/:userId/:otherUserId`
Check if blocked.

---

### POST `/api/users/report`
Report a user.

**Request:**
```json
{
  "reporterId": "uuid",
  "reportedUserId": "uuid",
  "reason": "harassment | spam | fake_profile | inappropriate_content | other",
  "description": "string (optional)"
}
```

---

### POST `/api/users/block-and-report`
Block and report in one action.

---

## 12. GDPR & Privacy

### GET `/api/gdpr/export`
Export all user data.

**Auth Required:** Yes (JWT)

**Response:** JSON file with all user data.

---

### POST `/api/gdpr/delete-request`
Request account deletion (30-day grace period).

**Auth Required:** Yes (JWT)

**Request:**
```json
{
  "userId": "uuid"
}
```

---

### POST `/api/gdpr/cancel-deletion`
Cancel scheduled deletion.

---

### DELETE `/api/gdpr/delete-immediate/:userId`
Immediate deletion (admin only).

---

## 13. Error Handling

### Standard Error Response
```json
{
  "success": false,
  "message": "Error description",
  "errors": [
    {
      "path": "field.name",
      "message": "Validation error message"
    }
  ]
}
```

### HTTP Status Codes
| Code | Description |
|------|-------------|
| 200 | Success |
| 201 | Created |
| 400 | Bad Request / Validation Error |
| 401 | Unauthorized (invalid/missing token) |
| 403 | Forbidden (insufficient permissions) |
| 404 | Not Found |
| 429 | Rate Limit Exceeded |
| 500 | Internal Server Error |

### Rate Limit Response (429)
```json
{
  "success": false,
  "message": "Too many requests, please try again later.",
  "retryAfter": 900
}
```

### Validation Error (400)
```json
{
  "message": "Validation failed",
  "errors": [
    { "path": "email", "message": "Invalid email format" },
    { "path": "password", "message": "Password must be at least 6 characters" }
  ]
}
```

---

## Rate Limits Summary

| Endpoint Group | Limit | Window |
|----------------|-------|--------|
| General API | 100 | 15 min |
| Auth (login/signup) | 10 | 15 min |
| OTP | 5 | 10 min |
| Password Reset | 3 | 1 hour |
| Swipes | 100 | 1 hour |
| Messages | 50 | 1 min |
| Media Uploads | 10 | 10 min |

---

## WebSocket Events (Socket.IO)

### Connection
```javascript
socket.connect('http://localhost:3000', {
  query: { userId: 'user-uuid' }
});
```

### Events
| Event | Direction | Payload |
|-------|-----------|---------|
| `new_message` | Server → Client | `{ matchId, message }` |
| `typing` | Client → Server | `{ matchId, userId, isTyping }` |
| `typing_status` | Server → Client | `{ matchId, userId, isTyping }` |
| `message_seen` | Server → Client | `{ matchId, messageId }` |
| `new_match` | Server → Client | `{ match, otherUser }` |
| `online_status` | Server → Client | `{ userId, isOnline }` |

---

## JWT Token Structure

### User Token
```json
{
  "sub": "user-uuid",
  "email": "user@example.com",
  "iat": 1706524800,
  "exp": 1709203200
}
```

### Admin Token
```json
{
  "adminId": "admin-uuid",
  "email": "admin@pryvo.com",
  "role": "super_admin",
  "iat": 1706524800,
  "exp": 1706611200
}
```

---

## Admin Permissions
- `view_users` - View user list and details
- `manage_users` - Suspend/delete users
- `view_subscriptions` - View subscription data
- `manage_subscriptions` - Cancel subscriptions
- `process_refunds` - Process payment refunds
- `view_reports` - View user reports
- `moderate_content` - Moderate profiles/content
- `view_analytics` - View dashboard analytics

---

*Generated by Pryvo Backend Analysis - Version 1.0*
