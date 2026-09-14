import { readProfileForm } from '../../../shared/forms/readForm';
import TradeOptions from '../../../shared/components/TradeOptions';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDemo } from '../../../state/useDemo';
import { trades } from '../../../domain/models';
export default function ProfilePage() {
  const { user, email, busy, saveProfile, logout } = useDemo();
  const navigate = useNavigate();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  return (
    <main className="narrow">
      <section className="card">
        <h1>{user ? 'Account' : 'Just a few details'}</h1>
        <p>{user ? 'Keep your contact details up to date.' : 'Let’s set up your profile.'}</p>
        <form
          onSubmit={async (event) => {
            event.preventDefault();
            if (busy) return;
            setSaved(false);
            const result = await saveProfile(readProfileForm(new FormData(event.currentTarget)));
            if (!result.ok) {
              setError(result.error);
              return;
            }
            setError('');
            setSaved(true);
            if (!user) navigate('/home');
          }}
        >
          <label>
            Your name
            <input
              name="name"
              required
              pattern=".*\S.*"
              maxLength={80}
              autoComplete="name"
              defaultValue={user?.name}
            />
          </label>
          <label>
            Company name (optional)
            <input
              name="companyName"
              maxLength={120}
              autoComplete="organization"
              placeholder="e.g. Brisbane Building Co."
              defaultValue={user?.companyName ?? ''}
            />
          </label>
          <label>
            Email
            <input type="email" value={email} disabled />
          </label>
          <label>
            Phone number
            <input
              name="phone"
              type="tel"
              required
              pattern="[+0-9 ()-]{8,20}"
              autoComplete="tel"
              defaultValue={user?.phone}
            />
          </label>
          <label>
            Main trade
            <select name="trade" defaultValue={user?.trade ?? trades[0]}>
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
              defaultValue={user?.location}
            />
          </label>
          <button className="full" disabled={busy}>
            {user ? 'Save details' : 'Continue'}
          </button>
          {error && (
            <p role="alert" className="error">
              {error}
            </p>
          )}
          {saved && <p role="status">Details saved.</p>}
        </form>
        {user && (
          <button
            className="secondary danger full"
            onClick={async () => {
              await logout();
              navigate('/login');
            }}
          >
            Log out
          </button>
        )}
      </section>
    </main>
  );
}
