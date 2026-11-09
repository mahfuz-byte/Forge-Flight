import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import Topbar from '../components/Topbar';
import LeftNav from '../components/LeftNav';
import Avatar from '../components/Avatar';
import GoogleSignInButton, { googleSignInEnabled } from '../components/GoogleSignInButton';
import { useApp } from '../context/AppContext';
import '../styles/settings.css';

const SECTIONS = [
  ['account', 'Account'],
  ['security', 'Sign-in & security'],
  ['appearance', 'Appearance'],
];

const ROLE_LABELS = {
  user: 'Member',
  support_admin: 'Support admin',
  moderator: 'Moderator',
  finance_admin: 'Finance admin',
  admin: 'Admin',
  super_admin: 'Super admin',
};

function AccountSection({ currentUser, navigate, logOut }) {
  return (
    <div className="settings-card">
      <h4>Account</h4>
      <div className="settings-row">
        <Avatar src={currentUser.avatar} name={currentUser.name} initials={currentUser.initials} size={48} />
        <div className="settings-row-text">
          <b>{currentUser.name}</b>
          <span>{currentUser.email}</span>
        </div>
        <button type="button" className="btn btn-outline btn-sm" onClick={() => navigate('/account')}>Edit profile</button>
      </div>
      <div className="settings-row">
        <div className="settings-row-text">
          <b>Email address</b>
          <span>Your sign-in email can&rsquo;t be changed here. Contact support if you need to move your account.</span>
        </div>
      </div>
      <div className="settings-row">
        <div className="settings-row-text">
          <b>Account type</b>
          <span>{ROLE_LABELS[currentUser.role] || 'Member'}</span>
        </div>
      </div>
      <div className="settings-row">
        <div className="settings-row-text">
          <b>Sign out</b>
          <span>End your session on this device.</span>
        </div>
        <button
          type="button"
          className="btn btn-outline btn-sm"
          onClick={async () => { await logOut(); navigate('/'); }}
        >
          Log out
        </button>
      </div>
    </div>
  );
}

function PasswordForm({ hasPassword, changePassword }) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [state, setState] = useState('idle');
  const [error, setError] = useState('');

  async function submit(e) {
    e.preventDefault();
    setError('');
    if (next.length < 10) { setError('Use at least 10 characters.'); return; }
    if (next !== confirm) { setError('The new passwords don’t match.'); return; }
    setState('saving');
    try {
      await changePassword(current, next);
      setCurrent(''); setNext(''); setConfirm('');
      setState('saved');
    } catch (err) {
      const data = err.data || {};
      setError(data.current_password?.[0] || data.new_password?.[0] || err.message);
      setState('idle');
    }
  }

  return (
    <form onSubmit={submit}>
      {hasPassword && (
        <div className="field">
          <label htmlFor="pw-current">Current password</label>
          <input id="pw-current" type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} required />
        </div>
      )}
      <div className="field">
        <label htmlFor="pw-new">{hasPassword ? 'New password' : 'Password'}</label>
        <input id="pw-new" type="password" autoComplete="new-password" minLength={10} value={next} onChange={(e) => { setNext(e.target.value); setState('idle'); }} required />
      </div>
      <div className="field">
        <label htmlFor="pw-confirm">Confirm {hasPassword ? 'new ' : ''}password</label>
        <input id="pw-confirm" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
      </div>
      {error && <p className="modal-error" role="alert" style={{ margin: '0 0 12px' }}>{error}</p>}
      {state === 'saved' && <p className="settings-hint" role="status">Password {hasPassword ? 'updated' : 'set'}. Other devices have been signed out.</p>}
      <button type="submit" className="btn btn-accent btn-sm" disabled={state === 'saving'}>
        {state === 'saving' ? 'Saving…' : hasPassword ? 'Change password' : 'Set password'}
      </button>
    </form>
  );
}

function SecuritySection({ currentUser, changePassword, connectGoogle }) {
  const [googleError, setGoogleError] = useState('');

  async function handleGoogle(credential) {
    setGoogleError('');
    try {
      await connectGoogle(credential);
    } catch (err) {
      setGoogleError(err.message || 'Could not connect Google.');
    }
  }

  return (
    <>
      <div className="settings-card">
        <h4>{currentUser.hasPassword ? 'Change password' : 'Set a password'}</h4>
        <p className="settings-hint">
          {currentUser.hasPassword
            ? 'You can sign in with your email and this password.'
            : 'You sign in with Google. Add a password if you also want to sign in with your email.'}
        </p>
        <PasswordForm hasPassword={currentUser.hasPassword} changePassword={changePassword} />
      </div>

      <div className="settings-card">
        <h4>Connected accounts</h4>
        <div className="settings-row">
          <div className="settings-row-text">
            <b>Google</b>
            <span>{currentUser.googleLinked ? 'Connected. You can sign in with Google.' : 'Not connected.'}</span>
          </div>
          {currentUser.googleLinked && <span className="status-pill status-open">Connected</span>}
        </div>
        {!currentUser.googleLinked && googleSignInEnabled && (
          <div style={{ maxWidth: 320 }}>
            <GoogleSignInButton text="continue_with" onCredential={handleGoogle} onError={(err) => setGoogleError(err.message)} />
          </div>
        )}
        {googleError && <p className="modal-error" role="alert" style={{ marginTop: 10 }}>{googleError}</p>}
      </div>
    </>
  );
}

function AppearanceSection({ theme, setTheme }) {
  return (
    <div className="settings-card">
      <h4>Appearance</h4>
      <div className="settings-row">
        <div className="settings-row-text">
          <b>Theme</b>
          <span>Saved on this device.</span>
        </div>
        <div className="filter-row" style={{ padding: 0, border: 'none' }}>
          {[['light', 'Light'], ['dark', 'Dark']].map(([key, label]) => (
            <button key={key} type="button" className={`filter-pill${theme === key ? ' active' : ''}`} aria-pressed={theme === key} onClick={() => setTheme(key)}>
              {label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function Settings() {
  const [section, setSection] = useState('account');
  const navigate = useNavigate();
  const { signedIn, currentUser, logOut, changePassword, connectGoogle, theme, setTheme } = useApp();

  // Settings are personal: send guests to sign in first.
  if (!signedIn) return <Navigate to="/login" replace />;

  return (
    <div>
      <Topbar />
      <div className="layout layout-2col">
        <LeftNav />
        <main className="center-col settings-page">
          <h2 className="settings-title">Settings</h2>
          <div className="settings-shell">
            <nav className="settings-nav" aria-label="Settings sections">
              {SECTIONS.map(([key, label]) => (
                <button key={key} className={`settings-nav-item${section === key ? ' active' : ''}`} aria-current={section === key ? 'page' : undefined} onClick={() => setSection(key)}>
                  {label}
                </button>
              ))}
            </nav>
            <div className="settings-panel">
              {section === 'account' && <AccountSection currentUser={currentUser} navigate={navigate} logOut={logOut} />}
              {section === 'security' && <SecuritySection currentUser={currentUser} changePassword={changePassword} connectGoogle={connectGoogle} />}
              {section === 'appearance' && <AppearanceSection theme={theme} setTheme={setTheme} />}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
