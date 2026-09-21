import { ApiProvider } from '../state/ApiProvider';
import { BrowserRouter, useLocation } from 'react-router-dom';
import { DemoProvider } from '../state/DemoProvider';
import AppRoutes from './AppRoutes';

export default function App() {
  return (
    <BrowserRouter>
      <DataProvider>
        <AppRoutes />
      </DataProvider>
    </BrowserRouter>
  );
}

function DataProvider({ children }: { children: React.ReactNode }) {
  const { pathname } = useLocation();
  if (import.meta.env.VITE_DATA_MODE === 'demo') return <DemoProvider>{children}</DemoProvider>;
  return (
    <ApiProvider
      scope={{
        key: pathname,
        mode: pathname === '/my-posts' ? 'mine' : 'feed',
        postId: pathname.match(/^\/posts\/([^/]+)/)?.[1],
        filtered: pathname === '/home',
      }}
    >
      {children}
    </ApiProvider>
  );
}
