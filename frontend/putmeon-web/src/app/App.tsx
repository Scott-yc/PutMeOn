import { ApiProvider } from '../state/ApiProvider';
import { BrowserRouter } from 'react-router-dom';
import { DemoProvider } from '../state/DemoProvider';
import AppRoutes from './AppRoutes';

export default function App() {
  const Provider = import.meta.env.VITE_DATA_MODE === 'demo' ? DemoProvider : ApiProvider;
  return (
    <BrowserRouter>
      <Provider>
        <AppRoutes />
      </Provider>
    </BrowserRouter>
  );
}
