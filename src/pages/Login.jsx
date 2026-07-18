import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import '../styles/login.css';

export default function Login() {
  const [params] = useSearchParams();
  const [tab, setTab] = useState(params.get('tab') === 'register' ? 'register' : 'login');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const { login, registerUser } = useApp();

  async function handleLogin(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await login(e.target.email.value, e.target.password.value);
      navigate('/feed');
    } catch {
      setError('Incorrect email or password.');
    } finally {
      setBusy(false);
    }
  }

  async function handleRegister(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await registerUser({
        name: e.target.name.value,
        email: e.target.email.value,
        password: e.target.password.value,
      });
      navigate('/account');
    } catch (err) {
      setError(err.data?.email?.[0] || err.data?.password?.[0] || 'Could not create your account.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-shell">
      <div className="auth-side">
        <div className="wordmark"><span className="mark">F&amp;F</span>FORGE &amp; FLIGHT</div>
        <blockquote>
          &ldquo;We posted our prototype on a Tuesday. By Friday our funding window had three offers.&rdquo;
          <cite>— Amara Chen, Founder, HealthSync</cite>
        </blockquote>
      </div>
      <div className="auth-form-wrap">
        <div className="auth-form">
          <div className="auth-tabs">
            <button className={tab === 'login' ? 'active' : ''} onClick={() => { setTab('login'); setError(''); }}>Log in</button>
            <button className={tab === 'register' ? 'active' : ''} onClick={() => { setTab('register'); setError(''); }}>Register</button>
          </div>

          {tab === 'login' && (
            <form onSubmit={handleLogin}>
              <div className="field"><label htmlFor="li-email">Email</label><input id="li-email" name="email" type="email" placeholder="you@startup.com" defaultValue="amara@healthsync.io" /></div>
              <div className="field"><label htmlFor="li-pass">Password</label><input id="li-pass" name="password" type="password" placeholder="••••••••" defaultValue="password123" /></div>
              {error && <p className="modal-error">{error}</p>}
              <button className="btn btn-accent auth-submit" type="submit" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
              <p className="auth-foot">Don't have an account? <a onClick={() => setTab('register')} style={{ color: 'var(--accent)', textDecoration: 'none', fontWeight: 600, cursor: 'pointer' }}>Register</a></p>
            </form>
          )}

          {tab === 'register' && (
            <form onSubmit={handleRegister}>
              <div className="field"><label htmlFor="rg-name">Full name</label><input id="rg-name" name="name" type="text" placeholder="Jordan Wren" required /></div>
              <div className="field"><label htmlFor="rg-email">Email</label><input id="rg-email" name="email" type="email" placeholder="you@startup.com" required /></div>
              <div className="field"><label htmlFor="rg-pass">Password</label><input id="rg-pass" name="password" type="password" placeholder="At least 8 characters" minLength={8} required /></div>
              {error && <p className="modal-error">{error}</p>}
              <button className="btn btn-accent auth-submit" type="submit" disabled={busy}>{busy ? 'Creating account…' : 'Create account'}</button>
              <p className="auth-foot">Already have an account? <a onClick={() => setTab('login')} style={{ color: 'var(--accent)', textDecoration: 'none', fontWeight: 600, cursor: 'pointer' }}>Log in</a></p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
