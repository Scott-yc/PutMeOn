import type { Database, Profile } from './models';
import { expiresAt } from './postExpiry';

export function contactForPost(
  database: Database,
  postId: string,
  viewerId: string,
  personId: string,
  now: number,
): Profile | undefined {
  const post = database.posts.find((item) => item.id === postId);
  if (
    !post ||
    expiresAt(post) <= now ||
    !database.profiles.some((person) => person.id === viewerId)
  )
    return undefined;
  const applicantContact = viewerId === post.ownerId && post.interested.includes(personId);
  const availableContact = post.kind === 'available' && personId === post.ownerId;
  if (!applicantContact && !availableContact) return undefined;
  const person = database.profiles.find((item) => item.id === personId);
  if (!person) return undefined;
  return availableContact ? { ...person, companyName: post.companyName } : person;
}
