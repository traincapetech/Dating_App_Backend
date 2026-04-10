/**
 * Payment Service - Multi-Gateway Support
 * Supports: Stripe (Global), Razorpay (India), In-App Purchases (iOS/Android)
 */

/**
 * Detect user's payment gateway based on currency/location
 */
export function detectPaymentGateway(currency = 'USD', country = null) {
  // Stripe only for now. Razorpay auto-detection disabled.
  return 'stripe';
}

/**
 * Create payment order
 */
export async function createPaymentOrder(userId, planId, amount, currency = 'USD', country = null) {
  try {
    const gateway = detectPaymentGateway(currency, country);
    switch (gateway) {
      case 'razorpay': return await createRazorpayOrder(userId, planId, amount, currency);
      case 'stripe':   return await createStripeOrder(userId, planId, amount, currency);
      case 'in_app':   return await createInAppOrder(userId, planId, amount, currency);
      default:         return await createStripeOrder(userId, planId, amount, currency);
    }
  } catch (error) {
    console.error('Error creating payment order:', error);
    throw error;
  }
}

async function createRazorpayOrder(userId, planId, amount, currency) {
  try {
    const orderId = `rzp_order_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    return { success: true, gateway: 'razorpay', orderId, amount, currency, key: process.env.RAZORPAY_KEY_ID };
  } catch (error) {
    console.error('Razorpay order creation error:', error);
    throw error;
  }
}

async function createStripeOrder(userId, planId, amount, currency) {
  try {
    if (!process.env.STRIPE_SECRET_KEY) {
      console.warn('[Stripe] STRIPE_SECRET_KEY not set, using mock payment');
      const orderId = `pi_mock_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const clientSecret = `pi_mock_${orderId}_secret_${Math.random().toString(36).substr(2, 16)}`;
      return { success: true, gateway: 'stripe', orderId, clientSecret, amount, currency, publishableKey: process.env.STRIPE_PUBLISHABLE_KEY || 'pk_test_mock' };
    }

    const stripe = (await import('stripe')).default;
    const stripeClient = stripe(process.env.STRIPE_SECRET_KEY);
    const paymentIntent = await stripeClient.paymentIntents.create({
      amount,
      currency: currency.toLowerCase(),
      metadata: { userId, planId },
      automatic_payment_methods: { enabled: true },
    });

    return {
      success: true, gateway: 'stripe',
      orderId: paymentIntent.id,
      clientSecret: paymentIntent.client_secret,
      amount, currency,
      publishableKey: process.env.STRIPE_PUBLISHABLE_KEY,
    };
  } catch (error) {
    console.error('Stripe order creation error:', error);
    throw error;
  }
}

