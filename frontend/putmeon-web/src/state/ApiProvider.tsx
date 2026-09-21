import { Fragment, type ReactNode } from 'react';
import { Context } from './appContext';
import { useApiState, type DataScope } from './useApiState';

export function ApiProvider({ children, scope }: { children: ReactNode; scope: DataScope }) {
  const { value, loading, error, retry } = useApiState(scope);
  if (loading)
    return (
      <main className="narrow">
        <p role="status">Loading PutMeOn…</p>
      </main>
    );
  if (error && !value.email)
    return (
      <main className="narrow">
        <p role="alert">{error}</p>
        <button onClick={() => void retry()}>Try again</button>
      </main>
    );
  return (
    <Context.Provider value={value}>
      {error && (
        <p className="info" role="alert">
          {error}
          <button className="text-button" onClick={() => void retry()}>
            Refresh
          </button>
        </p>
      )}
      <Fragment key={value.email}>{children}</Fragment>
    </Context.Provider>
  );
}
