import { createContext } from 'react';
import type { Database, Profile } from '../domain/models';
import type { PostDraft, ProfileDraft } from '../domain/commands';
import type { PostFilters } from '../data/api/contracts';
export type ActionResult =
  { ok: true; id?: string; developmentCode?: string } | { ok: false; error: string };
export type MaybeAsync<T> = T | Promise<T>;
interface State {
  database: Database;
  now: number;
  user: Profile | undefined;
  email: string;
  busy: boolean;
  hasMore: boolean;
  postFilters: PostFilters;
  requestCode: (email: string) => MaybeAsync<ActionResult>;
  verifyCode: (email: string, code: string) => MaybeAsync<ActionResult>;
  logout: () => MaybeAsync<void>;
  savePost: (draft: PostDraft, id?: string) => MaybeAsync<ActionResult>;
  deletePost: (id: string) => MaybeAsync<ActionResult>;
  applyToPost: (id: string) => MaybeAsync<ActionResult>;
  saveProfile: (draft: ProfileDraft) => MaybeAsync<ActionResult>;
  loadContact: (postId: string, personId: string) => MaybeAsync<ActionResult>;
  searchPosts: (filters: PostFilters) => void;
  loadMore: () => MaybeAsync<void>;
}
export const Context = createContext<State | null>(null);
