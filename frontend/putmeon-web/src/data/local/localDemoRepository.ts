import type { DemoRepository } from '../contracts/DemoRepository';
import { normalizeTrade } from '../../domain/trades';
import { readDatabase, saveDatabase } from './demoStore';

export const localDemoRepository: DemoRepository = {
  load() {
    const stored = readDatabase();
    return {
      ...stored,
      profiles: stored.profiles.map((profile) => ({
        ...profile,
        trade: normalizeTrade(profile.trade),
      })),
      posts: stored.posts.map((post) => ({ ...post, trade: normalizeTrade(post.trade) })),
    };
  },
  save: saveDatabase,
};
