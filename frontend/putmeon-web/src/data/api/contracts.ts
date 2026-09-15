import type { Database, Profile } from '../../domain/models';
export interface ApiSnapshot extends Database {
  email: string;
  user: Profile | null;
  hasMore: boolean;
  page: number;
  unreadInterestCount: number;
}
export interface PostFilters {
  trade: string;
  location: string;
  kind: string;
}
