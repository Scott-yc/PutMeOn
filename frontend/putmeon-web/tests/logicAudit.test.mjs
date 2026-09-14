import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { moduleUrl } from './helpers/loadModule.mjs';
const { persistCommand } = await import(
  moduleUrl(fileURLToPath(new URL('../src/data/persistCommand.ts', import.meta.url)))
);
const { contactForPost } = await import(
  moduleUrl(fileURLToPath(new URL('../src/domain/contactAccess.ts', import.meta.url)))
);

test('failed persistence reports failure and keeps saved state unchanged', () => {
  const stored = { profiles: [], posts: [] };
  const repository = { load: () => stored, save: () => false };
  assert.throws(
    () => persistCommand(repository, (db) => ({ ...db, posts: [{ id: 'unsaved' }] })),
    /Could not save/,
  );
  assert.equal(stored.posts.length, 0);
});
test('sequential operations load latest records instead of stale render snapshots', () => {
  let stored = { profiles: [], posts: [] };
  const repository = {
    load: () => structuredClone(stored),
    save: (db) => {
      stored = structuredClone(db);
      return true;
    },
  };
  persistCommand(repository, (db) => ({ ...db, posts: [...db.posts, { id: 'first' }] }));
  persistCommand(repository, (db) => ({ ...db, posts: [...db.posts, { id: 'second' }] }));
  assert.deepEqual(
    stored.posts.map((post) => post.id),
    ['first', 'second'],
  );
});
test('contact access follows post type, ownership, application and expiry', () => {
  const now = Date.parse('2026-09-14T00:00:00Z');
  const db = {
    profiles: [
      { id: 'owner', name: 'Owner' },
      { id: 'applicant', name: 'Applicant' },
      { id: 'stranger' },
    ],
    posts: [
      {
        id: 'post',
        ownerId: 'owner',
        kind: 'looking',
        createdAt: new Date(now).toISOString(),
        interested: ['applicant'],
      },
    ],
  };
  assert.equal(contactForPost(db, 'post', 'owner', 'applicant', now)?.name, 'Applicant');
  assert.equal(contactForPost(db, 'post', 'stranger', 'applicant', now), undefined);
  assert.equal(contactForPost(db, 'post', 'applicant', 'owner', now), undefined);
  assert.equal(contactForPost(db, 'post', 'owner', 'applicant', now + 7 * 86400000), undefined);
  const available = {
    ...db,
    posts: [{ ...db.posts[0], kind: 'available', companyName: 'Post Company' }],
  };
  assert.equal(
    contactForPost(available, 'post', 'stranger', 'owner', now)?.companyName,
    'Post Company',
  );
  db.profiles[1].name = 'Updated Applicant';
  assert.equal(contactForPost(db, 'post', 'owner', 'applicant', now)?.name, 'Updated Applicant');
});
