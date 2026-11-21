import {Router} from 'express';
import {randomInt} from 'crypto';
import {findUserByEmail} from '../models/userModel.js';
import {createOTP, verifyOTP, deleteOTP} from '../models/otpModel.js';
import {sendEmail} from '../services/emailService.js';
import {performThoroughAccountDeletion} from '../services/accountDeletionService.js';
import {authLimiter} from '../middlewares/rateLimiter.js';

const router = Router();

const escapeHtml = str =>
  String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const pageShell = (title, body) => `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title} - Pryvo</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; max-width: 720px; margin: 40px auto; padding: 0 20px; color: #1a1a1a; line-height: 1.6; }
    h1 { color: #7c3aed; }
    .card { background: #f9f7ff; border: 1px solid #e5dcff; border-radius: 12px; padding: 24px; margin-top: 20px; }
    label { display: block; font-weight: 600; margin-top: 14px; }
    input { width: 100%; padding: 10px; margin-top: 6px; border: 1px solid #ccc; border-radius: 8px; box-sizing: border-box; font-size: 15px; }
    button { margin-top: 20px; background: #dc2626; color: #fff; border: none; padding: 12px 20px; border-radius: 8px; font-weight: 600; cursor: pointer; font-size: 15px; }
    button.primary { background: #7c3aed; }
    .msg { padding: 12px 16px; border-radius: 8px; margin-top: 16px; }
    .ok { background: #ecfdf5; color: #065f46; border: 1px solid #a7f3d0; }
    .err { background: #fef2f2; color: #991b1b; border: 1px solid #fecaca; }
  </style>
</head>
<body>${body}</body>
</html>`;

const deletionOverviewHtml = `<h1>Pryvo — Account &amp; Data Deletion</h1>
<p><strong>App:</strong> Pryvo &nbsp;|&nbsp; <strong>Developer:</strong> Traincape Technologies Pvt Ltd</p>
<p>You can permanently delete your Pryvo account (whether you signed up with Email or Google Sign-In) and all associated personal data at any time using either method below.</p>
<h2>Steps to Delete Your Account</h2>
<ol>
  <li><strong>In the Pryvo App:</strong> Open Pryvo &rarr; tap <strong>Settings</strong> &rarr; tap <strong>Delete Account</strong> &rarr; confirm deletion.</li>
  <li><strong>On the Web (below — works for Email &amp; Google Sign-In accounts):</strong> Enter your registered email address below to receive a 6-digit verification code, then enter the code to permanently delete your account immediately.</li>
</ol>
<h2>Data Deleted vs. Retained</h2>
<ul>
  <li><strong>Permanently Deleted (0-day retention — removed immediately upon confirmation):</strong> Account credentials, email address, phone number, date of birth, profile details, uploaded photos/media, location coordinates, swipes/likes/passes, matches, chat messages, blocks, reports submitted, device push tokens, and notifications.</li>
  <li><strong>Retained Data &amp; Retention Period:</strong> We do <strong>not</strong> retain personal profile, photo, or chat data after account deletion. Only if an account was banned for severe safety violations (such as fraud or CSAE) may minimal abuse-prevention identifiers be retained strictly as required by law and safety compliance.</li>
</ul>`;

const renderConfirmOtpForm = (email, noticeHtml = '') =>
  pageShell(
    'Confirm Account Deletion',
    `<h1>Confirm Pryvo Account Deletion</h1>
    <p><strong>App:</strong> Pryvo &nbsp;|&nbsp; <strong>Developer:</strong> Traincape Technologies Pvt Ltd</p>
    ${noticeHtml}
    <div class="card">
      <form method="POST" action="/delete-account/confirm">
        <label for="email">Registered Account Email</label>
        <input id="email" name="email" type="email" required readonly value="${escapeHtml(email)}" />
        <label for="otp">6-Digit Verification Code</label>
        <input id="otp" name="otp" type="text" inputmode="numeric" pattern="[0-9]{6}" maxlength="6" required placeholder="Enter 6-digit code from your email" />
        <p style="font-size: 13px; color: #991b1b; margin-top: 12px;">Warning: This action is permanent and immediately deletes your account, photos, matches, and messages.</p>
        <button type="submit">Permanently Delete My Account</button>
      </form>
    </div>
    <p style="margin-top: 16px;"><a href="/delete-account">&larr; Start over</a> &nbsp;|&nbsp; Need help? <a href="mailto:pryvo@traincapetech.in">pryvo@traincapetech.in</a></p>`,
  );

