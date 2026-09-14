import type { Database } from '../../domain/models';

/** Synchronous snapshot contract for the local demo only. */
export interface DemoRepository {
  load(): Database;
  save(database: Database): boolean;
}
