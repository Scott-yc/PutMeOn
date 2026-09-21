import { Link, Navigate, NavLink, Outlet } from 'react-router-dom';
import { useAppState } from '../state/useAppState';
import ProfilePage from '../features/profile/pages/ProfilePage';
export default function AppLayout() {
  const { email, user, unreadInterestCount } = useAppState();
  if (!email) return <Navigate to="/login" replace />;
  if (!user) return <ProfilePage />;
  return (
    <>
      <a className="skip" href="#content">
        Skip to content
      </a>
      <header>
        <Link to="/home" className="brand">
          Put<span>MeOn</span>
        </Link>
        <nav aria-label="Main navigation">
          <NavLink to="/home">Home</NavLink>
          <NavLink to="/post">Post</NavLink>
          <NavLink to="/my-posts" className="my-posts-nav">
            <span>My Posts</span>
            {unreadInterestCount > 0 && (
              <span
                className="notification-badge"
                aria-label={`${unreadInterestCount} new ${unreadInterestCount === 1 ? 'application' : 'applications'}`}
              >
                {unreadInterestCount > 99 ? '99+' : unreadInterestCount}
              </span>
            )}
          </NavLink>
          <NavLink to="/account">Account</NavLink>
        </nav>
        <Link to="/account" className="avatar" aria-label="Your account">
          {user.name.slice(0, 2).toUpperCase()}
        </Link>
      </header>
      <div id="content">
        <Outlet />
      </div>
      <footer>
        <strong>Built for Brisbane</strong>
        <p>Local. Simple. Real people.</p>
      </footer>
    </>
  );
}