router.get('/delete-account', (_req, res) => {
  res.type('html').send(
    pageShell(
      'Delete Account',
      `${deletionOverviewHtml}
      <div class="card">
        <form method="POST" action="/delete-account/send-otp">
          <label for="email">Registered Account Email (Email or Google Sign-In)</label>
          <input id="email" name="email" type="email" required placeholder="you@example.com" />
          <p style="font-size: 13px; color: #555;">We will email a 6-digit verification code to confirm you own this account. Works for both Email/Password and Google Sign-In accounts.</p>
          <button type="submit" class="primary">Send Deletion Verification Code</button>
        </form>
      </div>
      <p style="font-size: 13px; color: #555; margin-top: 16px;">Need assistance? Email <a href="mailto:pryvo@traincapetech.in">pryvo@traincapetech.in</a>.</p>`,
    ),
  );
});

router.post('/delete-account/send-otp', authLimiter, async (req, res) => {
  try {
    const email = String(req.body?.email || '').trim().toLowerCase();
    if (!email) {
      return res.status(400).type('html').send(
        pageShell('Delete Account', '<h1>Delete Account</h1><div class="msg err">Please provide your registered account email.</div><p><a href="/delete-account">Go back</a></p>'),
      );
    }

    const user = await findUserByEmail(email);
    if (!user) {
      return res.status(404).type('html').send(
        pageShell('Delete Account', '<h1>Delete Account</h1><div class="msg err">No Pryvo account was found with that email address.</div><p><a href="/delete-account">Go back</a></p>'),
      );
    }

    const code = randomInt(100000, 1000000).toString();
    await createOTP(email, code, 'delete_account');
    await sendEmail({
      to: email,
      subject: 'Pryvo Account Deletion Verification Code',
      text: `Your Pryvo account deletion verification code is: ${code}. This code expires in 10 minutes. If you did not request this, you can safely ignore this email.`,
      html: `<div style="font-family: sans-serif; max-width: 520px; margin: 0 auto;">
        <h2 style="color: #7c3aed;">Pryvo Account Deletion Request</h2>
        <p>Use the 6-digit verification code below to permanently delete your Pryvo account and all associated data:</p>
        <div style="font-size: 32px; font-weight: 700; letter-spacing: 6px; padding: 16px; background: #f9f7ff; border-radius: 8px; text-align: center; color: #1a1a1a;">${code}</div>
        <p style="color: #555; font-size: 14px; margin-top: 16px;">This code expires in 10 minutes. If you did not request account deletion, please ignore this email.</p>
      </div>`,
    });

    return res.status(200).type('html').send(
      renderConfirmOtpForm(
        email,
        `<div class="msg ok">A 6-digit verification code has been sent to <strong>${escapeHtml(email)}</strong>. Please check your inbox (and spam folder).</div>`,
      ),
    );
  } catch (error) {
    console.error('[Delete Account Web] Failed to send OTP:', error?.message);
    return res.status(500).type('html').send(
      pageShell('Delete Account', '<h1>Delete Account</h1><div class="msg err">Could not send verification email right now. Please try again or contact <a href="mailto:pryvo@traincapetech.in">pryvo@traincapetech.in</a>.</div><p><a href="/delete-account">Go back</a></p>'),
    );
  }
});

