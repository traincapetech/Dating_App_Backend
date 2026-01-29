/**
 * Email Notification Service
 * Sends email notifications for matches, messages, and other activities
 */

import { config } from '../config/env.js';

// Check if Brevo is configured
function isBrevoConfigured() {
  return !!config.email.brevoApiKey;
}

// Send email via Brevo API
async function sendEmail({ to, subject, htmlContent, textContent }) {
  if (!isBrevoConfigured()) {
    console.log('[Email Notification] Brevo not configured, skipping email');
    return false;
  }

  const { brevoApiKey, brevoSenderEmail, brevoSenderName } = config.email;

  try {
    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'api-key': brevoApiKey,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        sender: {
          name: brevoSenderName || 'Pryvo',
          email: brevoSenderEmail || 'noreply@pryvo.com',
        },
        to: [{ email: to }],
        subject,
        htmlContent,
        textContent,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error(`[Email Notification] Failed: ${response.status}`, errorData);
      return false;
    }

    console.log(`[Email Notification] Sent to ${to}: ${subject}`);
    return true;
  } catch (error) {
    console.error('[Email Notification] Error:', error.message);
    return false;
  }
}

// Email template for new match
function getMatchEmailHtml(matchName, matchPhoto) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>New Match on Pryvo!</title>
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1F1F1F; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #FFF5F3;">
      <div style="text-align: center; margin-bottom: 30px;">
        <h1 style="color: #DB2D0B; margin: 0; font-size: 32px;">💕 It's a Match!</h1>
      </div>
      
      <div style="background: linear-gradient(135deg, #DB2D0B 0%, #FF6B4A 100%); border-radius: 20px; padding: 30px; text-align: center; margin-bottom: 30px;">
        ${matchPhoto ? `<img src="${matchPhoto}" alt="${matchName}" style="width: 120px; height: 120px; border-radius: 60px; border: 4px solid white; object-fit: cover; margin-bottom: 15px;" />` : ''}
        <h2 style="color: white; margin: 0; font-size: 24px;">You matched with ${matchName}!</h2>
        <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0;">Start a conversation now</p>
      </div>
      
      <div style="text-align: center;">
        <a href="https://pryvo.app/messages" style="display: inline-block; background: #DB2D0B; color: white; text-decoration: none; padding: 15px 40px; border-radius: 30px; font-weight: bold; font-size: 16px;">Open Pryvo</a>
      </div>
      
      <p style="text-align: center; color: #666; font-size: 14px; margin-top: 40px;">
        Don't miss your chance to connect! Send the first message.
      </p>
      
      <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;" />
      
      <p style="text-align: center; color: #999; font-size: 12px;">
        You're receiving this email because you have notifications enabled on Pryvo.<br>
        <a href="https://pryvo.app/settings/notifications" style="color: #DB2D0B;">Manage preferences</a>
      </p>
    </body>
    </html>
  `;
}

// Email template for new message
function getMessageEmailHtml(senderName, senderPhoto, messagePreview) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>New Message on Pryvo</title>
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1F1F1F; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #FFF5F3;">
      <div style="text-align: center; margin-bottom: 30px;">
        <h1 style="color: #DB2D0B; margin: 0; font-size: 28px;">💬 New Message</h1>
      </div>
      
      <div style="background: white; border-radius: 20px; padding: 25px; box-shadow: 0 4px 15px rgba(219, 45, 11, 0.1); margin-bottom: 30px;">
        <div style="display: flex; align-items: center; margin-bottom: 15px;">
          ${senderPhoto ? `<img src="${senderPhoto}" alt="${senderName}" style="width: 50px; height: 50px; border-radius: 25px; object-fit: cover; margin-right: 15px;" />` : ''}
          <div>
            <h3 style="margin: 0; color: #1F1F1F;">${senderName}</h3>
            <p style="margin: 5px 0 0; color: #666; font-size: 14px;">sent you a message</p>
          </div>
        </div>
        <div style="background: #F8F8F8; border-radius: 15px; padding: 15px; border-left: 4px solid #DB2D0B;">
          <p style="margin: 0; color: #1F1F1F; font-size: 16px;">"${messagePreview}"</p>
        </div>
      </div>
      
      <div style="text-align: center;">
        <a href="https://pryvo.app/messages" style="display: inline-block; background: #DB2D0B; color: white; text-decoration: none; padding: 15px 40px; border-radius: 30px; font-weight: bold; font-size: 16px;">Reply Now</a>
      </div>
      
      <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;" />
      
      <p style="text-align: center; color: #999; font-size: 12px;">
        You're receiving this email because you have notifications enabled on Pryvo.<br>
        <a href="https://pryvo.app/settings/notifications" style="color: #DB2D0B;">Manage preferences</a>
      </p>
    </body>
    </html>
  `;
}

