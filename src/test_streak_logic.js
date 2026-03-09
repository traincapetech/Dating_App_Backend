/**
 * Streak Logic Verification Script
 * Tests all scenarios against the streak service directly (no HTTP needed).
 *
 * Run: node test_streak_logic.js
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config({path: '../.env'});

// ── We test the service through a thin wrapper that bypasses Match lookup ───

import Streak from './modules/streak/streak.model.js';

// Directly import the service but monkey-patch the Match.findOne so tests run
// without needing real match documents in the DB.
import Match from './models/Match.js';

const YELLOW = '\x1b[33m';
const GREEN = '\x1b[32m';
const RED = '\x1b[1;31m';
const RESET = '\x1b[0m';

let passed = 0;
let failed = 0;

function assert(label, condition) {
  if (condition) {
    console.log(`  ${GREEN}✓ PASS${RESET}  ${label}`);
    passed++;
  } else {
    console.log(`  ${RED}✗ FAIL${RESET}  ${label}`);
    failed++;
  }
}

async function cleanup(pairId) {
  await Streak.deleteMany({userPairId: pairId});
}

/**
 * Directly call streak service internals but inject a fake match
 * so we don't need actual Match documents.
 */
async function engage(service, fromUser, toUser, type) {
  // Temporarily patch Match.findOne to always return a fake match
  const orig = Match.findOne.bind(Match);
  Match.findOne = async () => ({_id: 'fake', users: [fromUser, toUser]});
  const result = await service.handleEngagement(fromUser, toUser, type);
  Match.findOne = orig;
  return result;
}