router.post('/delete-account/confirm', authLimiter, async (req, res) => {
  try {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const otp = String(req.body?.otp || '').trim();

    if (!email || !otp) {
      return res.status(400).type('html').send(
        renderConfirmOtpForm(email, '<div class="msg err">Please enter both your email and the 6-digit verification code.</div>'),
      );
    }

    const user = await findUserByEmail(email);
    if (!user) {
      return res.status(404).type('html').send(
        pageShell('Delete Account', '<h1>Delete Account</h1><div class="msg err">Account not found or already deleted.</div><p><a href="/delete-account">Go back</a></p>'),
      );
    }

    const verification = await verifyOTP(email, otp, 'delete_account');
    if (!verification.valid) {
      return res.status(400).type('html').send(
        renderConfirmOtpForm(email, `<div class="msg err">${escapeHtml(verification.message || 'Invalid or expired verification code.')}</div>`),
      );
    }

    await performThoroughAccountDeletion(user.id || user._id);
    await deleteOTP(email, 'delete_account').catch(() => {});

    return res.status(200).type('html').send(
      pageShell('Account Deleted', '<h1>Account Permanently Deleted</h1><div class="msg ok">Your Pryvo account and all associated personal data have been permanently deleted.</div>'),
    );
  } catch (error) {
    console.error('[Delete Account Web] Failed to confirm deletion:', error?.message);
    return res.status(500).type('html').send(
      pageShell('Delete Account', '<h1>Delete Account</h1><div class="msg err">An error occurred while deleting your account. Please contact <a href="mailto:pryvo@traincapetech.in">pryvo@traincapetech.in</a>.</div>'),
    );
  }
});

router.post('/delete-account', (_req, res) => {
  res.redirect(303, '/delete-account');
});

// JSON API endpoints for the branded Pryvo website (https://pryvo.traincapetech.in/delete-account)
router.post('/api/public/delete-account/send-otp', authLimiter, async (req, res) => {
  try {
    const email = String(req.body?.email || '').trim().toLowerCase();
    if (!email) {
      return res.status(400).json({success: false, message: 'Please provide your registered account email.'});
    }

    const user = await findUserByEmail(email);
    if (!user) {
      return res.status(404).json({success: false, message: 'No Pryvo account was found with that email address.'});
    }

    const code = randomInt(100000, 1000000).toString();
    await createOTP(email, code, 'delete_account');
    await sendEmail({
      to: email,
      subject: 'Pryvo Account Deletion Verification Code',
      text: `Your Pryvo account deletion verification code is: ${code}. This code expires in 10 minutes. If you did not request this, you can safely ignore this email.`,
      html: `<div style="font-family: sans-serif; max-width: 520px; margin: 0 auto;">
        <h2 style="color: #880000;">Pryvo Account Deletion Request</h2>
        <p>Use the 6-digit verification code below to permanently delete your Pryvo account and all associated data:</p>
        <div style="font-size: 32px; font-weight: 700; letter-spacing: 6px; padding: 16px; background: #fdf2f8; border-radius: 8px; text-align: center; color: #1a1a1a;">${code}</div>
        <p style="color: #555; font-size: 14px; margin-top: 16px;">This code expires in 10 minutes. If you did not request account deletion, please ignore this email.</p>
      </div>`,
    });

    return res.status(200).json({
      success: true,
      message: `A 6-digit verification code has been sent to ${email}.`,
    });
  } catch (error) {
    console.error('[Delete Account API] Failed to send OTP:', error?.message);
    return res.status(500).json({
      success: false,
      message: 'Could not send verification email right now. Please try again or email pryvo@traincapetech.in.',
    });
  }
});

