import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { moduleUrl } from './helpers/loadModule.mjs';
const { readDatabase, saveDatabase } = await import(
  moduleUrl(fileURLToPath(new URL('../src/data/local/demoStore.ts', import.meta.url)))
);
const { daysRemaining, expiresAt, removeExpiredPosts } = await import(
  moduleUrl(fileURLToPath(new URL('../src/domain/postExpiry.ts', import.meta.url)))
);
let stored = null;
Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: {
    getItem: () => stored,
    setItem: (_key, value) => {
      stored = value;
    },
  },
});
test('fresh demo has usable posts and owners', () => {
  const db = readDatabase();
  assert.equal(db.posts.length, 2);
  for (const post of db.posts) {
    assert.ok(db.profiles.some((p) => p.id === post.ownerId));
    assert.ok(daysRemaining(post) > 0);
  }
});
test('saved profiles and applications survive reloading', () => {
  const db = readDatabase();
  db.posts[0].interested.push('applicant');
  assert.equal(saveDatabase(db), true);
  assert.deepEqual(readDatabase(), db);
});
test('corrupt storage recovers to a usable demo', () => {
  for (const value of ['{bad', '{"profiles":[null],"posts":[]}', '{"profiles":[],"posts":[{}]}']) {
    stored = value;
    assert.equal(readDatabase().posts.length, 2);
  }
});
test('expiry is exactly 168 hours after publishing, independent of work dates', () => {
  const post = { createdAt: '2026-09-14T03:15:00.000Z', to: '2026-09-18' };
  const end = Date.parse('2026-09-21T03:15:00.000Z');
  assert.equal(expiresAt(post), end);
  assert.equal(daysRemaining(post, Date.parse(post.createdAt)), 7);
  assert.equal(daysRemaining(post, end - 1), 1);
  assert.equal(daysRemaining(post, end), 0);
  assert.equal(expiresAt({ ...post, to: '2027-01-01' }), end);
});
test('cleanup removes expired posts and embedded applications but retains profiles', () => {
  const now = Date.parse('2026-09-21T03:15:00.000Z');
  const db = {
    profiles: [{ id: 'owner' }],
    posts: [
      { id: 'expired', createdAt: '2026-09-14T03:15:00.000Z', interested: ['applicant'] },
      { id: 'live', createdAt: '2026-09-14T03:15:00.001Z', interested: [] },
    ],
  };
  const cleaned = removeExpiredPosts(db, now);
  assert.deepEqual(
    cleaned.posts.map((p) => p.id),
    ['live'],
  );
  assert.deepEqual(cleaned.profiles, db.profiles);
  assert.equal(db.posts.length, 2);
});
test('expired persisted posts are not restored on reload', () => {
  stored = JSON.stringify({
    profiles: [],
    posts: [
      {
        id: 'old',
        ownerId: 'owner',
        kind: 'looking',
        trade: 'Carpenter',
        location: 'Brisbane',
        rate: 50,
        from: '2000-01-01',
        to: '2099-01-01',
        description: 'old',
        createdAt: '2000-01-01T00:00:00Z',
        interested: ['applicant'],
      },
    ],
  });
  assert.equal(readDatabase().posts.length, 0);
});
test('blocked storage reports failure instead of crashing', () => {
  Object.defineProperty(globalThis, 'localStorage', {
    value: {
      getItem() {
        throw Error('blocked');
      },
      setItem() {
        throw Error('quota');
      },
    },
  });
  assert.equal(saveDatabase(readDatabase()), false);
});
