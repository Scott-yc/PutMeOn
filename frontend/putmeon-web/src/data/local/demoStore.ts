import { seed } from './fixtures';
import { removeExpiredPosts } from '../../domain/postExpiry';
import type { Database } from '../../domain/models';
const validCompany = (record: { companyName?: unknown }) =>
  record.companyName === undefined ||
  (typeof record.companyName === 'string' && record.companyName.length <= 120);
const KEY = 'putmeon.demo.v1';
export function readDatabase(): Database {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const value: unknown = JSON.parse(raw);
      if (
        typeof value === 'object' &&
        value !== null &&
        'profiles' in value &&
        'posts' in value &&
        Array.isArray(value.profiles) &&
        Array.isArray(value.posts)
      ) {
        const validProfiles = value.profiles.every(
          (p) =>
            p &&
            validCompany(p) &&
            ['id', 'email', 'name', 'phone', 'trade', 'location'].every(
              (k) => typeof p[k] === 'string',
            ),
        );
        const validPosts = value.posts.every(
          (p) =>
            p &&
            validCompany(p) &&
            ['id', 'ownerId', 'trade', 'location', 'from', 'to', 'description', 'createdAt'].every(
              (k) => typeof p[k] === 'string',
            ) &&
            ['looking', 'available'].includes(p.kind) &&
            Number.isFinite(p.rate) &&
            Array.isArray(p.interested) &&
            p.interested.every((id: unknown) => typeof id === 'string'),
        );
        if (validProfiles && validPosts) return removeExpiredPosts(value as Database);
      }
    }
  } catch {
    /* Unavailable or invalid storage starts a fresh demo. */
  }
  return seed();
}
export function saveDatabase(database: Database): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify(database));
    return true;
  } catch {
    return false;
  }
}