// Email template for someone liked you
function getLikeEmailHtml(likerName, likerPhoto, isVisible = true) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Someone Likes You!</title>
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1F1F1F; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #FFF5F3;">
      <div style="text-align: center; margin-bottom: 30px;">
        <h1 style="color: #DB2D0B; margin: 0; font-size: 32px;">💕 Someone Likes You!</h1>
      </div>
      
      <div style="background: linear-gradient(135deg, #FF6B4A 0%, #DB2D0B 100%); border-radius: 20px; padding: 30px; text-align: center; margin-bottom: 30px;">
        ${isVisible && likerPhoto ? `<img src="${likerPhoto}" alt="${likerName}" style="width: 100px; height: 100px; border-radius: 50px; border: 4px solid white; object-fit: cover; margin-bottom: 15px;" />` : '<div style="width: 100px; height: 100px; border-radius: 50px; background: rgba(255,255,255,0.3); margin: 0 auto 15px; display: flex; align-items: center; justify-content: center; font-size: 40px;">❓</div>'}
        <h2 style="color: white; margin: 0; font-size: 24px;">${isVisible ? `${likerName} likes you!` : 'Someone new likes you!'}</h2>
        <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0;">${isVisible ? 'Like them back to match!' : 'Open the app to find out who!'}</p>
      </div>
      
      <div style="text-align: center;">
        <a href="https://pryvo.app/likes" style="display: inline-block; background: #DB2D0B; color: white; text-decoration: none; padding: 15px 40px; border-radius: 30px; font-weight: bold; font-size: 16px;">See Who Likes You</a>
      </div>
      
      <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;" />
      
      <p style="text-align: center; color: #999; font-size: 12px;">
        You're receiving this email because you have notifications enabled on Pryvo.<br>
        <a href="https://pryvo.app/settings/notifications" style="color: #DB2D0B;">Manage preferences</a>
      </p>
    </body>
    </html>
  `;
}

/**
 * Send match notification email
 */
export async function sendMatchEmail(userEmail, matchName, matchPhoto) {
  const htmlContent = getMatchEmailHtml(matchName, matchPhoto);
  const textContent = `It's a Match! You matched with ${matchName} on Pryvo. Open the app to start chatting!`;
  
  return sendEmail({
    to: userEmail,
    subject: `💕 It's a Match! You matched with ${matchName}`,
    htmlContent,
    textContent,
  });
}

/**
 * Send new message notification email
 */
export async function sendMessageEmail(userEmail, senderName, senderPhoto, messagePreview) {
  // Truncate message preview
  const preview = messagePreview.length > 100 
    ? messagePreview.slice(0, 100) + '...' 
    : messagePreview;
    
  const htmlContent = getMessageEmailHtml(senderName, senderPhoto, preview);
  const textContent = `${senderName} sent you a message on Pryvo: "${preview}"`;
  
  return sendEmail({
    to: userEmail,
    subject: `💬 ${senderName} sent you a message`,
    htmlContent,
    textContent,
  });
}

/**
 * Send like notification email
 */
export async function sendLikeEmail(userEmail, likerName, likerPhoto, isVisible = true) {
  const htmlContent = getLikeEmailHtml(likerName, likerPhoto, isVisible);
  const textContent = isVisible 
    ? `${likerName} likes you on Pryvo! Open the app to like them back.`
    : `Someone new likes you on Pryvo! Open the app to find out who.`;
  
  return sendEmail({
    to: userEmail,
    subject: isVisible ? `💕 ${likerName} likes you!` : `💕 Someone new likes you!`,
    htmlContent,
    textContent,
  });
}

export default {
  sendMatchEmail,
  sendMessageEmail,
  sendLikeEmail,
};
