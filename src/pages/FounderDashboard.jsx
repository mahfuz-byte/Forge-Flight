import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Topbar from '../components/Topbar';
import LeftNav from '../components/LeftNav';
import LogoBadge from '../components/LogoBadge';
import { Icon } from '../components/IconSprite';
import { fmtMoney, fundingPct } from '../data/startups';
import { useApp } from '../context/AppContext';
import '../styles/settings.css';
import '../styles/dashboard.css';

const SECTIONS = [
  ['overview', 'Overview'],
  ['funding', 'Manage Funding'],
  ['collab', 'Manage Collaboration'],
  ['applications', 'Applications'],
  ['analytics', 'Analytics'],
];

const WEEK_VIEWS = [
  ['Mon', 38], ['Tue', 52], ['Wed', 44], ['Thu', 68], ['Fri', 61], ['Sat', 30], ['Sun', 47],
];

// Runs an async action, shows "Saving…", then "Saved" or the server's error (BE-10).
function SaveButton({ onSave, label = 'Save changes' }) {
  const [state, setState] = useState('idle');
  const [error, setError] = useState('');
  async function handleClick() {
    setState('saving');
    setError('');
    try {
      await onSave();
      setState('saved');
      setTimeout(() => setState('idle'), 1600);
    } catch (err) {
      setState('idle');
      setError(err.message || 'Could not save. Please try again.');
    }
  }
  return (
    <>
      <button type="button" className="btn btn-accent btn-sm" disabled={state === 'saving'} onClick={handleClick}>
        {state === 'saved' ? <><Icon name="check" />Saved</> : state === 'saving' ? 'Saving…' : label}
      </button>
      {error && <p className="modal-error" role="alert" style={{ marginTop: 10 }}>{error}</p>}
    </>
  );
}

