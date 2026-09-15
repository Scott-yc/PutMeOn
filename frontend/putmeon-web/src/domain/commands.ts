import { isCalendarDate, brisbaneDate } from './workDates';
import type { Database, Post, Profile } from './models';
import { trades } from './trades';
import { expiresAt } from './postExpiry';

export type PostDraft = Pick<
  Post,
  'kind' | 'companyName' | 'trade' | 'location' | 'rate' | 'from' | 'to' | 'description'
>;
export type ProfileDraft = Pick<Profile, 'name' | 'companyName' | 'phone' | 'trade' | 'location'>;

function validateText(value: string, label: string, max: number): void {
  if (!value.trim() || value.length > max)
    throw new Error(`${label} is required and must be at most ${max} characters.`);
}
function validateCommon(value: { trade: string; location: string; companyName?: string }): void {
  if (!trades.some((trade) => trade === value.trade)) throw new Error('Choose a valid trade.');
  validateText(value.location, 'Location', 80);
  if ((value.companyName?.length ?? 0) > 120)
    throw new Error('Company name must be at most 120 characters.');
}
function requireOwner(database: Database, id: string, actorId: string, now: number): Post {
  const post = database.posts.find((item) => item.id === id);
  if (!post || expiresAt(post) <= now) throw new Error('This post has expired or is unavailable.');
  if (post.ownerId !== actorId) throw new Error('Only the poster can change this post.');
  return post;
}

export function savePost(
  database: Database,
  draft: PostDraft,
  actorId: string,
  id: string,
  now: number,
  editing = false,
): Database {
  if (!database.profiles.some((profile) => profile.id === actorId))
    throw new Error('Complete your profile first.');
  const existing = editing ? requireOwner(database, id, actorId, now) : undefined;
  if (!editing && database.posts.some((post) => post.id === id))
    throw new Error('Post already exists.');
  validateCommon(draft);
  validateText(draft.description, 'Description', 500);
  if (!['looking', 'available'].includes(draft.kind)) throw new Error('Choose a valid post type.');
  if (!Number.isFinite(draft.rate) || draft.rate < 1 || draft.rate > 10000)
    throw new Error('Enter an hourly rate between $1 and $10,000.');
  if (![draft.from, draft.to].every(isCalendarDate)) throw new Error('Enter valid work dates.');
  if (draft.to < draft.from || draft.to < brisbaneDate(now))
    throw new Error('End date must be today or later and on or after start date.');
  if (existing && existing.kind !== draft.kind && existing.interested.length > 0)
    throw new Error(
      'This post already has applicants. Keep its post type or create a separate post.',
    );
  const post: Post = {
    ...draft,
    id,
    ownerId: actorId,
    createdAt: existing?.createdAt ?? new Date(now).toISOString(),
    interested: existing?.interested ?? [],
  };
  return { ...database, posts: [post, ...database.posts.filter((item) => item.id !== id)] };
}

export function deletePost(database: Database, id: string, actorId: string, now: number): Database {
  requireOwner(database, id, actorId, now);
  return { ...database, posts: database.posts.filter((post) => post.id !== id) };
}

export function applyToPost(
  database: Database,
  id: string,
  actorId: string,
  now: number,
): Database {
  const post = database.posts.find((item) => item.id === id);
  if (!post || expiresAt(post) <= now) throw new Error('This post has expired or is unavailable.');
  if (post.kind !== 'looking' || post.ownerId === actorId)
    throw new Error('You cannot apply to this post.');
  if (!database.profiles.some((profile) => profile.id === actorId))
    throw new Error('Complete your profile first.');
  if (post.interested.includes(actorId)) return database;
  return {
    ...database,
    posts: database.posts.map((item) =>
      item.id === id ? { ...item, interested: [...item.interested, actorId] } : item,
    ),
  };
}

export function markInterestsViewed(
  database: Database,
  id: string,
  actorId: string,
  now: number,
): Database {
  const post = requireOwner(database, id, actorId, now);
  if (post.kind !== 'looking') return database;
  if ((post.viewedInterestCount ?? 0) === post.interested.length) return database;
  return {
    ...database,
    posts: database.posts.map((item) =>
      item.id === id ? { ...item, viewedInterestCount: item.interested.length } : item,
    ),
  };
}

export function saveProfile(
  database: Database,
  draft: ProfileDraft,
  email: string,
  newId: string,
): Database {
  if (!email) throw new Error('Sign in first.');
  validateCommon(draft);
  validateText(draft.name, 'Name', 80);
  if (!/^[+0-9 ()-]{8,20}$/.test(draft.phone) || draft.phone.replace(/\D/g, '').length < 8)
    throw new Error('Enter a valid phone number.');
  const existing = database.profiles.find((profile) => profile.email === email);
  const profile: Profile = { ...draft, id: existing?.id ?? newId, email };
  return {
    ...database,
    profiles: [...database.profiles.filter((item) => item.id !== profile.id), profile],
  };
}