async function createInAppOrder(userId, planId, amount, currency) {
  try {
    const orderId = `iap_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    return { success: true, gateway: 'in_app', orderId, amount, currency, productId: planId };
  } catch (error) {
    console.error('In-app purchase order creation error:', error);
    throw error;
  }
}

/**
 * Verify payment
 */
export async function verifyPayment(gateway, orderId, paymentId, signature, additionalData = {}) {
  try {
    switch (gateway) {
      case 'razorpay': return await verifyRazorpayPayment(orderId, paymentId, signature);
      case 'stripe':   return await verifyStripePayment(orderId, paymentId, signature, additionalData);
      case 'in_app':   return await verifyInAppPurchase(orderId, paymentId, signature, additionalData);
      default:         return { success: false, verified: false, error: 'Unknown payment gateway' };
    }
  } catch (error) {
    console.error('Error verifying payment:', error);
    return { success: false, verified: false, error: error.message };
  }
}

async function verifyRazorpayPayment(orderId, paymentId, signature) {
  // TODO: Add Razorpay HMAC signature check when integrated
  return { success: true, verified: true, paymentId, orderId };
}

async function verifyStripePayment(orderId, paymentId, signature, additionalData) {
  try {
    if (!process.env.STRIPE_SECRET_KEY) {
      console.warn('[Stripe] STRIPE_SECRET_KEY not set, using mock verification');
      return { success: true, verified: true, paymentId, orderId };
    }

    const stripe = (await import('stripe')).default;
    const stripeClient = stripe(process.env.STRIPE_SECRET_KEY);

    // Webhook path
    if (additionalData.webhookEvent && signature) {
      try {
        const event = stripeClient.webhooks.constructEvent(
          additionalData.webhookEvent,
          signature,
          process.env.STRIPE_WEBHOOK_SECRET,
        );
        if (event.type === 'payment_intent.succeeded') {
          const pi = event.data.object;
          return { success: true, verified: true, paymentId: pi.id, orderId: pi.metadata.orderId || orderId };
        }
      } catch (err) {
        console.error('Stripe webhook verification failed:', err.message);
        return { success: false, verified: false, error: err.message };
      }
    }

    // Direct retrieval (mobile flow)
    const paymentIntent = await stripeClient.paymentIntents.retrieve(paymentId || orderId);
    return {
      success: paymentIntent.status === 'succeeded',
      verified: paymentIntent.status === 'succeeded',
      paymentId: paymentIntent.id, orderId,
      status: paymentIntent.status,
    };
  } catch (error) {
    console.error('Stripe verification error:', error);
    return { success: false, verified: false, error: error.message };
  }
}

/**
 * Verify In-App Purchase
 * Android: verifies via Google Play Developer API
 * iOS: accepted from client (Apple receipt server validation can be added)
 */
async function verifyInAppPurchase(orderId, paymentId, signature, additionalData) {
  const { platform, purchaseToken, productId, packageName } = additionalData;

  if (platform === 'ios') {
    console.log('[IAP] iOS purchase — client-side verification accepted');
    return { success: true, verified: true, paymentId, orderId, platform: 'ios' };
  }

  if (platform === 'android') {
    return await verifyGooglePlayPurchase({ purchaseToken, productId, packageName, orderId, paymentId });
  }

  console.warn('[IAP] Unknown platform, accepting without verification');
  return { success: true, verified: true, paymentId, orderId, platform: 'unknown' };
}

/**
 * Verify Google Play subscription purchase using the Developer API.
 * Env required: GOOGLE_SERVICE_ACCOUNT_JSON (base64), GOOGLE_PLAY_PACKAGE_NAME
 */
async function verifyGooglePlayPurchase({ purchaseToken, productId, packageName, orderId, paymentId }) {
  try {
    if (!process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
      console.warn('[Google Play] GOOGLE_SERVICE_ACCOUNT_JSON not set — skipping verification in dev');
      return { success: true, verified: true, paymentId, orderId, platform: 'android' };
    }

    const pkg = packageName || process.env.GOOGLE_PLAY_PACKAGE_NAME;
    if (!pkg || !purchaseToken || !productId) {
      return { success: false, verified: false, error: 'Missing packageName, purchaseToken, or productId' };
    }

    const serviceAccountJson = JSON.parse(
      Buffer.from(process.env.GOOGLE_SERVICE_ACCOUNT_JSON, 'base64').toString('utf8'),
    );
    const accessToken = await getGoogleAccessToken(serviceAccountJson);

    const apiUrl = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${pkg}/purchases/subscriptions/${productId}/tokens/${purchaseToken}`;
    const response = await fetch(apiUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      const errBody = await response.text();
      console.error('[Google Play] API error:', response.status, errBody);
      return { success: false, verified: false, error: `Google Play API error: ${response.status}` };
    }

    const purchaseData = await response.json();
    console.log('[Google Play] Purchase verified:', purchaseData.orderId, 'paymentState:', purchaseData.paymentState);

    // paymentState: 0=pending, 1=received, 2=free trial, 3=deferred
    const isValid = purchaseData.paymentState === 1 || purchaseData.paymentState === 2;

    return {
      success: isValid, verified: isValid,
      paymentId: purchaseToken,
      orderId: purchaseData.orderId || orderId,
      platform: 'android',
      expiryTimeMillis: purchaseData.expiryTimeMillis,
      autoRenewing: purchaseData.autoRenewing,
    };
  } catch (error) {
    console.error('[Google Play] Verification error:', error);
    return { success: false, verified: false, error: error.message };
  }
}

