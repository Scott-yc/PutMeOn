import CodeInput from '../components/CodeInput';
import { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAppState } from '../../../state/useAppState';
import city from '../../../assets/Peopleback.png';

export default function AuthPage() {
  const { email, requestCode, verifyCode, busy } = useAppState();
  const navigate = useNavigate();
  const [address, setAddress] = useState('');
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState<string[]>(Array(6).fill(''));
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [developmentDelivery, setDevelopmentDelivery] = useState(false);
  const [resendAt, setResendAt] = useState(0);
  const [clock, setClock] = useState(Date.now);
  const remaining = Math.max(0, Math.ceil((resendAt - clock) / 1000));
  useEffect(() => {
    if (!resendAt) return;
    const update = () => setClock(Date.now());
    const timer = window.setInterval(update, 1000);
    document.addEventListener('visibilitychange', update);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', update);
    };
  }, [resendAt]);
  if (email) return <Navigate to="/home" replace />;
  async function send() {
    setError('');
    const result = await requestCode(address.trim().toLowerCase());
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setSent(true);
    setClock(Date.now());
    setResendAt(Date.now() + 60000);
    setDevelopmentDelivery(Boolean(result.developmentCode));
    setCode(Array(6).fill(''));
    setNotice(
      result.developmentCode
        ? `Local development code: ${result.developmentCode}. No email was sent.`
        : 'A 6-digit code has been sent. It expires in 5 minutes.',
    );
  }
  return (
    <main className="auth">
      <div className="auth-content">
        <div className="brand large">
          Put<span>MeOn</span>
        </div>
        <p className="tagline">Find work. Find subbies.</p>
        <section className="card auth-card">
          <h1>
            {sent
              ? developmentDelivery
                ? 'Your local login code'
                : 'Check your email'
              : 'Welcome'}
          </h1>
          <p>{sent ? address : 'Enter your email to get a login code.'}</p>
          <form
            onSubmit={async (event) => {
              event.preventDefault();
              if (busy) return;
              setError('');
              if (!sent) {
                await send();
                return;
              }
              const result = await verifyCode(address.trim().toLowerCase(), code.join(''));
              if (!result.ok) {
                setError(result.error);
                return;
              }
              navigate('/home');
            }}
          >
            {sent ? (
              <CodeInput
                value={code}
                invalid={Boolean(error)}
                onChange={(digits) => {
                  setCode(digits);
                  setError('');
                }}
              />
            ) : (
              <label>
                Email
                <input
                  type="email"
                  autoComplete="email"
                  required
                  maxLength={254}
                  placeholder="your@email.com"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                />
              </label>
            )}
            {error && (
              <p id="code-error" role="alert" className="error">
                {error}
              </p>
            )}
            <button
              className="full"
              disabled={busy || (sent && !code.every((digit) => /^[0-9]$/.test(digit)))}
            >
              {busy ? 'Please wait…' : sent ? 'Continue' : 'Send Code'}
            </button>
          </form>
          {sent && (
            <>
              <button
                className="text-button"
                disabled={busy || remaining > 0}
                onClick={() => void send()}
              >
                {remaining > 0 ? `Resend in ${remaining}s` : 'Resend code'}
              </button>
              <button
                className="text-button"
                disabled={busy}
                onClick={() => {
                  setSent(false);
                  setCode(Array(6).fill(''));
                  setError('');
                  setNotice('');
                }}
              >
                Change email
              </button>
              <p role="status">{notice}</p>
            </>
          )}
        </section>
        <div className="auth-footer">
          <strong>Built for Brisbane tradies.</strong>
          <p>Simple. Local. Real work.</p>
        </div>
      </div>
      <img className="city" src={city} alt="Brisbane construction community" />
    </main>
  );
}
