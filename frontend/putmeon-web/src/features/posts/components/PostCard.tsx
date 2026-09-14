import { formatDateRange } from '../../../shared/formatting/dates';
import DetailRow from '../../../shared/components/DetailRow';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { Post } from '../../../domain/models';
import { daysRemaining } from '../../../domain/postExpiry';
export function Badge({ kind }: { kind: Post['kind'] }) {
  return (
    <span className={`badge ${kind}`}>
      {kind === 'looking' ? 'Looking for a Subbie' : 'Available for Work'}
    </span>
  );
}
export default function PostCard({
  post,
  owner = false,
  children,
}: {
  post: Post;
  owner?: boolean;
  children?: ReactNode;
}) {
  const days = daysRemaining(post);
  return (
    <article className="card post-card">
      <Badge kind={post.kind} />
      <div className="post-summary">
        <div>
          <h2>{post.trade}</h2>
          {post.companyName && <p className="company-name">{post.companyName}</p>}
          <DetailRow icon="location">{post.location}</DetailRow>
          <DetailRow icon="money">${post.rate}/hr</DetailRow>
          <DetailRow icon="calendar">{formatDateRange(post.from, post.to)}</DetailRow>
        </div>
        <div className="expiry">
          {days <= 0 ? (
            'Expired'
          ) : (
            <>
              Expires in<strong>{days} days</strong>
            </>
          )}
        </div>
      </div>
      <p className="description">{post.description}</p>
      {children ?? (
        <div className="actions">
          <Link className="button secondary" to={`/posts/${post.id}`}>
            View
          </Link>
          {!owner && (
            <Link className="button" to={`/posts/${post.id}`}>
              {post.kind === 'looking' ? 'Put Me On' : 'Contact'}
            </Link>
          )}
        </div>
      )}
    </article>
  );
}
