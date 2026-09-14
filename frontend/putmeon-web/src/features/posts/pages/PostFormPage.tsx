import { readPostForm } from '../../../shared/forms/readForm';
import TradeOptions from '../../../shared/components/TradeOptions';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useDemo } from '../../../state/useDemo';

export default function PostFormPage() {
  const { id } = useParams();
  const { database, user, busy, savePost } = useDemo();
  const navigate = useNavigate();
  const post = database.posts.find((p) => p.id === id);
  const [error, setError] = useState('');
  if (!user || (id && (!post || post.ownerId !== user.id)))
    return (
      <main>
        <h1>Post unavailable</h1>
        <Link to="/home">Back to feed</Link>
      </main>
    );
  return (
    <main className="narrow">
      <section className="card">
        <h1>{id ? 'Edit Post' : 'Create Post'}</h1>
        <form
          onSubmit={async (event) => {
            event.preventDefault();
            if (busy) return;
            const result = await savePost(readPostForm(new FormData(event.currentTarget)), id);
            if (!result.ok) {
              setError(result.error);
              return;
            }
            navigate('/posts/' + result.id);
          }}
        >
          <label>
            What are you posting?
            <select
              name="kind"
              defaultValue={
                post?.kind ?? new URLSearchParams(window.location.search).get('kind') ?? 'looking'
              }
            >
              <option value="looking">Looking for a Subbie</option>
              <option value="available">Available for Work</option>
            </select>
          </label>
          <label>
            Company name (optional)
            <input
              name="companyName"
              maxLength={120}
              autoComplete="organization"
              placeholder="e.g. Brisbane Building Co."
              defaultValue={post ? (post.companyName ?? '') : (user.companyName ?? '')}
            />
          </label>
          <label>
            Trade
            <select name="trade" defaultValue={post?.trade ?? user.trade}>
              <TradeOptions />
            </select>
          </label>
          <label>
            Location (suburb)
            <input
              name="location"
              required
              pattern=".*\S.*"
              maxLength={80}
              defaultValue={post?.location ?? user.location}
            />
          </label>
          <label>
            Hourly rate ($ per hour)
            <input
              type="number"
              name="rate"
              min="1"
              max="10000"
              step="0.01"
              required
              defaultValue={post?.rate}
            />
          </label>
          <div className="date-fields">
            <label>
              From
              <input type="date" name="from" required defaultValue={post?.from} />
            </label>
            <label>
              To
              <input type="date" name="to" required defaultValue={post?.to} />
            </label>
          </div>
          <label>
            Description
            <textarea
              name="description"
              required
              maxLength={500}
              rows={4}
              defaultValue={post?.description}
            />
          </label>
          <small>Maximum 500 characters</small>
          {error && (
            <p role="alert" className="error">
              {error}
            </p>
          )}
          <button className="full" disabled={busy}>
            {id ? 'Save changes' : 'Post'}
          </button>
        </form>
      </section>
    </main>
  );
}
