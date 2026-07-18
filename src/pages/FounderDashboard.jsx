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

function SaveButton({ onSave, label = 'Save changes' }) {
  const [saved, setSaved] = useState(false);
  return (
    <button
      type="button"
      className="btn btn-accent btn-sm"
      onClick={() => { onSave?.(); setSaved(true); setTimeout(() => setSaved(false), 1600); }}
    >
      {saved ? <><Icon name="check" />Saved</> : label}
    </button>
  );
}

function OverviewTab({ id, s, stats, navigate }) {
  return (
    <div className="settings-card">
      <div className="dash-header">
        <LogoBadge id={id} initials={s.initials} size={54} />
        <div>
          <h4 style={{ marginBottom: 2 }}>{s.name}</h4>
          <p className="settings-hint" style={{ marginBottom: 0 }}>{s.tagline}</p>
        </div>
        <button className="btn btn-outline btn-sm" style={{ marginLeft: 'auto' }} onClick={() => navigate(`/profile/${id}`)}>
          View public profile
        </button>
      </div>
      <div className="stat-grid dash-stats">
        <div className="stat-tile"><b>2.4k</b><span>Followers</span></div>
        <div className="stat-tile"><b>{fundingPct(s.raised, s.goal)}%</b><span>Funding Raised</span></div>
        <div className="stat-tile"><b>{stats.collabCount}</b><span>Applications</span></div>
        <div className="stat-tile"><b>{stats.investCount}</b><span>Investment Requests</span></div>
      </div>
    </div>
  );
}

function ManageFundingTab({ s }) {
  const [goal, setGoal] = useState(s.goal);
  const [raised, setRaised] = useState(s.raised);
  const [deadline, setDeadline] = useState(s.deadline);
  const pct = Math.min(100, Math.round((raised / goal) * 100) || 0);

  return (
    <div className="settings-card">
      <h4>Manage funding</h4>
      <div className="field"><label htmlFor="mf-goal">Funding goal ($)</label><input id="mf-goal" type="number" value={goal} onChange={(e) => setGoal(Number(e.target.value))} /></div>
      <div className="field"><label htmlFor="mf-raised">Amount raised ($)</label><input id="mf-raised" type="number" value={raised} onChange={(e) => setRaised(Number(e.target.value))} /></div>
      <div className="field"><label htmlFor="mf-deadline">Deadline label</label><input id="mf-deadline" type="text" value={deadline} onChange={(e) => setDeadline(e.target.value)} /></div>
      <div className="gauge" style={{ marginBottom: 8 }}><span style={{ width: `${pct}%` }} /></div>
      <div className="funding-nums" style={{ marginBottom: 18 }}>
        <span>Raised <b>{fmtMoney(raised)}</b></span>
        <span className="muted">Goal <b className="mono">{fmtMoney(goal)}</b></span>
        <span className="muted">{pct}%</span>
      </div>
      <SaveButton />
    </div>
  );
}

function ManageCollabTab({ id, s, applications, setApplicationStatus }) {
  const [role, setRole] = useState(s.collab?.role || '');
  const [body, setBody] = useState(s.collab?.body || '');
  const collabApps = applications.filter((a) => a.startupId === id && a.type === 'collaboration');

  return (
    <div className="settings-card">
      <h4>Manage collaboration listing</h4>
      {!s.collab && <p className="settings-hint">You don't have an open role yet — fill this in and save to publish one.</p>}
      <div className="field"><label htmlFor="mc-role">Role title</label><input id="mc-role" type="text" placeholder="e.g. Flutter Developer" value={role} onChange={(e) => setRole(e.target.value)} /></div>
      <div className="field"><label htmlFor="mc-body">Description</label><textarea id="mc-body" rows="3" placeholder="What this collaborator will help build." value={body} onChange={(e) => setBody(e.target.value)} /></div>
      <SaveButton />

      <h4 style={{ marginTop: 26 }}>Applicants ({collabApps.length})</h4>
      {collabApps.length === 0 ? (
        <p className="settings-hint">No applications yet — they'll show up here as candidates apply from your Startup Profile.</p>
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
                <div className="app-row-actions">
                  <button className="btn btn-outline btn-sm" onClick={() => setApplicationStatus(a.id, 'declined')}>Decline</button>
                  <button className="btn btn-accent btn-sm" onClick={() => setApplicationStatus(a.id, 'accepted')}>Accept</button>
                </div>
              ) : (
                <span className={`status-pill ${a.status === 'accepted' ? 'status-open' : 'status-closed'}`}>{a.status}</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ApplicationsTab({ id, applications, investments, setApplicationStatus, setInvestmentStatus, cancelInvestment }) {
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
            <div className="app-row" key={a.id}>
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
                  </>
                )}
              </div>
              {a.status === 'pending' ? (
                <div className="app-row-actions">
                  <button
                    className="btn btn-outline btn-sm"
                    onClick={() => (a.kind === 'collaboration' ? setApplicationStatus(a.id, 'declined') : cancelInvestment(a.id))}
                  >
                    Decline
                  </button>
                  <button
                    className="btn btn-accent btn-sm"
                    onClick={() => (a.kind === 'collaboration' ? setApplicationStatus(a.id, 'accepted') : setInvestmentStatus(a.id, 'accepted'))}
                  >
                    Accept
                  </button>
                </div>
              ) : (
                <span className={`status-pill ${a.status === 'accepted' ? 'status-open' : 'status-closed'}`}>{a.status}</span>
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
  const { currentUser, startups, applications, investments, setApplicationStatus, setInvestmentStatus, cancelInvestment } = useApp();
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
              {section === 'funding' && <ManageFundingTab s={s} />}
              {section === 'collab' && (
                <ManageCollabTab id={id} s={s} applications={applications} setApplicationStatus={setApplicationStatus} />
              )}
              {section === 'applications' && (
                <ApplicationsTab
                  id={id}
                  applications={applications}
                  investments={investments}
                  setApplicationStatus={setApplicationStatus}
                  setInvestmentStatus={setInvestmentStatus}
                  cancelInvestment={cancelInvestment}
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
