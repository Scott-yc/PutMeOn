import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { moduleUrl } from './helpers/loadModule.mjs';
const commands = await import(
  moduleUrl(fileURLToPath(new URL('../src/domain/commands.ts', import.meta.url)))
);
const now = Date.parse('2026-09-14T03:00:00Z');
const draft = {
  kind: 'looking',
  trade: 'Carpenter',
  location: 'Brisbane',
  rate: 55,
  from: '2026-09-14',
  to: '2026-09-20',
  description: 'Framing work',
  companyName: '',
};
const person = {
  id: 'owner',
  email: 'owner@example.com',
  name: 'Owner',
  phone: '0400000000',
  trade: 'Carpenter',
  location: 'Brisbane',
};
const fixture = () =>
  commands.savePost(
    {
      profiles: [person, { ...person, id: 'applicant', email: 'applicant@example.com' }],
      posts: [],
    },
    draft,
    'owner',
    'post',
    now,
  );

test('editing preserves publication time and applications', () => {
  const db = commands.applyToPost(fixture(), 'post', 'applicant', now);
  const edited = commands.savePost(
    db,
    { ...draft, description: 'Updated' },
    'owner',
    'post',
    now + 3600000,
    true,
  );
  assert.equal(edited.posts[0].createdAt, db.posts[0].createdAt);
  assert.deepEqual(edited.posts[0].interested, ['applicant']);
  assert.equal(db.posts[0].description, 'Framing work');
});
test('non-owners cannot edit or delete posts', () => {
  assert.throws(
    () => commands.savePost(fixture(), draft, 'applicant', 'post', now, true),
    /Only the poster/,
  );
  assert.throws(() => commands.deletePost(fixture(), 'post', 'applicant', now), /Only the poster/);
});
test('duplicate applications are idempotent and self-application is rejected', () => {
  const db = commands.applyToPost(fixture(), 'post', 'applicant', now);
  assert.equal(commands.applyToPost(db, 'post', 'applicant', now), db);
  assert.throws(() => commands.applyToPost(db, 'post', 'owner', now), /cannot apply/);
});
test('viewing applications clears only the owned post unread count', () => {
  const db = commands.applyToPost(fixture(), 'post', 'applicant', now);
  const viewed = commands.markInterestsViewed(db, 'post', 'owner', now);
  assert.equal(viewed.posts[0].viewedInterestCount, 1);
  assert.throws(
    () => commands.markInterestsViewed(db, 'post', 'applicant', now),
    /Only the poster/,
  );
});
test('expired posts cannot be edited or applied to', () => {
  const expired = now + 7 * 86400000;
  assert.throws(() => commands.applyToPost(fixture(), 'post', 'applicant', expired), /expired/);
  assert.throws(
    () => commands.savePost(fixture(), draft, 'owner', 'post', expired, true),
    /expired/,
  );
});
test('domain validation rejects invalid payloads independently of HTML forms', () => {
  for (const patch of [
    { rate: NaN },
    { description: ' ' },
    { trade: 'unknown' },
    { to: '2026-09-01' },
    { companyName: 'x'.repeat(121) },
  ]) {
    assert.throws(() => commands.savePost(fixture(), { ...draft, ...patch }, 'owner', 'new', now));
  }
});
test('saving a profile retains its identity and supports an empty company', () => {
  const db = commands.saveProfile(
    fixture(),
    { ...person, companyName: '' },
    person.email,
    'different',
  );
  assert.equal(db.profiles.find((p) => p.email === person.email).id, 'owner');
});

test('invalid calendar dates are rejected, including non-leap February', () => {
  for (const date of ['2027-02-29', '2026-04-31', '2026-13-01']) {
    assert.throws(
      () => commands.savePost(fixture(), { ...draft, from: date, to: date }, 'owner', 'new', now),
      /valid work dates/,
    );
  }
});
test('changing post type cannot repurpose existing applications', () => {
  const db = commands.applyToPost(fixture(), 'post', 'applicant', now);
  assert.throws(
    () => commands.savePost(db, { ...draft, kind: 'available' }, 'owner', 'post', now, true),
    /already has applicants/,
  );
});
test('work end date uses Brisbane calendar at midnight boundary', () => {
  const midnight = Date.parse('2026-09-14T14:00:00Z');
  assert.throws(
    () => commands.savePost(fixture(), { ...draft, to: '2026-09-14' }, 'owner', 'new', midnight),
    /End date/,
  );
  assert.doesNotThrow(() =>
    commands.savePost(fixture(), { ...draft, to: '2026-09-14' }, 'owner', 'new', midnight - 1),
  );
});
