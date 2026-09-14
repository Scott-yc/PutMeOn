import { Fragment, useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { Context } from './demoContext';
import type { ActionResult } from './demoContext';
import { apiRequest, ApiRequestError } from '../data/api/client';
import type { ApiSnapshot, PostFilters } from '../data/api/contracts';
import type { PostDraft, ProfileDraft } from '../domain/commands';
import type { Profile } from '../domain/models';
import { expiresAt } from '../domain/postExpiry';
const empty: ApiSnapshot = {
  email: '',
  user: null,
  profiles: [],
  posts: [],
  hasMore: false,
  page: 0,
};
const defaultFilters: PostFilters = { trade: '', location: '', kind: 'all' };

export function ApiProvider({ children }: { children: ReactNode }) {
  const location = useLocation();
  const [snapshot, setSnapshot] = useState<ApiSnapshot>(empty);
  const [loadedKey, setLoadedKey] = useState('');
  const [filters, setFilters] = useState(defaultFilters);
  const [busy, setBusy] = useState(false);
  const operation = useRef(false);
  const [error, setError] = useState('');
  const [now, setNow] = useState(Date.now);
  const postId = location.pathname.match(/^\/posts\/([^/]+)/)?.[1];
  const isFeed = location.pathname === '/home';
  const mode = location.pathname === '/my-posts' ? 'mine' : 'feed';
  const activeFilters = isFeed ? filters : defaultFilters;
  const query = new URLSearchParams({
    mode,
    ...activeFilters,
    ...(postId ? { postId } : {}),
  }).toString();
  const key = location.pathname + '?' + query;
  const activeKey = useRef(key);
  const requestVersion = useRef(0);
  const currentEmail = useRef('');
  useEffect(() => {
    activeKey.current = key;
  }, [key]);

  const refresh = useCallback(
    async (signal?: AbortSignal) => {
      const version = ++requestVersion.current;
      const result = await apiRequest<ApiSnapshot>(`/state?${query}`, { signal });
      if (signal?.aborted || activeKey.current !== key || version !== requestVersion.current)
        return;
      if (currentEmail.current !== result.email) setFilters(defaultFilters);
      currentEmail.current = result.email;
      setSnapshot(result);
      setLoadedKey(key);
      setError('');
      setNow(Date.now());
    },
    [key, query],
  );
  useEffect(() => {
    const controller = new AbortController();
    void refresh(controller.signal).catch((cause) => {
      if (!controller.signal.aborted) {
        setError(cause instanceof Error ? cause.message : 'Could not load data.');
        setLoadedKey(key);
      }
    });
    const focus = () => {
      if (!operation.current)
        void refresh(controller.signal).catch(() =>
          setError('Could not refresh. Please try again.'),
        );
    };
    window.addEventListener('focus', focus);
    return () => {
      controller.abort();
      window.removeEventListener('focus', focus);
    };
  }, [refresh, key]);
  useEffect(() => {
    const delay = Math.max(
      1,
      Math.min(
        60000,
        Math.min(...snapshot.posts.filter((p) => expiresAt(p) > now).map(expiresAt)) - now,
      ),
    );
    const timer = window.setTimeout(() => setNow(Date.now()), delay);
    return () => window.clearTimeout(timer);
  }, [snapshot.posts, now]);

  async function run(
    action: () => Promise<{ id?: string; developmentCode?: string } | void>,
    reload = true,
  ): Promise<ActionResult> {
    if (operation.current) return { ok: false, error: 'Please wait for the current request.' };
    operation.current = true;
    setBusy(true);
    try {
      const result = await action();
      if (reload) {
        try {
          await refresh();
        } catch {
          setError(
            'Your change was saved, but the latest data could not be loaded. Please refresh.',
          );
        }
      }
      return { ok: true, ...result };
    } catch (cause) {
      if (cause instanceof ApiRequestError && cause.status === 401) setSnapshot(empty);
      return {
        ok: false,
        error: cause instanceof Error ? cause.message : 'Request failed. Please try again.',
      };
    } finally {
      operation.current = false;
      setBusy(false);
    }
  }
  const database = {
    profiles: snapshot.profiles,
    posts: snapshot.posts.filter((post) => expiresAt(post) > now),
  };
  const actions = {
    requestCode: (email: string) =>
      run(
        () => apiRequest('/auth/code', { method: 'POST', body: JSON.stringify({ email }) }),
        false,
      ),
    verifyCode: (email: string, code: string) =>
      run(() =>
        apiRequest('/auth/verify', { method: 'POST', body: JSON.stringify({ email, code }) }),
      ),
    logout: async () => {
      const result = await run(() => apiRequest('/auth/logout', { method: 'POST' }));
      if (!result.ok) setError(result.error);
      else setFilters(defaultFilters);
    },
    saveProfile: (draft: ProfileDraft) =>
      run(() => apiRequest('/profile', { method: 'PUT', body: JSON.stringify(draft) })),
    savePost: (draft: PostDraft, id?: string) =>
      run(() =>
        apiRequest(id ? `/posts/${id}` : '/posts', {
          method: id ? 'PUT' : 'POST',
          body: JSON.stringify({
            ...draft,
            revision: id ? snapshot.posts.find((p) => p.id === id)?.revision : undefined,
          }),
        }),
      ),
    deletePost: (id: string) => run(() => apiRequest(`/posts/${id}`, { method: 'DELETE' })),
    applyToPost: (id: string) => run(() => apiRequest(`/posts/${id}/interest`, { method: 'POST' })),
    loadContact: (id: string, personId: string) =>
      run(async () => {
        const profile = await apiRequest<Profile>(`/posts/${id}/contacts/${personId}`);
        setSnapshot((current) => ({
          ...current,
          profiles: [...current.profiles.filter((p) => p.id !== personId), profile],
        }));
      }, false),
    searchPosts: setFilters,
    loadMore: async () => {
      const result = await run(async () => {
        const next = await apiRequest<ApiSnapshot>(`/state?${query}&page=${snapshot.page + 1}`);
        if (activeKey.current !== key) return;
        setSnapshot((current) => ({
          ...next,
          posts: [...new Map([...current.posts, ...next.posts].map((p) => [p.id, p])).values()],
          profiles: [
            ...new Map([...current.profiles, ...next.profiles].map((p) => [p.id, p])).values(),
          ],
        }));
      }, false);
      if (!result.ok) setError(result.error);
    },
  };
  if (loadedKey.split('?')[0] !== location.pathname)
    return (
      <main className="narrow">
        <p role="status">Loading PutMeOn…</p>
      </main>
    );
  if (error && !snapshot.email)
    return (
      <main className="narrow">
        <p role="alert">{error}</p>
        <button
          onClick={() =>
            void refresh().catch(() =>
              setError('Still unable to connect. Check that the API is running.'),
            )
          }
        >
          Try again
        </button>
      </main>
    );
  return (
    <Context.Provider
      value={{
        database,
        now,
        email: snapshot.email,
        user: snapshot.user ?? undefined,
        busy,
        hasMore: snapshot.hasMore,
        postFilters: filters,
        ...actions,
      }}
    >
      {error && (
        <p className="info" role="alert">
          {error}
          <button
            className="text-button"
            onClick={() =>
              void refresh().catch(() => setError('Could not refresh. Please try again.'))
            }
          >
            Refresh
          </button>
        </p>
      )}
      <Fragment key={snapshot.email}>{children}</Fragment>
    </Context.Provider>
  );
}
