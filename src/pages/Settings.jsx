import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Topbar from '../components/Topbar';
import LeftNav from '../components/LeftNav';
import { Icon } from '../components/IconSprite';
import { useApp } from '../context/AppContext';
import '../styles/settings.css';

const SECTIONS = [
  ['account', 'Account'],
  ['notifications', 'Notifications'],
  ['danger', 'Danger Zone'],
];

export default function Settings() {
  const [section, setSection] = useState('account');
  const navigate = useNavigate();
  const { currentUser, updateCurrentUser, logOut } = useApp();
  const [prefs, setPrefs] = useState({ email: true, funding: true, comments: true, digest: false });
  const [name, setName] = useState(currentUser.name);
  const [email, setEmail] = useState(currentUser.email);
  const [bio, setBio] = useState(currentUser.bio);
  const [saved, setSaved] = useState(false);

  function togglePref(key) {
    setPrefs((p) => ({ ...p, [key]: !p[key] }));
  }

  function handleSave() {
    updateCurrentUser({ name, email, bio });
    setSaved(true);
    setTimeout(() => setSaved(false), 1600);
  }

  return (
    <div>
      <Topbar />
      <div className="layout layout-2col">
        <LeftNav />
        <main className="center-col settings-page">
          <h2 className="settings-title">Settings</h2>
          <div className="settings-shell">
            <nav className="settings-nav">
              {SECTIONS.map(([key, label]) => (
                <button key={key} className={`settings-nav-item${section === key ? ' active' : ''}`} onClick={() => setSection(key)}>{label}</button>
              ))}
            </nav>

            <div className="settings-panel">
              {section === 'account' && (
                <div className="settings-card">
                  <h4>Account details</h4>
                  <div className="field"><label htmlFor="s-name">Full name</label><input id="s-name" type="text" value={name} onChange={(e) => setName(e.target.value)} /></div>
                  <div className="field"><label htmlFor="s-email">Email</label><input id="s-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
                  <div className="field"><label htmlFor="s-bio">Bio</label><textarea id="s-bio" rows="3" value={bio} onChange={(e) => setBio(e.target.value)} /></div>
                  <button className="btn btn-accent btn-sm" onClick={handleSave}>
                    {saved ? <><Icon name="check" />Saved</> : 'Save changes'}
                  </button>
                </div>
              )}

              {section === 'notifications' && (
                <div className="settings-card">
                  <h4>Notification preferences</h4>
                  <label className="settings-toggle-row"><span>Email notifications</span><input type="checkbox" checked={prefs.email} onChange={() => togglePref('email')} /></label>
                  <label className="settings-toggle-row"><span>Funding activity</span><input type="checkbox" checked={prefs.funding} onChange={() => togglePref('funding')} /></label>
                  <label className="settings-toggle-row"><span>Comments &amp; replies</span><input type="checkbox" checked={prefs.comments} onChange={() => togglePref('comments')} /></label>
                  <label className="settings-toggle-row"><span>Weekly digest</span><input type="checkbox" checked={prefs.digest} onChange={() => togglePref('digest')} /></label>
                </div>
              )}

              {section === 'danger' && (
                <div className="settings-card">
                  <h4>Log out</h4>
                  <p className="settings-hint">End your current session on this device.</p>
                  <button className="btn btn-outline btn-sm" onClick={async () => { await logOut(); navigate('/'); }}>Log out</button>
                  <h4 style={{ marginTop: 26 }}>Danger zone</h4>
                  <p className="settings-hint">Deactivating your account hides your startups and pauses all their funding windows.</p>
                  <button className="btn btn-outline btn-sm" style={{ borderColor: 'var(--accent)', color: 'var(--accent)' }}>Deactivate account</button>
                </div>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