// Accept/decline buttons that wait for the server and surface its error.
function DecisionButtons({ onDecline, onAccept, declineLabel = 'Decline' }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function run(fn) {
    setBusy(true);
    setError('');
    try {
      await fn();
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="app-row-actions" style={{ flexWrap: 'wrap' }}>
      <button className="btn btn-outline btn-sm" disabled={busy} onClick={() => run(onDecline)}>{declineLabel}</button>
      <button className="btn btn-accent btn-sm" disabled={busy} onClick={() => run(onAccept)}>Accept</button>
      {error && <p className="modal-error" role="alert" style={{ flexBasis: '100%', margin: '6px 0 0' }}>{error}</p>}
    </div>
  );
}

const STATUS_CLASS = { accepted: 'status-open', pending: 'status-soon' };

function StatusPill({ status }) {
  return <span className={`status-pill ${STATUS_CLASS[status] || 'status-closed'}`}>{status}</span>;
}

function ManageFundingTab({ id, s, updateFunding }) {
  const [goal, setGoal] = useState(s.goal);
  const [status, setStatus] = useState(s.status);
  const [deadline, setDeadline] = useState(s.deadline);
  const pct = Math.min(100, Math.round((s.raised / goal) * 100) || 0);

  return (
    <div className="settings-card">
      <h4>Manage funding</h4>
      <div className="field"><label htmlFor="mf-goal">Funding goal ($)</label><input id="mf-goal" type="number" min="0" value={goal} onChange={(e) => setGoal(Number(e.target.value))} /></div>
      <div className="field">
        <label htmlFor="mf-status">Round status</label>
        <select id="mf-status" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="soon">Opening soon</option>
          <option value="open">Open: accepting investments</option>
          <option value="closed">Closed</option>
        </select>
      </div>
      <div className="field"><label htmlFor="mf-deadline">Deadline label</label><input id="mf-deadline" type="text" value={deadline} onChange={(e) => setDeadline(e.target.value)} /></div>
      <div className="gauge" style={{ marginBottom: 8 }}><span style={{ width: `${pct}%` }} /></div>
      <div className="funding-nums" style={{ marginBottom: 6 }}>
        <span>Raised <b>{fmtMoney(s.raised)}</b></span>
        <span className="muted">Goal <b className="mono">{fmtMoney(goal)}</b></span>
        <span className="muted">{pct}%</span>
      </div>
      <p className="settings-hint" style={{ marginBottom: 18 }}>
        The raised amount updates automatically when you accept investment requests. The round closes on its own once the goal is reached.
      </p>
      <SaveButton onSave={() => updateFunding(id, { goal, status, deadline })} />
    </div>
  );
}

function ManageCollabTab({ id, s, applications, setApplicationStatus, saveCollaboration }) {
  const [role, setRole] = useState(s.collab?.role || '');
  const [body, setBody] = useState(s.collab?.body || '');
  const [isOpen, setIsOpen] = useState(s.collab ? s.collab.isOpen : true);
  const collabApps = applications.filter((a) => a.startupId === id && a.type === 'collaboration');

  return (
    <div className="settings-card">
      <h4>Manage collaboration listing</h4>
      {!s.collab && <p className="settings-hint">You don't have an open role yet. Fill this in and save to publish one.</p>}
      <div className="field"><label htmlFor="mc-role">Role title</label><input id="mc-role" type="text" placeholder="e.g. Flutter Developer" value={role} onChange={(e) => setRole(e.target.value)} /></div>
      <div className="field"><label htmlFor="mc-body">Description</label><textarea id="mc-body" rows="3" placeholder="What this collaborator will help build." value={body} onChange={(e) => setBody(e.target.value)} /></div>
      <label className="field" style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
        <input type="checkbox" checked={isOpen} onChange={(e) => setIsOpen(e.target.checked)} />
        <span>Published: accepting applications</span>
      </label>
      <SaveButton onSave={() => saveCollaboration(id, { role, body, isOpen })} />

      <h4 style={{ marginTop: 26 }}>Applicants ({collabApps.length})</h4>
      {collabApps.length === 0 ? (
        <p className="settings-hint">No applications yet. They'll show up here as candidates apply from your Startup Profile.</p>
      ) : (
        <div className="app-list">
          {collabApps.map((a) => (
            <div className="app-row" key={a.id}>
              <div className="app-row-main">
                <b>{a.name}</b>
                <span className="app-row-meta">{a.email} · {a.time}</span>
                {a.message && <p className="app-row-msg">{a.message}</p>}
                {a.link && <a className="app-row-link" href={a.link} target="_blank" rel="noreferrer">{a.link}</a>}
              </div>
              {a.status === 'pending' ? (
                <DecisionButtons
                  onDecline={() => setApplicationStatus(a.id, 'declined')}
                  onAccept={() => setApplicationStatus(a.id, 'accepted')}
                />
              ) : (
                <StatusPill status={a.status} />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ApplicationsTab({ id, applications, investments, setApplicationStatus, setInvestmentStatus }) {
  const [filter, setFilter] = useState('all');
  const collabApps = applications.filter((a) => a.startupId === id).map((a) => ({ ...a, kind: 'collaboration' }));
  const investApps = investments.filter((i) => i.startupId === id).map((i) => ({ ...i, kind: 'investment' }));
  const merged = [...collabApps, ...investApps].filter((a) => filter === 'all' || a.kind === filter);

  return (
    <div className="settings-card">
      <h4>Applications inbox</h4>
      <div className="filter-row" style={{ padding: '0 0 18px', border: 'none' }}>
        {[['all', 'All'], ['collaboration', 'Collaboration'], ['investment', 'Investment']].map(([key, label]) => (
          <button key={key} className={`filter-pill${filter === key ? ' active' : ''}`} onClick={() => setFilter(key)}>{label}</button>
        ))}
      </div>
      {merged.length === 0 ? (
        <p className="settings-hint">Nothing here yet. Applications and investment requests from your Startup Profile will land in this inbox.</p>
      ) : (
        <div className="app-list">
          {merged.map((a) => (
            <div className="app-row" key={`${a.kind}-${a.id}`}>
              <div className="app-row-main">
                {a.kind === 'collaboration' ? (
                  <>
                    <b>{a.name}</b>
                    <span className="app-row-meta">Applied for {a.role} · {a.time}</span>
                    {a.message && <p className="app-row-msg">{a.message}</p>}
                  </>
                ) : (
                  <>
                    <b>Investment request · {fmtMoney(a.amount)}</b>
                    <span className="app-row-meta">{a.time}</span>
                    {a.note && <p className="app-row-msg">{a.note}</p>}
                  </>
                )}
              </div>
              {a.status === 'pending' ? (
                <DecisionButtons
                  declineLabel={a.kind === 'collaboration' ? 'Decline' : 'Reject'}
                  onDecline={() => (a.kind === 'collaboration' ? setApplicationStatus(a.id, 'declined') : setInvestmentStatus(a.id, 'rejected'))}
                  onAccept={() => (a.kind === 'collaboration' ? setApplicationStatus(a.id, 'accepted') : setInvestmentStatus(a.id, 'accepted'))}
                />
              ) : (
                <StatusPill status={a.status} />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function AnalyticsTab() {
  const max = Math.max(...WEEK_VIEWS.map(([, v]) => v));
  return (
    <div className="settings-card">
      <h4>Analytics</h4>
      <div className="stat-grid dash-stats" style={{ marginBottom: 24 }}>
        <div className="stat-tile"><b>1,284</b><span>Profile Views</span></div>
        <div className="stat-tile"><b>6,940</b><span>Post Impressions</span></div>
        <div className="stat-tile"><b>7.8%</b><span>Engagement Rate</span></div>
        <div className="stat-tile"><b>2.4k</b><span>Followers</span></div>
      </div>
      <h5 className="dash-chart-label">Profile views this week</h5>
      <div className="bar-chart">
        {WEEK_VIEWS.map(([day, val]) => (
          <div className="bar-col" key={day}>
            <div className="bar-track"><div className="bar-fill" style={{ height: `${Math.round((val / max) * 100)}%` }} /></div>
            <span className="bar-label">{day}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function FounderDashboard() {
  const { id } = useParams();
  const [section, setSection] = useState('overview');
  const navigate = useNavigate();
  const {
    currentUser, startups, applications, investments, setApplicationStatus, setInvestmentStatus,
    updateFunding, saveCollaboration,
  } = useApp();
  const s = startups[id];
  const isOwner = !!s && s.ownerId === currentUser.id;

  if (!s || !isOwner) {
    return (
      <div>
        <Topbar />
        <div className="layout layout-2col">
          <LeftNav />
          <main className="center-col settings-page">
            <div className="settings-card" style={{ maxWidth: 480 }}>
              <h4>{s ? "This isn't your startup to manage" : 'Startup not found'}</h4>
              <p className="settings-hint">
                {s
                  ? "Only the founder who created this startup can access its dashboard."
                  : "This startup doesn't exist — it may have been renamed or removed."}
              </p>
              <button className="btn btn-accent btn-sm" onClick={() => navigate('/account')}>Go to your account</button>
            </div>
          </main>
        </div>
      </div>
    );
  }

  const stats = {
    collabCount: applications.filter((a) => a.startupId === id).length,
    investCount: investments.filter((i) => i.startupId === id).length,
  };

  return (
    <div>
      <Topbar />
      <div className="layout layout-2col">
        <LeftNav />
        <main className="center-col settings-page">
          <h2 className="settings-title">Manage {s.name}</h2>
          <div className="settings-shell">
            <nav className="settings-nav">
              {SECTIONS.map(([key, label]) => (
                <button key={key} className={`settings-nav-item${section === key ? ' active' : ''}`} onClick={() => setSection(key)}>{label}</button>
              ))}
            </nav>
            <div className="settings-panel">
              {section === 'overview' && <OverviewTab id={id} s={s} stats={stats} navigate={navigate} />}
              {section === 'funding' && <ManageFundingTab id={id} s={s} updateFunding={updateFunding} />}
              {section === 'collab' && (
                <ManageCollabTab
                  id={id} s={s} applications={applications}
                  setApplicationStatus={setApplicationStatus} saveCollaboration={saveCollaboration}
                />
              )}
              {section === 'applications' && (
                <ApplicationsTab
                  id={id}
                  applications={applications}
                  investments={investments}
                  setApplicationStatus={setApplicationStatus}
                  setInvestmentStatus={setInvestmentStatus}
                />
              )}
              {section === 'analytics' && <AnalyticsTab />}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
