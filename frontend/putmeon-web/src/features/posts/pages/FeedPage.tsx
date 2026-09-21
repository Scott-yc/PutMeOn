import TradeOptions from '../../../shared/components/TradeOptions';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAppState } from '../../../state/useAppState';
import PostCard from '../components/PostCard';

import { daysRemaining } from '../../../domain/postExpiry';
export default function FeedPage({ mine = false }: { mine?: boolean }) {
  const { database, user, busy, hasMore, postFilters, searchPosts, loadMore, deletePost } =
    useAppState();
  const [error, setError] = useState('');
  const [kind, setKind] = useState(postFilters.kind);
  const [trade, setTrade] = useState(postFilters.trade);
  const [location, setLocation] = useState(postFilters.location);
  const [filters, setFilters] = useState({
    trade: postFilters.trade,
    location: postFilters.location,
  });
  const [deleting, setDeleting] = useState<string | null>(null);
  function clearFilters() {
    setTrade('');
    setLocation('');
    setKind('all');
    setFilters({ trade: '', location: '' });
    searchPosts({ trade: '', location: '', kind: 'all' });
  }
  const posts = database.posts.filter((p) =>
    mine
      ? p.ownerId === user?.id
      : daysRemaining(p) > 0 &&
        (kind === 'all' || p.kind === kind) &&
        (!filters.trade || p.trade === filters.trade) &&
        p.location.toLowerCase().includes(filters.location.toLowerCase()),
  );
  return (
    <main className="feed">
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      <h1>{mine ? 'My Posts' : 'What are you looking for?'}</h1>
      {!mine && (
        <>
          <div className="choices">
            <Link className="choice blue" to="/post?kind=looking">
              <strong>⌕ Looking for a Subbie</strong>
              <span>Post a job and find tradies</span>
            </Link>
            <Link className="choice green" to="/post?kind=available">
              <strong>♧ Available for Work</strong>
              <span>Tell builders you’re available</span>
            </Link>
          </div>
          <form
            className="filters"
            onSubmit={(e) => {
              e.preventDefault();
              setFilters({ trade, location: location.trim() });
              searchPosts({ trade, location: location.trim(), kind });
            }}
          >
            <label>
              Trade
              <select value={trade} onChange={(e) => setTrade(e.target.value)}>
                <option value="">All Trades</option>
                <TradeOptions />
              </select>
            </label>
            <label>
              Location
              <input
                placeholder="Brisbane"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
              />
            </label>
            <button>Search</button>
          </form>
          {(filters.trade || filters.location || kind !== 'all') && (
            <p className="info" role="status">
              Filtered results:{' '}
              {[
                filters.trade,
                filters.location,
                kind === 'all'
                  ? ''
                  : kind === 'looking'
                    ? 'Looking for a Subbie'
                    : 'Available for Work',
              ]
                .filter(Boolean)
                .join(' · ')}{' '}
              <button className="text-button" onClick={clearFilters}>
                Clear filters
              </button>
            </p>
          )}
          <div className="tabs" aria-label="Post categories">
            {[
              ['all', 'All Posts'],
              ['looking', 'Looking for a Subbie'],
              ['available', 'Available for Work'],
            ].map(([value, title]) => (
              <button
                key={value}
                aria-pressed={kind === value}
                className={kind === value ? 'active' : ''}
                onClick={() => {
                  setKind(value);
                  searchPosts({ ...filters, kind: value });
                }}
              >
                {title}
              </button>
            ))}
          </div>
        </>
      )}
      <div className={mine ? 'my-posts' : 'post-list'}>
        {posts.map((post) => (
          <PostCard key={post.id} post={post} owner={post.ownerId === user?.id}>
            {mine ? (
              <div className="owner-panel">
                {post.kind === 'looking' && (
                  <Link
                    className="interest-link"
                    to={`/posts/${post.id}/interested`}
                    aria-label={`View ${post.interested.length} interested people${post.interested.length > (post.viewedInterestCount ?? 0) ? ', new applications' : ''}`}
                  >
                    <span className="interest-count">{post.interested.length}</span>
                    <span className="interest-copy">
                      <strong className="interest-title">
                        Interested
                        {post.interested.length > (post.viewedInterestCount ?? 0) && (
                          <span className="new-interest-dot" aria-hidden="true" />
                        )}
                      </strong>
                      <span>
                        {post.interested.length === 0
                          ? 'No applications yet'
                          : 'View people and contact details'}
                      </span>
                    </span>
                    <span aria-hidden="true">→</span>
                  </Link>
                )}
                <div className="owner-actions">
                  <Link className="button secondary" to={`/posts/${post.id}`}>
                    View
                  </Link>
                  <Link className="button secondary" to={`/posts/${post.id}/edit`}>
                    Edit
                  </Link>
                  <button className="secondary danger" onClick={() => setDeleting(post.id)}>
                    Delete
                  </button>
                </div>
                {deleting === post.id && (
                  <div role="alert" className="delete-confirm">
                    Delete this post and its applications?
                    <button
                      className="danger secondary"
                      disabled={busy}
                      onClick={async () => {
                        const result = await deletePost(post.id);
                        if (!result.ok) {
                          setError(result.error);
                          return;
                        }
                        setError('');
                        setDeleting(null);
                      }}
                    >
                      Delete post
                    </button>
                    <button className="secondary" onClick={() => setDeleting(null)}>
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            ) : undefined}
          </PostCard>
        ))}
      </div>
      {hasMore && (
        <button className="secondary full" disabled={busy} onClick={() => void loadMore()}>
          {busy ? 'Loading…' : 'Load more posts'}
        </button>
      )}
      {posts.length === 0 && (
        <section className="card empty">
          <h2>{mine ? 'Your next opportunity starts here' : 'No matching posts'}</h2>
          <p>
            {mine
              ? 'Create your first post to connect with local tradies.'
              : 'Try another trade or suburb.'}
          </p>
          <Link className="button" to="/post">
            Create Post
          </Link>
        </section>
      )}
    </main>
  );
}
