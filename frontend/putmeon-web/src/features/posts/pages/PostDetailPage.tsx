import { formatDateRange } from '../../../shared/formatting/dates';
import DetailRow from '../../../shared/components/DetailRow';
import { contactForPost } from '../../../domain/contactAccess';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useDemo } from '../../../state/useDemo';
import ContactDialog from '../../../shared/components/ContactDialog';
import { Badge } from '../components/PostCard';
import { daysRemaining } from '../../../domain/postExpiry';

export default function PostDetailPage({ interested = false }: { interested?: boolean }) {
  const { id } = useParams();
  const { database, now, user, busy, loadContact, applyToPost } = useDemo();
  const [error, setError] = useState('');
  const [contactId, setContactId] = useState<string | null>(null);
  async function openContact(personId: string) {
    if (!id) return;
    const result = await loadContact(id, personId);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setContactId(personId);
  }
  const post = database.posts.find((p) => p.id === id);
  if (!post || !user)
    return (
      <main>
        <h1>Post not found</h1>
        <Link to="/home">Back to feed</Link>
      </main>
    );
  const contact = contactId
    ? contactForPost(database, post.id, user.id, contactId, now)
    : undefined;
  const owner = database.profiles.find((p) => p.id === post.ownerId);
  const isOwner = user.id === post.ownerId;
  const applied = post.interested.includes(user.id);
  const expired = daysRemaining(post) <= 0;
  if (interested && !isOwner)
    return (
      <main>
        <h1>This list is only available to the poster.</h1>
        <Link to="/home">Back to feed</Link>
      </main>
    );
  return (
    <main className="narrow">
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      <section className="card">
        <Link className="back" to="/home">
          ← Back to feed
        </Link>
        {interested ? (
          <>
            <h1>Interested ({post.interested.length})</h1>
            <p>People who have put themselves on for this job.</p>
            {post.interested.length === 0 && <p>No interest yet.</p>}
            {post.interested.map((personId) => {
              const person = database.profiles.find((p) => p.id === personId);
              return (
                person && (
                  <article className="person" key={person.id}>
                    <span className="avatar">{person.name.slice(0, 2).toUpperCase()}</span>
                    <div>
                      <strong>{person.name}</strong>
                      {person.companyName && <p className="company-name">{person.companyName}</p>}
                      <p>{person.trade}</p>
                      <DetailRow icon="location">{person.location}</DetailRow>
                    </div>
                    <button
                      className="secondary"
                      disabled={busy}
                      onClick={() => void openContact(person.id)}
                    >
                      Contact
                    </button>
                  </article>
                )
              );
            })}
            <p className="info">Contact opens the applicant’s phone number and email address.</p>
          </>
        ) : (
          <>
            <Badge kind={post.kind} />
            <h1>{post.trade}</h1>
            <DetailRow icon="location">{post.location}</DetailRow>
            <DetailRow icon="money">${post.rate}/hr</DetailRow>
            <DetailRow icon="calendar">{formatDateRange(post.from, post.to)}</DetailRow>
            <p className="expiry">
              {expired ? 'Expired' : `Expires in ${daysRemaining(post)} days`}
            </p>
            <p className="description">{post.description}</p>
            <hr />
            <small>Posted by</small>
            <h2>{owner?.name ?? 'Unknown user'}</h2>
            {post.companyName && <p className="company-name">{post.companyName}</p>}
            <p>{owner?.trade}</p>
            {isOwner ? (
              <div className="actions">
                <Link className="button secondary" to={`/posts/${post.id}/edit`}>
                  Edit Post
                </Link>
                <Link className="button" to={`/posts/${post.id}/interested`}>
                  Interested ({post.interested.length})
                </Link>
              </div>
            ) : post.kind === 'looking' ? (
              <>
                <button
                  className="full"
                  disabled={busy || expired || applied}
                  onClick={async () => {
                    const result = await applyToPost(post.id);
                    setError(result.ok ? '' : result.error);
                  }}
                >
                  {expired ? 'Post expired' : applied ? 'You’re on the list' : 'Put Me On'}
                </button>
                <p role="status">
                  {applied
                    ? 'Your interest has been recorded.'
                    : 'The poster will be able to see your contact details.'}
                </p>
              </>
            ) : (
              <button
                className="full"
                disabled={busy || expired || !owner}
                onClick={() => owner && void openContact(owner.id)}
              >
                Contact
              </button>
            )}
          </>
        )}
      </section>
      {contact && <ContactDialog profile={contact} onClose={() => setContactId(null)} />}
    </main>
  );
}