/**
 * Obtain a Google OAuth2 access token from a service account using a self-signed JWT.
 */
async function getGoogleAccessToken(serviceAccount) {
  const { createSign } = await import('crypto');
  const now = Math.floor(Date.now() / 1000);

  const header  = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({
    iss:   serviceAccount.client_email,
    scope: 'https://www.googleapis.com/auth/androidpublisher',
    aud:   'https://oauth2.googleapis.com/token',
    exp:   now + 3600,
    iat:   now,
  })).toString('base64url');

  const signingInput = `${header}.${payload}`;
  const sign = createSign('RSA-SHA256');
  sign.update(signingInput);
  const jwtSignature = sign.sign(serviceAccount.private_key, 'base64url');
  const jwt = `${signingInput}.${jwtSignature}`;

  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });

  if (!tokenResponse.ok) {
    const err = await tokenResponse.text();
    throw new Error(`Failed to get Google access token: ${err}`);
  }

  const tokenData = await tokenResponse.json();
  return tokenData.access_token;
}

/**
 * Handle Google Play Real-Time Developer Notifications (RTDN).
 * Google sends Pub/Sub messages on subscription lifecycle events.
 * Pass the raw Pub/Sub message object here; data is base64-encoded.
 */
export async function handleGooglePlayRTDN(message) {
  try {
    const rawData = Buffer.from(message.data, 'base64').toString('utf8');
    const notification = JSON.parse(rawData);
    console.log('[RTDN] Received:', JSON.stringify(notification));

    const { subscriptionNotification } = notification;
    if (!subscriptionNotification) {
      console.log('[RTDN] Not a subscription notification, skipping');
      return { success: true, handled: false };
    }

    const { notificationType, purchaseToken } = subscriptionNotification;

    const { findSubscriptionByPurchaseToken, updateSubscription } = await import('../models/Subscription.js');
    const { updateUserPremiumStatus } = await import('./subscriptionExpiryService.js');

    const subscription = await findSubscriptionByPurchaseToken(purchaseToken);
    if (!subscription) {
      console.warn(`[RTDN] No subscription found for purchaseToken: ${purchaseToken}`);
      return { success: true, handled: false };
    }

    /**
     * RTDN notification types:
     * 1 = RECOVERED, 2 = RENEWED, 3 = CANCELED, 4 = PURCHASED
     * 5 = ON_HOLD, 6 = GRACE_PERIOD, 7 = RESTARTED
     * 12 = REVOKED, 13 = EXPIRED
     */
    switch (notificationType) {
      case 1: // RECOVERED
      case 2: // RENEWED
        await updateSubscription(subscription.id, { status: 'active', autoRenew: true });
        await updateUserPremiumStatus(subscription.userId);
        console.log(`[RTDN] Subscription ${subscription.id} renewed/recovered`);
        break;

      case 3: // CANCELED
        await updateSubscription(subscription.id, {
          status: 'cancelled', autoRenew: false,
          cancelledAt: new Date().toISOString(),
          cancellationReason: 'Cancelled via Google Play',
        });
        console.log(`[RTDN] Subscription ${subscription.id} cancelled via Play Store`);
        break;

      case 12: // REVOKED
      case 13: // EXPIRED
        await updateSubscription(subscription.id, {
          status: 'expired', autoRenew: false,
          expiredAt: new Date().toISOString(),
        });
        await updateUserPremiumStatus(subscription.userId);
        console.log(`[RTDN] Subscription ${subscription.id} revoked/expired`);
        break;

      default:
        console.log(`[RTDN] Unhandled notification type: ${notificationType}`);
    }

    return { success: true, handled: true, notificationType };
  } catch (error) {
    console.error('[RTDN] Error handling notification:', error);
    throw error;
  }
}

/**
 * Process refund
 */