router.post('/api/public/delete-account/confirm', authLimiter, async (req, res) => {
  try {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const otp = String(req.body?.otp || '').trim();

    if (!email || !otp) {
      return res.status(400).json({success: false, message: 'Please enter both your email and the 6-digit verification code.'});
    }

    const user = await findUserByEmail(email);
    if (!user) {
      return res.status(404).json({success: false, message: 'Account not found or already deleted.'});
    }

    const verification = await verifyOTP(email, otp, 'delete_account');
    if (!verification.valid) {
      return res.status(400).json({success: false, message: verification.message || 'Invalid or expired verification code.'});
    }

    await performThoroughAccountDeletion(user.id || user._id);
    await deleteOTP(email, 'delete_account').catch(() => {});

    return res.status(200).json({
      success: true,
      message: 'Your Pryvo account and all associated personal data have been permanently deleted.',
    });
  } catch (error) {
    console.error('[Delete Account API] Failed to confirm deletion:', error?.message);
    return res.status(500).json({
      success: false,
      message: 'An error occurred while deleting your account. Please email pryvo@traincapetech.in.',
    });
  }
});

router.get('/privacy-policy', (_req, res) => {
  res.type('html').send(
    pageShell(
      'Privacy Policy',
      `<h1>Pryvo Privacy Policy</h1>
      <p><strong>Effective Date:</strong> November 20, 2026</p>
      <p>Pryvo collects only the information necessary to provide our 18+ dating service: account info (name, email, phone, date of birth), profile details and photos, approximate/precise location (when permitted), messages, and device push/crash tokens. Pryvo does not process payments or collect financial information in this version.</p>
      <h2>Third-Party Services</h2>
      <ul>
        <li><strong>Firebase Cloud Messaging &amp; Crashlytics</strong> for push notifications and crash diagnostics.</li>
        <li><strong>Google Sign-In &amp; Google Places</strong> for optional authentication and city selection.</li>
        <li><strong>Cloudflare R2</strong> for media storage.</li>
        <li><strong>Azure AI Content Safety</strong> for automated image safety moderation.</li>
        <li><strong>Brevo</strong> for transactional verification emails (signup &amp; account deletion OTPs).</li>
      </ul>
      <h2>Your Rights &amp; Data Deletion</h2>
      <p>You can permanently delete your account and all data at any time in-app (Settings &rarr; Delete Account) or on the web at <a href="/delete-account">/delete-account</a>.</p>
      <p>Contact: <a href="mailto:pryvo@traincapetech.in">pryvo@traincapetech.in</a></p>`,
    ),
  );
});

router.get('/terms', (_req, res) => {
  res.type('html').send(
    pageShell(
      'Terms of Service',
      `<h1>Pryvo Terms of Service</h1>
      <p><strong>Effective Date:</strong> November 20, 2026</p>
      <p>You must be at least <strong>18 years old</strong> to create an account or use Pryvo. Harassment, hate speech, spam, impersonation, non-consensual sexual content, and any form of Child Sexual Abuse and Exploitation (CSAE) are strictly prohibited and result in immediate permanent ban.</p>
      <p>Pryvo is currently provided free of charge with no in-app purchases or subscriptions.</p>
      <p>Contact: <a href="mailto:pryvo@traincapetech.in">pryvo@traincapetech.in</a></p>`,
    ),
  );
});

router.get('/child-safety', (_req, res) => {
  res.type('html').send(
    pageShell(
      'Child Safety Standards',
      `<h1>Pryvo Child Safety &amp; CSAE Prevention Standards</h1>
      <p><strong>Effective Date:</strong> November 20, 2026</p>
      <p>Pryvo is strictly an <strong>18+ dating platform</strong> and maintains zero tolerance for Child Sexual Abuse Material (CSAM) or Child Sexual Exploitation and Abuse (CSAE).</p>
      <ul>
        <li><strong>Age Gating:</strong> Date of birth (&ge; 18) is enforced both in-app and server-side on account/profile creation and updates.</li>
        <li><strong>In-App Reporting:</strong> Users can report suspected underage accounts or CSAE/CSAM directly from any profile or chat screen.</li>
        <li><strong>Moderation &amp; Escalation:</strong> Flagged content and CSAE reports are immediately escalated for account suspension, evidence preservation, and reporting to relevant authorities (including NCMEC where applicable).</li>
      </ul>
      <p>Child Safety Point of Contact: <a href="mailto:pryvo@traincapetech.in">pryvo@traincapetech.in</a></p>`,
    ),
  );
});

export default router;
