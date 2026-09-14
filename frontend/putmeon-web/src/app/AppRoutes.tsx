import AppLayout from './AppLayout';
import { Link, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import AuthPage from '../features/auth/pages/AuthPage';
import ProfilePage from '../features/profile/pages/ProfilePage';
import FeedPage from '../features/posts/pages/FeedPage';
import PostFormPage from '../features/posts/pages/PostFormPage';
import PostDetailPage from '../features/posts/pages/PostDetailPage';
export default function AppRoutes() {
  const location = useLocation();
  return (
    <Routes>
      <Route path="/login" element={<AuthPage />} />
      <Route path="/verify-code" element={<Navigate to="/login" replace />} />
      <Route element={<AppLayout />}>
        <Route path="/home" element={<FeedPage key="feed" />} />
        <Route path="/post" element={<PostFormPage key={location.pathname + location.search} />} />
        <Route path="/posts/:id" element={<PostDetailPage key={location.pathname} />} />
        <Route path="/posts/:id/edit" element={<PostFormPage key={location.pathname} />} />
        <Route
          path="/posts/:id/interested"
          element={<PostDetailPage key={location.pathname} interested />}
        />
        <Route path="/my-posts" element={<FeedPage key="mine" mine />} />
        <Route path="/account" element={<ProfilePage />} />
        <Route path="/complete-profile" element={<ProfilePage />} />
      </Route>
      <Route path="/" element={<Navigate to="/home" replace />} />
      <Route
        path="*"
        element={
          <main>
            <h1>Page not found</h1>
            <Link to="/home">Back to home</Link>
          </main>
        }
      />
    </Routes>
  );
}
