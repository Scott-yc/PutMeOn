import { apiRequest } from './client';
import type { ApiSnapshot } from './contracts';
import type { Profile } from '../../domain/models';
import type { PostDraft, ProfileDraft } from '../../domain/commands';

// Transport details stay here; state decides when requests run and how results are applied.
export const applicationApi = {
  snapshot: (query: string, page = 0, signal?: AbortSignal) =>
    apiRequest<ApiSnapshot>(`/state?${query}&page=${page}`, { signal }),
  requestCode: (email: string) =>
    apiRequest<{ developmentCode?: string }>('/auth/code', {
      method: 'POST',
      body: JSON.stringify({ email }),
    }),
  verifyCode: (email: string, code: string) =>
    apiRequest<void>('/auth/verify', { method: 'POST', body: JSON.stringify({ email, code }) }),
  logout: () => apiRequest<void>('/auth/logout', { method: 'POST' }),
  saveProfile: (draft: ProfileDraft) =>
    apiRequest<void>('/profile', { method: 'PUT', body: JSON.stringify(draft) }),
  savePost: (draft: PostDraft, id?: string, revision?: number) =>
    apiRequest<{ id: string }>(id ? `/posts/${encodeURIComponent(id)}` : '/posts', {
      method: id ? 'PUT' : 'POST',
      body: JSON.stringify({ ...draft, revision }),
    }),
  deletePost: (id: string) =>
    apiRequest<void>(`/posts/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  applyToPost: (id: string) =>
    apiRequest<void>(`/posts/${encodeURIComponent(id)}/interest`, { method: 'POST' }),
  markInterestsViewed: (id: string, applicantIds: string[]) =>
    apiRequest<void>(`/posts/${encodeURIComponent(id)}/interests/viewed`, {
      method: 'POST',
      body: JSON.stringify({ applicantIds }),
    }),
  contact: (id: string, personId: string) =>
    apiRequest<Profile>(
      `/posts/${encodeURIComponent(id)}/contacts/${encodeURIComponent(personId)}`,
    ),
};
