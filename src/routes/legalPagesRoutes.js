import {Router} from 'express';
import bcrypt from 'bcryptjs';
import {findUserByEmail} from '../models/userModel.js';
import {performThoroughAccountDeletion} from '../services/accountDeletionService.js';
import {authLimiter} from '../middlewares/rateLimiter.js';

const router = Router();

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
    input { width: 100%; padding: 10px; margin-top: 6px; border: 1px solid #ccc; border-radius: 8px; box-sizing: border-box; }
    button { margin-top: 20px; background: #dc2626; color: #fff; border: none; padding: 12px 20px; border-radius: 8px; font-weight: 600; cursor: pointer; }
    .msg { padding: 12px 16px; border-radius: 8px; margin-top: 16px; }
    .ok { background: #ecfdf5; color: #065f46; border: 1px solid #a7f3d0; }
    .err { background: #fef2f2; color: #991b1b; border: 1px solid #fecaca; }
  </style>
</head>
<body>${body}</body>
</html>`;

router.get('/delete-account', (_req, res) => {
  res.type('html').send(
    pageShell(
      'Delete Account',
      `<h1>Pryvo — Account &amp; Data Deletion</h1>
      <p>You can permanently delete your Pryvo account and all associated personal data (profile, photos, matches, messages, likes, blocks, notifications, and wallet records) directly below or inside the Pryvo app under <strong>Settings &rarr; Delete Account</strong>.</p>
      <div class="card">
        <form method="POST" action="/delete-account">
          <label for="email">Account Email</label>
          <input id="email" name="email" type="email" required placeholder="you@example.com" />
          <label for="password">Account Password (for email/password accounts)</label>
          <input id="password" name="password" type="password" placeholder="Enter your password" />
          <p style="font-size: 13px; color: #555;">Signed up with Google? Delete directly in-app or email <a href="mailto:pryvo@traincapetech.in">pryvo@traincapetech.in</a> from your registered Google email.</p>
          <button type="submit">Permanently Delete My Account</button>
        </form>
      </div>`,
    ),
  );
});

router.post('/delete-account', authLimiter, async (req, res) => {
  try {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const password = String(req.body?.password || '');

    if (!email) {
      return res.status(400).type('html').send(
        pageShell('Delete Account', '<h1>Delete Account</h1><div class="msg err">Please provide your account email.</div><p><a href="/delete-account">Go back</a></p>'),
      );
    }

    const user = await findUserByEmail(email);
    if (!user) {
      return res.status(404).type('html').send(
        pageShell('Delete Account', '<h1>Delete Account</h1><div class="msg err">Account not found.</div><p><a href="/delete-account">Go back</a></p>'),
      );
    }

    if (user.authProvider === 'google') {
      return res.status(400).type('html').send(
        pageShell('Delete Account', '<h1>Delete Account</h1><div class="msg err">This account uses Google Sign-In. Please delete it inside the Pryvo app (Settings &rarr; Delete Account) or email pryvo@traincapetech.in from your registered Google email.</div>'),
      );
    }

    const isMatch = password && user.password ? await bcrypt.compare(password, user.password) : false;
    if (!isMatch) {
      return res.status(401).type('html').send(
        pageShell('Delete Account', '<h1>Delete Account</h1><div class="msg err">Incorrect password.</div><p><a href="/delete-account">Go back</a></p>'),
      );
    }

    await performThoroughAccountDeletion(user.id || user._id);

    return res.status(200).type('html').send(
      pageShell('Account Deleted', '<h1>Account Permanently Deleted</h1><div class="msg ok">Your Pryvo account and all associated personal data have been permanently deleted.</div>'),
    );
  } catch (error) {
    return res.status(500).type('html').send(
      pageShell('Delete Account', '<h1>Delete Account</h1><div class="msg err">An error occurred while deleting your account. Please contact pryvo@traincapetech.in.</div>'),
    );
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