async function run() {
  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log('║         STREAK LOGIC VERIFICATION TESTS                 ║');
  console.log('╚══════════════════════════════════════════════════════════╝\n');

  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to MongoDB\n');

  const {default: service} = await import('./modules/streak/streak.service.js');

  // ── TEST 1: One-sided activity does NOT increment streak ─────────────────
  console.log(
    `${YELLOW}[TEST 1] One-sided activity must NOT increment streak${RESET}`,
  );
  const pair1 = 'user-a1_user-b1';
  await cleanup(pair1);
  await engage(service, 'user-a1', 'user-b1', 'chat');
  const s1 = await Streak.findOne({userPairId: pair1});
  assert('streakCount is still 0 after one-sided chat', s1.streakCount === 0);
  assert('participationA is true', s1.participationA === true);
  assert('participationB is false', s1.participationB === false);
  console.log();

  // ── TEST 2: Mutual chat increments streak to 1 ───────────────────────────
  console.log(`${YELLOW}[TEST 2] Mutual chat must set streak to 1${RESET}`);
  // (continuing from Test 1 — pair1 already has participationA=true)
  await engage(service, 'user-b1', 'user-a1', 'chat');
  const s2 = await Streak.findOne({userPairId: pair1});
  assert('streakCount is 1 after both users chat', s2.streakCount === 1);
  assert('participationA reset to false', s2.participationA === false);
  assert('participationB reset to false', s2.participationB === false);
  assert('lastMutualInteractionAt is set', !!s2.lastMutualInteractionAt);
  console.log();

  // ── TEST 3: Cross-activity mutual (A likes, B comments) ──────────────────
  console.log(
    `${YELLOW}[TEST 3] Cross-activity (like + comment) → streak increments${RESET}`,
  );
  const pair2 = 'user-c1_user-d1';
  await cleanup(pair2);
  await engage(service, 'user-c1', 'user-d1', 'like');
  await engage(service, 'user-d1', 'user-c1', 'comment');
  const s3 = await Streak.findOne({userPairId: pair2});
  assert(
    'streakCount is 1 after like+comment cross-activity',
    s3.streakCount === 1,
  );
  console.log();

  // ── TEST 4: Multiple messages from same user within cycle do NOT double-count
  console.log(
    `${YELLOW}[TEST 4] Multiple actions from same user in one cycle only count once${RESET}`,
  );
  const pair3 = 'user-e1_user-f1';
  await cleanup(pair3);
  await engage(service, 'user-e1', 'user-f1', 'chat');
  await engage(service, 'user-e1', 'user-f1', 'chat'); // same user again
  await engage(service, 'user-e1', 'user-f1', 'like'); // another type, still same user
  const s4a = await Streak.findOne({userPairId: pair3});
  assert('streakCount still 0 — only user-e1 acted', s4a.streakCount === 0);
  await engage(service, 'user-f1', 'user-e1', 'chat'); // now user-f1 acts
  const s4b = await Streak.findOne({userPairId: pair3});
  assert('streakCount is 1 after user-f1 finally acts', s4b.streakCount === 1);
  console.log();

  // ── TEST 5: Second round of mutual interaction increments to 2 ───────────
  console.log(
    `${YELLOW}[TEST 5] Second mutual round → streak becomes 2${RESET}`,
  );
  // (continuing from Test 2 pair1, streak=1, participation flags cleared)
  await engage(service, 'user-a1', 'user-b1', 'chat');
  await engage(service, 'user-b1', 'user-a1', 'chat');
  const s5 = await Streak.findOne({userPairId: pair1});
  assert(
    'streakCount incremented to 2 on second mutual day',
    s5.streakCount === 2,
  );
  console.log();

  // ── TEST 6: Expiry — 24h+ of inactivity resets streak to 0 ──────────────
  console.log(
    `${YELLOW}[TEST 6] After 24h+ inactivity, streak resets to 0 on next interaction${RESET}`,
  );
  const pair4 = 'user-g1_user-h1';
  await cleanup(pair4);
  // Manually create a streak with a "stale" lastMutualInteractionAt
  const staleDate = new Date(Date.now() - 25 * 60 * 60 * 1000); // 25h ago
  await Streak.create({
    userPairId: pair4,
    userA: 'user-g1',
    userB: 'user-h1',
    streakCount: 5,
    lastMutualInteractionAt: staleDate,
    participationA: false,
    participationB: false,
  });
  // Now user-g1 acts — this should detect expiry and reset before recording
  await engage(service, 'user-g1', 'user-h1', 'chat');
  const s6a = await Streak.findOne({userPairId: pair4});
  assert(
    'After g1 acts: streakCount is 0 (reset happened)',
    s6a.streakCount === 0,
  );
  assert(
    'participationA is true (new cycle started)',
    s6a.participationA === true,
  );
  // Now h1 responds — should start streak at 1
  await engage(service, 'user-h1', 'user-g1', 'chat');
  const s6b = await Streak.findOne({userPairId: pair4});
  assert(
    'After h1 also acts: streakCount is 1 (new streak starts from 1)',
    s6b.streakCount === 1,
  );
  assert('Previous count of 5 was NOT retained', s6b.streakCount !== 5);
  console.log();

  // ── TEST 7: isExpired helper ─────────────────────────────────────────────
  console.log(`${YELLOW}[TEST 7] isExpired() helper correctness${RESET}`);
  assert('isExpired(null) is true', service.isExpired(null));
  assert(
    'isExpired({streakCount:0}) true',
    service.isExpired({streakCount: 0}),
  );
  const fresh = {streakCount: 3, lastMutualInteractionAt: new Date()};
  assert('isExpired(fresh streak) is false', !service.isExpired(fresh));
  const old = {streakCount: 3, lastMutualInteractionAt: staleDate};
  assert('isExpired(25h old streak) is true', service.isExpired(old));
  console.log();

  // ── Cleanup ──────────────────────────────────────────────────────────────
  await cleanup(pair1);
  await cleanup(pair2);
  await cleanup(pair3);
  await cleanup(pair4);

  // ── Summary ──────────────────────────────────────────────────────────────
  console.log('══════════════════════════════════════════════════════════');
  console.log(
    `  Results: ${GREEN}${passed} passed${RESET}  ${
      failed > 0 ? RED : ''
    }${failed} failed${RESET}`,
  );
  console.log('══════════════════════════════════════════════════════════\n');

  process.exit(failed > 0 ? 1 : 0);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
