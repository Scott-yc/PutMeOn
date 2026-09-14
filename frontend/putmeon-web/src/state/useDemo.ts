import { useContext } from 'react';
import { Context } from './demoContext';
export function useDemo() {
  const context = useContext(Context);
  if (!context) throw new Error('DemoProvider is required');
  return context;
}
