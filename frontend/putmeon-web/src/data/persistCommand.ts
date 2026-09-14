import type { Database } from '../domain/models';
import type { DemoRepository } from './contracts/DemoRepository';

/** Read immediately before writing so sequential actions use the latest snapshot. */
export function persistCommand(
  repository: DemoRepository,
  command: (db: Database) => Database,
): Database {
  const next = command(repository.load());
  if (!repository.save(next)) {
    throw new Error(
      'Could not save changes in this browser. Please free up storage or enable site storage and try again.',
    );
  }
  return next;
}
