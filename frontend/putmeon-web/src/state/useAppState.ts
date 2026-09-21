import { useContext } from 'react';
import { Context } from './appContext';
export function useAppState() {
  const context = useContext(Context);
  if (!context) throw new Error('An application state provider is required');
  return context;
}
