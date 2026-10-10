import { useEffect, useRef, useState } from 'react';
import { request } from './api.js';

const authRequest = (path, options) => request(path, options, '/api/auth');
export default function AccountGate({ children }) {
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(true);
  const [mode, setMode] = useState('login');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);
  const [values, setValues] = useState({ name: '', email: '', password: '' });
  useEffect(() => {
    const controller = new AbortController();
    authRequest('/me', { signal: controller.signal })
      .then((data) => {
        if (!controller.signal.aborted) setUser(data.user);
      })
      .catch((err) => {
        if (!controller.signal.aborted && err.status !== 401) setError(err.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setChecking(false);
      });
    const expired = () => {
      setUser(null);
      setValues({ name: '', email: '', password: '' });
      setError('Your session ended. Please sign in again.');
    };
    window.addEventListener('session-expired', expired);
    return () => {
      controller.abort();
      window.removeEventListener('session-expired', expired);
    };
  }, []);
  async function submit(event) {
    event.preventDefault();
    if (submitting.current) return;
    submitting.current = true;
    setBusy(true);
    setError('');
    try {
      const body =
        mode === 'register' ? values : { email: values.email, password: values.password };
      const data = await authRequest(`/${mode}`, { method: 'POST', body: JSON.stringify(body) });
      setValues({ name: '', email: '', password: '' });
      setUser(data.user);
    } catch (err) {
      setError(err.message);
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }
  async function logout() {
    await authRequest('/logout', { method: 'POST' });
    setUser(null);
    setError('');
    setMode('login');
  }
  async function startDemo() {
    if (submitting.current) return;
    submitting.current = true;
    setBusy(true);
    setError('');
    try {
      const data = await authRequest('/demo', { method: 'POST' });
      setValues({ name: '', email: '', password: '' });
      setUser(data.user);
    } catch (err) {
      setError(err.message);
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }
  if (checking)
    return (
      <div className="account-loading" role="status">
        <span className="spinner" />
        Opening your workspace…
      </div>
    );
  if (user) return children(user, logout);
  function field(event) {
    setValues((old) => ({ ...old, [event.target.name]: event.target.value }));
  }
  return (
    <main className="account-page">
      <section className="account-intro">
        <a className="account-brand" href="/">
          applyboard<span>.</span>
        </a>
        <div className="account-pitch">
          <span className="account-eyebrow">JOB APPLICATION TRACKER</span>
          <h1>
            Your applications.
            <br />
            All in one place.
          </h1>
          <p>Keep your applications, interviews, and follow-ups in one place.</p>
          <div className="account-preview">
            <div>
              <span className="account-preview-dot" />
              Applications
            </div>
            <span>Applied → Interview → Offer</span>
            <p>Your own workspace, from the first application to the final round.</p>
          </div>
        </div>
        <small>Applications · Interviews · Follow-ups</small>
      </section>
      <section className="account-form-panel">
        <div className="account-form-wrap">
          <span className="account-eyebrow">APPLYBOARD</span>
          <h2>{mode === 'register' ? 'Create your account' : 'Welcome back'}</h2>
          <p>
            {mode === 'register'
              ? 'Start with a private workspace for your job search.'
              : 'Sign in to pick up where you left off.'}
          </p>
          <form onSubmit={submit}>
            <fieldset disabled={busy}>
              {mode === 'register' && (
                <label>
                  Your name
                  <input
                    name="name"
                    value={values.name}
                    onChange={field}
                    required
                    maxLength={80}
                    autoComplete="name"
                  />
                </label>
              )}
              <label>
                Email address
                <input
                  type="email"
                  name="email"
                  value={values.email}
                  onChange={field}
                  required
                  maxLength={254}
                  autoComplete="email"
                />
              </label>
              <label>
                Password
                <input
                  type="password"
                  name="password"
                  value={values.password}
                  onChange={field}
                  required
                  minLength={10}
                  maxLength={128}
                  autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
                  aria-describedby={mode === 'register' ? 'password-help' : undefined}
                />
              </label>
              {mode === 'register' && <small id="password-help">Use at least 10 characters.</small>}
              {error && (
                <div className="error" role="alert">
                  {error}
                </div>
              )}
              <button className="primary-button" type="submit">
                {busy ? 'Please wait…' : mode === 'register' ? 'Create account' : 'Sign in'}
              </button>
            </fieldset>
          </form>
          <div className="demo-entry">
            <button className="secondary-button" disabled={busy} onClick={startDemo}>
              Try demo workspace
            </button>
            <small>No signup needed. Includes 8 sample applications.</small>
          </div>
          <p className="account-mode">
            {mode === 'register' ? 'Already have an account?' : 'New to ApplyBoard?'}{' '}
            <button
              className="text-button"
              disabled={busy}
              onClick={() => {
                setMode(mode === 'register' ? 'login' : 'register');
                setValues({ name: '', email: '', password: '' });
                setError('');
              }}
            >
              {mode === 'register' ? 'Sign in' : 'Create an account'}
            </button>
          </p>
          <div className="account-note">Your applications are visible only in your account.</div>
        </div>
      </section>
    </main>
  );
}
