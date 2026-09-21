import { useCallback, useEffect, useRef, useState } from 'react';
import type { ActionResult } from './appContext';
import { ApiRequestError } from '../data/api/client';
import { applicationApi } from '../data/api/applicationApi';
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
  unreadInterestCount: 0,
};
const defaultFilters: PostFilters = { trade: '', location: '', kind: 'all' };

export interface DataScope {
  key: string;
  mode: 'feed' | 'mine';
  postId?: string;
  filtered: boolean;
}

export function useApiState(scope: DataScope) {
  const [snapshot, setSnapshot] = useState<ApiSnapshot>(empty);
  const [loadedKey, setLoadedKey] = useState('');
  const [filters, setFilters] = useState(defaultFilters);
  const [busy, setBusy] = useState(false);
  const operation = useRef(false);
  const [error, setError] = useState('');
  const [now, setNow] = useState(Date.now);
  const { postId, mode } = scope;
  const activeFilters = scope.filtered ? filters : defaultFilters;
  const query = new URLSearchParams({
    mode,
    ...activeFilters,
    ...(postId ? { postId } : {}),
  }).toString();
  const key = scope.key + '?' + query;
  const activeKey = useRef(key);
  const requestVersion = useRef(0);
  const currentEmail = useRef('');
  const loadedPages = useRef({ key, page: 0 });
  useEffect(() => {
    activeKey.current = key;
  }, [key]);

  const refresh = useCallback(
    async (signal?: AbortSignal) => {
      const version = ++requestVersion.current;
      const lastPage = loadedPages.current.key === key ? loadedPages.current.page : 0;
      let result = await applicationApi.snapshot(query, 0, signal);
      for (let page = 1; page <= lastPage && result.hasMore; page++) {
        const next = await applicationApi.snapshot(query, page, signal);
        if (next.email !== result.email) return;
        result = {
          ...next,
          posts: [...new Map([...result.posts, ...next.posts].map((p) => [p.id, p])).values()],
          profiles: [
            ...new Map([...result.profiles, ...next.profiles].map((p) => [p.id, p])).values(),
          ],
        };
      }
      if (signal?.aborted || activeKey.current !== key || version !== requestVersion.current)
        return;
      if (currentEmail.current !== result.email) setFilters(defaultFilters);
      currentEmail.current = result.email;
      loadedPages.current = { key, page: result.page };
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
    const visible = () => {
      if (document.visibilityState === 'visible') focus();
    };
    const poll = window.setInterval(visible, 60000);
    document.addEventListener('visibilitychange', visible);
    window.addEventListener('focus', focus);
    return () => {
      controller.abort();
      window.clearInterval(poll);
      document.removeEventListener('visibilitychange', visible);
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
    action: () => Promise<{ id?: string; developmentCode?: string; contact?: Profile } | void>,
    reload = true,
  ): Promise<ActionResult> {
    if (operation.current) return { ok: false, error: 'Please wait for the current request.' };
    ++requestVersion.current; // Discard refreshes started before this mutation.
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
    requestCode: (email: string) => run(() => applicationApi.requestCode(email), false),
    verifyCode: (email: string, code: string) => run(() => applicationApi.verifyCode(email, code)),
    logout: async () => {
      const result = await run(() => applicationApi.logout());
      if (!result.ok) setError(result.error);
      else setFilters(defaultFilters);
    },
    saveProfile: (draft: ProfileDraft) => run(() => applicationApi.saveProfile(draft)),
    savePost: (draft: PostDraft, id?: string, revision?: number) =>
      run(() => applicationApi.savePost(draft, id, revision)),
    deletePost: (id: string) => run(() => applicationApi.deletePost(id)),
    applyToPost: (id: string) => run(() => applicationApi.applyToPost(id)),
    markInterestsViewed: (id: string) =>
      run(() =>
        applicationApi.markInterestsViewed(
          id,
          snapshot.posts.find((p) => p.id === id)?.interested ?? [],
        ),
      ),
    loadContact: (id: string, personId: string) =>
      run(async () => ({ contact: await applicationApi.contact(id, personId) }), false),
    searchPosts: setFilters,
    loadMore: async () => {
      const result = await run(async () => {
        const next = await applicationApi.snapshot(query, snapshot.page + 1);
        if (activeKey.current !== key || next.email !== currentEmail.current) return;
        loadedPages.current = { key, page: next.page };
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
  return {
    loading: loadedKey.split('?')[0] !== scope.key,
    error,
    retry: () => refresh().catch(() => setError('Could not refresh. Please try again.')),
    value: {
      database,
      now,
      email: snapshot.email,
      user: snapshot.user ?? undefined,
      busy,
      hasMore: snapshot.hasMore,
      postFilters: filters,
      unreadInterestCount: snapshot.unreadInterestCount,
      ...actions,
    },
  };
}
