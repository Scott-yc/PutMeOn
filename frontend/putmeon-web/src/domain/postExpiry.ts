import type { Database, Post } from './models';
export const POST_LIFETIME_MS = 7 * 24 * 60 * 60 * 1000;
export function expiresAt(post: Pick<Post, 'createdAt'>): number {
  const created = Date.parse(post.createdAt);
  return Number.isFinite(created) ? created + POST_LIFETIME_MS : 0;
}
export function daysRemaining(post: Pick<Post, 'createdAt'>, now = Date.now()): number {
  return Math.max(0, Math.ceil((expiresAt(post) - now) / 86400000));
}
export function removeExpiredPosts(database: Database, now = Date.now()): Database {
  return { ...database, posts: database.posts.filter((post) => expiresAt(post) > now) };
}