export async function processRefund(gateway, paymentId, amount = null, currency = 'USD') {
  try {
    switch (gateway) {
      case 'razorpay': return await processRazorpayRefund(paymentId, amount);
      case 'stripe':   return await processStripeRefund(paymentId, amount);
      case 'in_app':   return await processInAppRefund(paymentId, amount);
      default:         throw new Error('Unknown payment gateway');
    }
  } catch (error) {
    console.error('Error processing refund:', error);
    throw error;
  }
}

async function processRazorpayRefund(paymentId, amount) {
  // TODO: Add Razorpay refund API call when integrated
  return { success: true, refundId: `rfnd_${Date.now()}`, amount };
}

/**
 * Real Stripe refund
 */
async function processStripeRefund(paymentId, amount) {
  try {
    if (!process.env.STRIPE_SECRET_KEY) {
      console.warn('[Stripe] STRIPE_SECRET_KEY not set, using mock refund');
      return { success: true, refundId: `re_mock_${Date.now()}`, amount };
    }

    const stripe = (await import('stripe')).default;
    const stripeClient = stripe(process.env.STRIPE_SECRET_KEY);

    const refundParams = { payment_intent: paymentId };
    if (amount) refundParams.amount = Math.round(amount * 100); // cents

    const refund = await stripeClient.refunds.create(refundParams);
    console.log(`[Stripe] Refund ${refund.id} created for payment ${paymentId}`);

    return {
      success: true,
      refundId: refund.id,
      amount: refund.amount / 100,
      status: refund.status,
      currency: refund.currency,
    };
  } catch (error) {
    console.error('Stripe refund error:', error);
    throw error;
  }
}

/**
 * Google Play refund via Developer API (revoke subscription)
 * For iOS: must be handled manually in App Store Connect.
 */
async function processInAppRefund(paymentId, amount) {
  try {
    if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON && paymentId) {
      try {
        const serviceAccountJson = JSON.parse(
          Buffer.from(process.env.GOOGLE_SERVICE_ACCOUNT_JSON, 'base64').toString('utf8'),
        );
        const accessToken = await getGoogleAccessToken(serviceAccountJson);
        const pkg = process.env.GOOGLE_PLAY_PACKAGE_NAME;

        // Revoke the purchase (this voids the subscription and issues a refund via Play)
        const revokeUrl = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${pkg}/purchases/subscriptions/${paymentId}/tokens/${paymentId}:revoke`;
        const response = await fetch(revokeUrl, {
          method: 'POST',
          headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ revoke: true }),
        });

        if (response.ok) {
          console.log(`[Google Play] Subscription revoked/refunded for token: ${paymentId}`);
          return { success: true, refundId: `gp_refund_${Date.now()}`, amount, note: 'Refund issued through Google Play' };
        }
      } catch (gpError) {
        console.error('[Google Play] Refund API error:', gpError.message);
      }
    }

    return {
      success: true,
      refundId: `iap_refund_${Date.now()}`,
      amount,
      note: 'Refund recorded — process manually in Google Play Console / App Store Connect',
    };
  } catch (error) {
    console.error('In-app purchase refund error:', error);
    throw error;
  }
}

/**
 * Get supported payment gateways for a country/currency
 */
export function getSupportedGateways(country = null, currency = 'USD') {
  const gateways = [];

  gateways.push({
    id: 'stripe', name: 'Stripe', supported: true,
    currencies: ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY', 'SGD', 'AED', 'INR', 'and 135+ more'],
    countries: 'Global',
    description: 'Credit/Debit cards, Apple Pay, Google Pay, and more',
  });

  if (country === 'IN' || country === 'India' || currency === 'INR') {
    gateways.push({
      id: 'razorpay', name: 'Razorpay', supported: true,
      currencies: ['INR'], countries: ['India'],
      description: 'UPI, Cards, Net Banking, Wallets (India only)',
    });
  }

  gateways.push({
    id: 'in_app', name: 'In-App Purchase', supported: true,
    currencies: 'All (via app stores)', countries: 'Global',
    description: 'Apple App Store / Google Play Store payments',
  });

  return gateways;
}
