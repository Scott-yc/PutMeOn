import { verifyDemoCode } from '../data/local/demoAuth';
import { persistCommand } from '../data/persistCommand';
import * as commands from '../domain/commands';
import type { ActionResult } from './demoContext';
import type { DemoRepository } from '../data/contracts/DemoRepository';
import { localDemoRepository } from '../data/local/localDemoRepository';
import type { Database } from '../domain/models';
import { useEffect, useRef, useState } from 'react';
import { Context } from './demoContext';
import type { ReactNode } from 'react';
import { expiresAt, removeExpiredPosts } from '../domain/postExpiry';

export function DemoProvider({
  children,
  repository = localDemoRepository,
}: {
  children: ReactNode;
  repository?: DemoRepository;
}) {
  const [database, setDatabase] = useState(() => repository.load());
  const current = useRef(database);
  const [now, setNow] = useState(Date.now);
  const [email, setEmail] = useState('');
  const [warning, setWarning] = useState(false);

  useEffect(() => {
    let active = true;
    const saved = repository.save(current.current);
    queueMicrotask(() => {
      if (active) setWarning(!saved);
    });
    const sync = () => {
      const latest = repository.load();
      current.current = latest;
      setDatabase(latest);
      setNow(Date.now());
    };
    const storage = (event: StorageEvent) => {
      if (event.key === 'putmeon.demo.v1' || event.key === null) sync();
    };
    window.addEventListener('storage', storage);
    return () => {
      active = false;
      window.removeEventListener('storage', storage);
    };
  }, [repository]);

  useEffect(() => {
    const refresh = () => {
      // Read the latest shared snapshot before cleanup, never write stale tab data.
      const latest = repository.load();
      const next = removeExpiredPosts(latest);
      current.current = next;
      setDatabase(next);
      setNow(Date.now());
      // load() already removes expired records; persist cleanup only when needed.
      if (database.posts.some((post) => expiresAt(post) <= Date.now())) {
        setWarning(!repository.save(next));
      }
    };
    const timer = window.setTimeout(
      refresh,
      Math.max(1, Math.min(60000, Math.min(...database.posts.map(expiresAt)) - Date.now())),
    );
    const resume = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', resume);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', resume);
    };
  }, [database, repository]);

  const user = database.profiles.find((profile) => profile.email === email);
  function execute(command: (db: Database) => Database, id?: string): ActionResult {
    try {
      const next = persistCommand(repository, (db) => removeExpiredPosts(command(db)));
      current.current = next;
      setDatabase(next);
      setWarning(false);
      return { ok: true, id };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : 'Something went wrong. Please try again.',
      };
    }
  }
  const actions = {
    savePost: (draft: commands.PostDraft, existingId?: string) => {
      const id = existingId ?? crypto.randomUUID();
      return execute(
        (db) => commands.savePost(db, draft, user?.id ?? '', id, Date.now(), Boolean(existingId)),
        id,
      );
    },
    deletePost: (id: string) =>
      execute((db) => commands.deletePost(db, id, user?.id ?? '', Date.now())),
    applyToPost: (id: string) =>
      execute((db) => commands.applyToPost(db, id, user?.id ?? '', Date.now())),
    saveProfile: (draft: commands.ProfileDraft) =>
      execute((db) => commands.saveProfile(db, draft, email, crypto.randomUUID())),
  };
  return (
    <Context.Provider
      value={{
        database,
        now,
        email,
        user,
        busy: false,
        hasMore: false,
        postFilters: { trade: '', location: '', kind: 'all' },
        requestCode: () => ({ ok: true, developmentCode: '482913' }),
        verifyCode: (address, code) => {
          if (!verifyDemoCode(code)) return { ok: false, error: 'Incorrect demo code.' };
          setEmail(address);
          return { ok: true };
        },
        loadContact: () => ({ ok: true }),
        searchPosts: () => {},
        loadMore: () => {},
        logout: () => setEmail(''),
        ...actions,
      }}
    >
      <div className="demo-banner">
        Frontend demo · No email is sent · Code: 482913 · Posts are deleted 7 days after publishing
      </div>
      {warning && <p role="alert">Browser storage is unavailable. Changes cannot be saved.</p>}
      {children}
    </Context.Provider>
  );
}
