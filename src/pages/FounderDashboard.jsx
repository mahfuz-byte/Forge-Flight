import { useState, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Topbar from '../components/Topbar';
import LeftNav from '../components/LeftNav';
import LogoBadge from '../components/LogoBadge';
import Avatar from '../components/Avatar';
import { Icon } from '../components/IconSprite';
import { fmtMoney } from '../data/startups';
import { useApp } from '../context/AppContext';
import ReviewNotice from '../components/ReviewNotice';
import CreateStartupModal from '../components/CreateStartupModal';
import '../styles/settings.css';
import '../styles/dashboard.css';
import '../styles/modal.css';

const SECTIONS = [
  ['overview', 'Overview & Edit'],
  ['investments', 'Investment Portal'],
  ['collab', 'Collaboration & Roles'],
  ['posts', 'Startup Posts'],
  ['analytics', 'Analytics & AI'],
  ['settings', 'Danger Zone'],
];

const WEEK_VIEWS = [
  ['Mon', 38], ['Tue', 52], ['Wed', 44], ['Thu', 68], ['Fri', 61], ['Sat', 30], ['Sun', 47],
];

const STATUS_CLASS = { accepted: 'status-open', pending: 'status-soon', declined: 'status-closed', rejected: 'status-closed' };

function StatusPill({ status }) {
  return <span className={`status-pill ${STATUS_CLASS[status] || 'status-closed'}`}>{status}</span>;
}

// Runs an async action, shows "Saving…", then "Saved" or error
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
        {state === 'saved' ? <><Icon name="check" /> Saved</> : state === 'saving' ? 'Saving…' : label}
      </button>
      {error && <p className="modal-error" role="alert" style={{ marginTop: 10 }}>{error}</p>}
    </>
  );
}

// Decision buttons with server status and action feedback
function DecisionButtons({ onDecline, onAccept, declineLabel = 'Decline', acceptLabel = 'Confirm' }) {
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
      <button className="btn btn-accent btn-sm" disabled={busy} onClick={() => run(onAccept)}>{acceptLabel}</button>
      {error && <p className="modal-error" role="alert" style={{ flexBasis: '100%', margin: '6px 0 0' }}>{error}</p>}
    </div>
  );
}

// ==========================================
// 1. INVESTOR PORTAL MODAL
// ==========================================
function InvestorPortalModal({ investment, onClose, onAccept, onReject, navigate }) {
  if (!investment) return null;
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel portal-modal-panel" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head" style={{ borderBottom: 'none', paddingBottom: 0 }}>
          <span className="dash-post-type" style={{ background: 'var(--success-alpha)', color: 'var(--success)' }}>
            Investor Portal
          </span>
          <button className="icon-btn" onClick={onClose} aria-label="Close"><Icon name="close" /></button>
        </div>

        <div className="portal-modal-head">
          <Avatar
            src={investment.investorAvatar}
            name={investment.investorName}
            size={52}
          />
          <div className="portal-modal-head-info">
            <h3>{investment.investorName}</h3>
            <span>{investment.investorEmail}{investment.investorLocation ? ` · ${investment.investorLocation}` : ''}</span>
            {investment.investorHeadline && (
              <p style={{ margin: '2px 0 0', fontSize: 13, color: 'var(--text-muted)' }}>{investment.investorHeadline}</p>
            )}
          </div>
        </div>

        <div className="portal-modal-section">
          <h5>Investment Proposal</h5>
          <div className="portal-modal-box" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <span style={{ fontSize: 11.5, color: 'var(--text-faint)' }}>Offered Investment Amount:</span>
              <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--accent)', fontFamily: 'IBM Plex Mono' }}>
                {fmtMoney(investment.amount)}
              </div>
            </div>
            <StatusPill status={investment.status} />
          </div>
          {investment.note && (
            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 8, fontStyle: 'italic' }}>
              &ldquo;{investment.note}&rdquo;
            </p>
          )}
        </div>

        <div className="portal-modal-section">
          <h5>Investor Background &amp; Criteria</h5>
          <div className="portal-modal-box" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', paddingBottom: 6 }}>
              <span className="muted">Investor Type:</span>
              <b>{investment.investorType || 'Angel Investor'}</b>
            </div>
            {investment.investorBudget && (
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', paddingBottom: 6 }}>
                <span className="muted">Typical Budget:</span>
                <b>{investment.investorBudget}</b>
              </div>
            )}
            {investment.investorInterests && (
              <div>
                <span className="muted" style={{ display: 'block', marginBottom: 4 }}>Target Sectors / Interests:</span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {investment.investorInterests.split(',').map((tag, idx) => (
                    <span key={idx} className="skill-tag" style={{ background: 'var(--info-alpha)', color: 'var(--info)' }}>
                      {tag.trim()}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {investment.investorBio && (
              <div>
                <span className="muted" style={{ display: 'block', marginBottom: 2 }}>Bio:</span>
                <p style={{ margin: 0, fontSize: 12.5, color: 'var(--text-muted)' }}>{investment.investorBio}</p>
              </div>
            )}
            {investment.investorPortfolio && (
              <div>
                <span className="muted">Portfolio / Link: </span>
                <a href={investment.investorPortfolio} target="_blank" rel="noreferrer" style={{ color: 'var(--accent)', fontWeight: 600 }}>
                  {investment.investorPortfolio}
                </a>
              </div>
            )}
          </div>
        </div>

        <div className="modal-actions" style={{ justifyContent: 'space-between', marginTop: 20 }}>
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={() => {
              onClose();
              navigate('/messages');
            }}
          >
            <Icon name="msg" /> Message Investor
          </button>
          <div style={{ display: 'flex', gap: 8 }}>
            {investment.status === 'pending' ? (
              <>
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  onClick={() => {
                    onReject(investment.id);
                    onClose();
                  }}
                >
                  Reject
                </button>
                <button
                  type="button"
                  className="btn btn-accent btn-sm"
                  onClick={() => {
                    onAccept(investment.id);
                    onClose();
                  }}
                >
                  Confirm Investment
                </button>
              </>
            ) : (
              <button type="button" className="btn btn-outline btn-sm" onClick={onClose}>Close</button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ==========================================
// 2. COLLABORATOR PROFILE MODAL
// ==========================================
function CollaboratorProfileModal({ application, onClose, onAccept, onDecline, navigate }) {
  if (!application) return null;
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel portal-modal-panel" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head" style={{ borderBottom: 'none', paddingBottom: 0 }}>
          <span className="dash-post-type" style={{ background: 'var(--warning-alpha)', color: 'var(--warning)' }}>
            Collaborator Profile
          </span>
          <button className="icon-btn" onClick={onClose} aria-label="Close"><Icon name="close" /></button>
        </div>

        <div className="portal-modal-head">
          <Avatar
            src={application.applicantAvatar}
            name={application.applicantName || application.name}
            size={52}
          />
          <div className="portal-modal-head-info">
            <h3>{application.applicantName || application.name}</h3>
            <span>{application.applicantEmail || application.email}{application.applicantLocation ? ` · ${application.applicantLocation}` : ''}</span>
            {application.applicantHeadline && (
              <p style={{ margin: '2px 0 0', fontSize: 13, color: 'var(--text-muted)' }}>{application.applicantHeadline}</p>
            )}
          </div>
        </div>

        <div className="portal-modal-section">
          <h5>Application for Role</h5>
          <div className="portal-modal-box" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <b style={{ fontSize: 15, color: 'var(--text)' }}>{application.role || 'Collaborator'}</b>
              <div style={{ fontSize: 11.5, color: 'var(--text-faint)', marginTop: 2 }}>Applied {application.time}</div>
            </div>
            <StatusPill status={application.status} />
          </div>
          {application.message && (
            <div style={{ marginTop: 8, padding: '10px 14px', background: 'var(--bg)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
              <span className="muted" style={{ fontSize: 11, textTransform: 'uppercase', display: 'block', marginBottom: 2 }}>Pitch Message:</span>
              <p style={{ margin: 0, fontSize: 13, color: 'var(--text)' }}>{application.message}</p>
            </div>
          )}
        </div>

        <div className="portal-modal-section">
          <h5>Collaborator Profile Credentials</h5>
          <div className="portal-modal-box" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {application.applicantExperienceLevel && (
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', paddingBottom: 6 }}>
                <span className="muted">Experience Level:</span>
                <b>{application.applicantExperienceLevel}</b>
              </div>
            )}
            {application.applicantSkills && (
              <div>
                <span className="muted" style={{ display: 'block', marginBottom: 4 }}>Skills &amp; Tech Stack:</span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {application.applicantSkills.split(',').map((skill, idx) => (
                    <span key={idx} className="skill-tag" style={{ background: 'var(--accent-alpha)', color: 'var(--accent)' }}>
                      {skill.trim()}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {application.applicantBio && (
              <div>
                <span className="muted" style={{ display: 'block', marginBottom: 2 }}>Bio:</span>
                <p style={{ margin: 0, fontSize: 12.5, color: 'var(--text-muted)' }}>{application.applicantBio}</p>
              </div>
            )}
            {(application.applicantPortfolioLink || application.link) && (
              <div>
                <span className="muted">Portfolio / Link: </span>
                <a
                  href={application.applicantPortfolioLink || application.link}
                  target="_blank"
                  rel="noreferrer"
                  style={{ color: 'var(--accent)', fontWeight: 600 }}
                >
                  {application.applicantPortfolioLink || application.link}
                </a>
              </div>
            )}
            {application.applicantResume && (
              <div>
                <span className="muted">Resume / CV Document: </span>
                <a
                  href={application.applicantResume}
                  target="_blank"
                  rel="noreferrer"
                  style={{ color: 'var(--accent)', fontWeight: 600 }}
                >
                  View Uploaded Document &rarr;
                </a>
              </div>
            )}
          </div>
        </div>

        <div className="modal-actions" style={{ justifyContent: 'space-between', marginTop: 20 }}>
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={() => {
              onClose();
              navigate('/messages');
            }}
          >
            <Icon name="msg" /> Message Candidate
          </button>
          <div style={{ display: 'flex', gap: 8 }}>
            {application.status === 'pending' ? (
              <>
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  onClick={() => {
                    onDecline(application.id);
                    onClose();
                  }}
                >
                  Decline
                </button>
                <button
                  type="button"
                  className="btn btn-accent btn-sm"
                  onClick={() => {
                    onAccept(application.id);
                    onClose();
                  }}
                >
                  Confirm Candidate
                </button>
              </>
            ) : (
              <button type="button" className="btn btn-outline btn-sm" onClick={onClose}>Close</button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ==========================================
// 3. OVERVIEW & EDIT TAB
// ==========================================
function OverviewEditTab({ id, s, updateStartup, updateFunding, navigate }) {
  const [name, setName] = useState(s.name);
  const [tagline, setTagline] = useState(s.tagline || '');
  const [tags, setTags] = useState((s.tags || []).join(', '));
  const [overview, setOverview] = useState(s.overview || '');
  const [goal, setGoal] = useState(s.goal);
  const [status, setStatus] = useState(s.status);
  const [deadline, setDeadline] = useState(s.deadline || '');

  const pct = Math.min(100, Math.round((s.raised / (goal || 1)) * 100) || 0);

  async function handleSaveAll() {
    if (!name.trim()) throw new Error('Startup name is required.');
    await updateStartup(id, {
      name: name.trim(),
      tagline: tagline.trim(),
      tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
      overview: overview.trim(),
    });
    await updateFunding(id, {
      goal: Number(goal) || 0,
      status,
      deadline: deadline.trim(),
    });
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Live Preview Card */}
      <div className="settings-card" style={{ background: 'var(--bg-elevated)', borderLeft: '4px solid var(--accent)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <LogoBadge id={id} initials={s.initials} size={48} />
            <div>
              <h3 style={{ margin: 0, fontSize: 18 }}>{s.name} {s.verified && <Icon name="check" />}</h3>
              <p style={{ margin: '2px 0 0', fontSize: 13, color: 'var(--text-muted)' }}>{s.tagline || 'No tagline provided'}</p>
            </div>
          </div>
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={() => navigate(`/profile/${id}`)}
          >
            <Icon name="compass" /> View Public Page
          </button>
        </div>

        <div style={{ marginTop: 14 }}>
          <div className="gauge" style={{ marginBottom: 6 }}><span style={{ width: `${pct}%` }} /></div>
          <div className="funding-nums" style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5 }}>
            <span>Raised: <b>{fmtMoney(s.raised)}</b></span>
            <span className="muted">Goal: <b className="mono">{fmtMoney(s.goal)}</b></span>
            <span className="muted"><b>{pct}%</b> Funded</span>
          </div>
        </div>
      </div>

      {/* Edit Form */}
      <div className="settings-card">
        <h4>Edit Startup Information</h4>
        <div className="field">
          <label htmlFor="ed-name">Startup Name</label>
          <input id="ed-name" type="text" maxLength={140} value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="ed-tagline">Tagline (One-sentence pitch)</label>
          <input id="ed-tagline" type="text" maxLength={255} value={tagline} onChange={(e) => setTagline(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="ed-tags">Industry Tags (comma separated)</label>
          <input id="ed-tags" type="text" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="FinTech, Payments, SaaS" />
        </div>
        <div className="field">
          <label htmlFor="ed-overview">Overview / Full Pitch</label>
          <textarea id="ed-overview" rows="5" value={overview} onChange={(e) => setOverview(e.target.value)} />
        </div>

        <h4 style={{ marginTop: 24, paddingTop: 16, borderTop: '1px solid var(--border)' }}>Funding Configuration</h4>
        <div className="field">
          <label htmlFor="ed-goal">Funding Goal ($)</label>
          <input id="ed-goal" type="number" min="0" value={goal} onChange={(e) => setGoal(Number(e.target.value))} />
        </div>
        <div className="field">
          <label htmlFor="ed-status">Round Status</label>
          <select id="ed-status" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="soon">Opening soon</option>
            <option value="open">Open: accepting investments</option>
            <option value="closed">Closed</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="ed-deadline">Funding Deadline Label</label>
          <input id="ed-deadline" type="text" value={deadline} onChange={(e) => setDeadline(e.target.value)} placeholder="Closing in 30 days" />
        </div>

        <SaveButton onSave={handleSaveAll} label="Save Startup Changes" />
      </div>
    </div>
  );
}

// ==========================================
// 4. INVESTMENTS TAB (INVESTOR PORTAL)
// ==========================================
function InvestmentsPortalTab({ id, investments, setInvestmentStatus, onSelectInvestor, setNotice }) {
  const startupInvestments = investments.filter((i) => i.startupId === id);
  const pendingCount = startupInvestments.filter((i) => i.status === 'pending').length;

  async function handleAccept(invId, invName) {
    await setInvestmentStatus(invId, 'accepted');
    if (setNotice) setNotice(`✓ Investment accepted! Notification sent to ${invName || 'investor'}.`);
  }

  async function handleReject(invId, invName) {
    await setInvestmentStatus(invId, 'rejected');
    if (setNotice) setNotice(`Investment declined. Notification sent to ${invName || 'investor'}.`);
  }

  return (
    <div className="settings-card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
        <div>
          <h4 style={{ margin: 0 }}>Investment Portal &amp; Offers ({startupInvestments.length})</h4>
          <p className="settings-hint" style={{ margin: '2px 0 0' }}>
            Review incoming investment requests from angels and venture partners. Click any investor to open their portal.
          </p>
        </div>
        {pendingCount > 0 && (
          <span className="status-pill status-soon" style={{ fontWeight: 700 }}>
            {pendingCount} Pending Decision
          </span>
        )}
      </div>

      {startupInvestments.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '36px 16px', color: 'var(--text-muted)' }}>
          <Icon name="coin" style={{ width: 36, height: 36, opacity: 0.5, marginBottom: 8 }} />
          <p>No investment offers yet for this startup. Open your funding round to start receiving offers from investors.</p>
        </div>
      ) : (
        <div className="app-list">
          {startupInvestments.map((inv) => (
            <div className="portal-card" key={inv.id}>
              <div className="portal-card-header">
                <div className="portal-card-user">
                  <Avatar
                    src={inv.investorAvatar}
                    name={inv.investorName}
                    size={42}
                    onClick={() => onSelectInvestor(inv)}
                  />
                  <div className="portal-user-meta">
                    <b onClick={() => onSelectInvestor(inv)} title="Click to view Investor Portal">
                      {inv.investorName} <Icon name="arrow-r" style={{ width: 12, height: 12 }} />
                    </b>
                    <span>{inv.investorEmail} · {inv.time}</span>
                  </div>
                </div>
                <div className="portal-card-badge">
                  <span className="dash-post-type" style={{ fontSize: 11, background: 'var(--surface)', color: 'var(--text-muted)' }}>
                    {inv.investorType || 'Angel Investor'}
                  </span>
                  <StatusPill status={inv.status} />
                </div>
              </div>

              <div className="portal-card-content">
                <div className="portal-card-highlight">
                  <span>Investment Amount Requested:</span>
                  <b>{fmtMoney(inv.amount)}</b>
                </div>
                {inv.note && (
                  <p style={{ margin: '4px 0 0', fontStyle: 'italic', fontSize: 12.5 }}>
                    &ldquo;{inv.note}&rdquo;
                  </p>
                )}
              </div>

              <div className="portal-card-footer">
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  onClick={() => onSelectInvestor(inv)}
                >
                  <Icon name="user" /> View Investor Portal
                </button>
                {inv.status === 'pending' ? (
                  <DecisionButtons
                    declineLabel="Reject"
                    acceptLabel="Confirm Investment"
                    onDecline={() => handleReject(inv.id, inv.investorName)}
                    onAccept={() => handleAccept(inv.id, inv.investorName)}
                  />
                ) : (
                  <span style={{ fontSize: 12, color: 'var(--text-faint)' }}>
                    Decision finalized ({inv.status})
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ==========================================
// 5. COLLABORATION TAB (COLLABORATOR PORTAL)
// ==========================================
function CollaborationPortalTab({
  id, s, applications, setApplicationStatus, saveCollaboration, onSelectApplicant, setNotice,
}) {
  const [role, setRole] = useState(s.collab?.role || '');
  const [body, setBody] = useState(s.collab?.body || '');
  const [isOpen, setIsOpen] = useState(s.collab ? s.collab.isOpen : true);

  const collabApps = applications.filter((a) => a.startupId === id);
  const pendingCount = collabApps.filter((a) => a.status === 'pending').length;

  async function handleAccept(appId, candName) {
    await setApplicationStatus(appId, 'accepted');
    if (setNotice) setNotice(`✓ Collaborator accepted! Notification sent to ${candName || 'candidate'}.`);
  }

  async function handleDecline(appId, candName) {
    await setApplicationStatus(appId, 'declined');
    if (setNotice) setNotice(`Application declined. Notification sent to ${candName || 'candidate'}.`);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Role Management Card */}
      <div className="settings-card">
        <h4>Manage Open Collaboration Listing</h4>
        <p className="settings-hint">
          Publish an open role to recruit engineers, marketers, and operators who can apply from your startup page.
        </p>
        <div className="field">
          <label htmlFor="mc-role">Role Title</label>
          <input
            id="mc-role"
            type="text"
            placeholder="e.g. Lead Full-Stack Engineer (React & Django)"
            value={role}
            onChange={(e) => setRole(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="mc-body">Role Description &amp; Responsibilities</label>
          <textarea
            id="mc-body"
            rows="3"
            placeholder="What will this collaborator build or scale? Equity or stipend options."
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
        </div>
        <label className="field" style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
          <input type="checkbox" checked={isOpen} onChange={(e) => setIsOpen(e.target.checked)} />
          <span><b>Active Listing:</b> Accept applications on startup page</span>
        </label>
        <SaveButton onSave={() => saveCollaboration(id, { role, body, isOpen })} label="Save Collaboration Role" />
      </div>

      {/* Applicants List */}
      <div className="settings-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
          <div>
            <h4 style={{ margin: 0 }}>Collaborator Applicants ({collabApps.length})</h4>
            <p className="settings-hint" style={{ margin: '2px 0 0' }}>
              Click any candidate to inspect their verified skills, experience, portfolio, and message.
            </p>
          </div>
          {pendingCount > 0 && (
            <span className="status-pill status-soon" style={{ fontWeight: 700 }}>
              {pendingCount} Pending Decision
            </span>
          )}
        </div>

        {collabApps.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--text-muted)' }}>
            <Icon name="handshake" style={{ width: 36, height: 36, opacity: 0.5, marginBottom: 8 }} />
            <p>No collaboration applications yet. Make sure your role is active above!</p>
          </div>
        ) : (
          <div className="app-list">
            {collabApps.map((app) => (
              <div className="portal-card" key={app.id}>
                <div className="portal-card-header">
                  <div className="portal-card-user">
                    <Avatar
                      src={app.applicantAvatar}
                      name={app.applicantName || app.name}
                      size={42}
                      onClick={() => onSelectApplicant(app)}
                    />
                    <div className="portal-user-meta">
                      <b onClick={() => onSelectApplicant(app)} title="Click to view Collaborator Profile">
                        {app.applicantName || app.name} <Icon name="arrow-r" style={{ width: 12, height: 12 }} />
                      </b>
                      <span>{app.applicantEmail || app.email} · {app.time}</span>
                    </div>
                  </div>
                  <div className="portal-card-badge">
                    <span className="dash-post-type" style={{ fontSize: 11 }}>
                      {app.role || 'Collaborator'}
                    </span>
                    <StatusPill status={app.status} />
                  </div>
                </div>

                <div className="portal-card-content">
                  {app.message && <p style={{ margin: 0, fontSize: 13 }}>{app.message}</p>}
                  {app.applicantSkills && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
                      {app.applicantSkills.split(',').slice(0, 4).map((sk, i) => (
                        <span key={i} className="skill-tag" style={{ fontSize: 11 }}>{sk.trim()}</span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="portal-card-footer">
                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    onClick={() => onSelectApplicant(app)}
                  >
                    <Icon name="user" /> View Collaborator Profile
                  </button>
                  {app.status === 'pending' ? (
                    <DecisionButtons
                      declineLabel="Decline"
                      acceptLabel="Confirm Collaborator"
                      onDecline={() => handleDecline(app.id, app.applicantName || app.name)}
                      onAccept={() => handleAccept(app.id, app.applicantName || app.name)}
                    />
                  ) : (
                    <span style={{ fontSize: 12, color: 'var(--text-faint)' }}>
                      Decision finalized ({app.status})
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ==========================================
// 6. STARTUP POSTS TAB
// ==========================================
function StartupPostsTab({ id, posts, pinPost, deletePost, openCreatePost }) {
  const startupPosts = posts.filter((p) => p.startupId === id);

  return (
    <div className="settings-card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h4 style={{ margin: 0 }}>Startup Posts &amp; Sales Content ({startupPosts.length})</h4>
          <p className="settings-hint" style={{ margin: '2px 0 0' }}>
            All milestone updates, sales announcements, and partnership posts authored for this startup.
          </p>
        </div>
        <button type="button" className="btn btn-accent btn-sm" onClick={openCreatePost}>
          <Icon name="bolt" /> Create New Post
        </button>
      </div>

      {startupPosts.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '36px 16px', color: 'var(--text-muted)' }}>
          <Icon name="edit" style={{ width: 36, height: 36, opacity: 0.5, marginBottom: 8 }} />
          <p>No posts published yet for this startup. Share your first milestone or sales update with the community!</p>
          <button type="button" className="btn btn-outline btn-sm" style={{ marginTop: 10 }} onClick={openCreatePost}>
            Create Post Now
          </button>
        </div>
      ) : (
        <div>
          {startupPosts.map((p) => (
            <div className="dash-post-item" key={p.id}>
              <div className="dash-post-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className="dash-post-type">{p.postType || 'Update'}</span>
                  {p.pinned && (
                    <span className="status-pill status-open" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Icon name="pin" style={{ width: 12, height: 12 }} /> Pinned
                    </span>
                  )}
                </div>
                <span style={{ fontSize: 12, color: 'var(--text-faint)' }}>{p.timestamp}</span>
              </div>

              <h4 className="dash-post-title">{p.postTitle}</h4>
              <p className="dash-post-snippet">{p.postText}</p>

              {p.tags && p.tags.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
                  {p.tags.map((t, idx) => (
                    <span key={idx} className="skill-tag" style={{ fontSize: 11 }}>#{t}</span>
                  ))}
                </div>
              )}

              <div className="dash-post-actions">
                <span style={{ fontSize: 12.5, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Icon name="heart" style={{ width: 14, height: 14, color: 'var(--danger)' }} />
                  <b>{p.likesCount}</b> {p.likesCount === 1 ? 'like' : 'likes'}
                </span>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    onClick={() => pinPost(p.id, p.pinned)}
                  >
                    <Icon name="pin" /> {p.pinned ? 'Unpin' : 'Pin to top'}
                  </button>
                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    style={{ color: 'var(--danger)' }}
                    onClick={() => {
                      if (window.confirm('Are you sure you want to delete this post?')) {
                        deletePost(p.id);
                      }
                    }}
                  >
                    <Icon name="trash" /> Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ==========================================
// 7. ANALYTICS TAB
// ==========================================
function AnalyticsTab({ id, navigate }) {
  const max = Math.max(...WEEK_VIEWS.map(([, v]) => v));
  return (
    <div className="settings-card">
      <h4>Analytics &amp; Engagement</h4>
      <div className="stat-grid dash-stats" style={{ marginBottom: 24 }}>
        <div className="stat-tile"><b>1,284</b><span>Profile Views</span></div>
        <div className="stat-tile"><b>6,940</b><span>Post Impressions</span></div>
        <div className="stat-tile"><b>7.8%</b><span>Engagement Rate</span></div>
        <div className="stat-tile"><b>2.4k</b><span>Followers</span></div>
      </div>
      <h5 className="dash-chart-label">Profile views this week</h5>
      <div className="bar-chart" style={{ marginBottom: 24 }}>
        {WEEK_VIEWS.map(([day, val]) => (
          <div className="bar-col" key={day}>
            <div className="bar-track"><div className="bar-fill" style={{ height: `${Math.round((val / max) * 100)}%` }} /></div>
            <span className="bar-label">{day}</span>
          </div>
        ))}
      </div>

      <div style={{ padding: 20, background: 'var(--bg)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
        <h5 style={{ margin: '0 0 6px', fontSize: 16 }}>AI Business Analytics (DeepSeek)</h5>
        <p className="settings-hint" style={{ marginBottom: 14 }}>
          Upload your sales records, customer cohorts, and operating costings to generate interactive financial charts, health scoring, and strategic recommendations.
        </p>
        <button
          type="button"
          className="btn btn-accent btn-sm"
          onClick={() => navigate(`/statistics?startup=${id}`)}
        >
          <Icon name="chart" /> Open DeepSeek AI Statistics
        </button>
      </div>
    </div>
  );
}

// ==========================================
// 8. DANGER ZONE SETTINGS TAB
// ==========================================
function DangerZoneTab({ s, id, deleteStartup, navigate }) {
  const [confirmText, setConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  async function handleDelete() {
    setDeleting(true);
    setDeleteError('');
    try {
      await deleteStartup(id);
      navigate('/account');
    } catch (err) {
      setDeleteError(err.message || 'Could not delete this startup.');
      setDeleting(false);
    }
  }

  return (
    <div className="settings-card danger-zone">
      <h4>Delete Startup Permanently</h4>
      <p className="settings-hint">
        This permanently removes {s.name}, its posts, comments, documents, and pending requests. It cannot be undone.
        Startups with accepted investments cannot be deleted; close the funding round instead.
      </p>
      <div className="field">
        <label htmlFor="ss-confirm">Type <b>{s.name}</b> to confirm</label>
        <input id="ss-confirm" type="text" value={confirmText} onChange={(e) => setConfirmText(e.target.value)} autoComplete="off" />
      </div>
      <button
        type="button"
        className="btn btn-danger btn-sm"
        disabled={confirmText !== s.name || deleting}
        onClick={handleDelete}
      >
        {deleting ? 'Deleting…' : 'Delete startup permanently'}
      </button>
      {deleteError && <p className="modal-error" role="alert" style={{ marginTop: 10 }}>{deleteError}</p>}
    </div>
  );
}

// ==========================================
// MAIN COMPONENT: FOUNDER DASHBOARD
// ==========================================
export default function FounderDashboard() {
  const params = useParams();
  const navigate = useNavigate();
  const [section, setSection] = useState('overview');
  const [activeInvestorModal, setActiveInvestorModal] = useState(null);
  const [activeApplicantModal, setActiveApplicantModal] = useState(null);
  const [toastNotice, setToastNotice] = useState('');
  const [createStartupOpen, setCreateStartupOpen] = useState(false);

  const {
    currentUser, myStartups, startups, applications, investments, posts,
    setApplicationStatus, setInvestmentStatus,
    updateFunding, saveCollaboration, updateStartup, deleteStartup,
    pinPost, deletePost, openCreatePost,
  } = useApp();

  // Determine active startup ID:
  const activeId = useMemo(() => {
    if (params.id && startups[params.id]) return params.id;
    if (myStartups.length > 0) return myStartups[0][0];
    return null;
  }, [params.id, startups, myStartups]);

  const s = activeId ? startups[activeId] : null;
  const isOwner = !!s && s.ownerId === currentUser.id;

  function showToast(msg) {
    setToastNotice(msg);
    setTimeout(() => setToastNotice(''), 4000);
  }

  // If user owns no startups at all:
  if (myStartups.length === 0) {
    return (
      <div>
        <Topbar />
        <div className="layout layout-2col">
          <LeftNav />
          <main className="center-col settings-page">
            <div className="settings-card" style={{ maxWidth: 520, textAlign: 'center', padding: '40px 24px' }}>
              <Icon name="flag" style={{ width: 48, height: 48, color: 'var(--accent)', marginBottom: 12 }} />
              <h3 style={{ margin: '0 0 8px' }}>Manage Startup</h3>
              <p className="settings-hint" style={{ fontSize: 14, marginBottom: 20 }}>
                You haven&rsquo;t created a startup yet. Launch your startup page to open funding rounds, receive investment offers, recruit collaborators, and share milestone updates.
              </p>
              <button
                type="button"
                className="btn btn-accent btn-sm"
                onClick={() => setCreateStartupOpen(true)}
              >
                <Icon name="flag" /> Create Your Startup
              </button>
            </div>
          </main>
        </div>
        <CreateStartupModal open={createStartupOpen} onClose={() => setCreateStartupOpen(false)} />
      </div>
    );
  }

  // If startup specified in URL is not owned by this user:
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
                  ? "Only the founder who created this startup can access its management dashboard."
                  : "This startup doesn't exist — it may have been renamed or removed."}
              </p>
              <button
                type="button"
                className="btn btn-accent btn-sm"
                onClick={() => navigate(myStartups[0] ? `/dashboard/${myStartups[0][0]}` : '/account')}
              >
                Go to your startup dashboard
              </button>
            </div>
          </main>
        </div>
      </div>
    );
  }

  // Computed counts for badges:
  const pendingInvestments = investments.filter((i) => i.startupId === activeId && i.status === 'pending').length;
  const pendingApplications = applications.filter((a) => a.startupId === activeId && a.status === 'pending').length;
  const startupPostsCount = posts.filter((p) => p.startupId === activeId).length;

  return (
    <div>
      <Topbar />
      <div className="layout layout-2col">
        <LeftNav />
        <main className="center-col settings-page">
          {/* Topbar: Title and Switcher */}
          <div className="dash-topbar">
            <div>
              <h2 className="settings-title" style={{ margin: 0 }}>Manage {s.name}</h2>
              <span style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>
                Founder Control Center &amp; Investor / Collaborator Portal
              </span>
            </div>

            {myStartups.length > 1 && (
              <div className="dash-selector">
                <span style={{ fontSize: 12, color: 'var(--text-faint)' }}>Switch Startup:</span>
                <select
                  value={activeId}
                  onChange={(e) => navigate(`/dashboard/${e.target.value}`)}
                >
                  {myStartups.map(([slug, st]) => (
                    <option key={slug} value={slug}>{st.name}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <ReviewNotice startup={s} />

          {/* Quick Metrics Ribbon */}
          <div className="dash-metrics-ribbon">
            <div className="dash-metric-card">
              <span className="dash-metric-label">Raised / Goal</span>
              <span className="dash-metric-val">{fmtMoney(s.raised)}</span>
              <span className="dash-metric-sub">of {fmtMoney(s.goal)} ({Math.min(100, Math.round((s.raised / (s.goal || 1)) * 100))}% funded)</span>
            </div>
            <div className="dash-metric-card" style={{ cursor: 'pointer' }} onClick={() => setSection('investments')}>
              <span className="dash-metric-label">Investments</span>
              <span className="dash-metric-val" style={{ color: pendingInvestments > 0 ? 'var(--accent)' : 'inherit' }}>
                {investments.filter((i) => i.startupId === activeId).length}
              </span>
              <span className="dash-metric-sub">{pendingInvestments} pending decision</span>
            </div>
            <div className="dash-metric-card" style={{ cursor: 'pointer' }} onClick={() => setSection('collab')}>
              <span className="dash-metric-label">Collaborators</span>
              <span className="dash-metric-val" style={{ color: pendingApplications > 0 ? 'var(--warning)' : 'inherit' }}>
                {applications.filter((a) => a.startupId === activeId).length}
              </span>
              <span className="dash-metric-sub">{pendingApplications} pending review</span>
            </div>
            <div className="dash-metric-card" style={{ cursor: 'pointer' }} onClick={() => setSection('posts')}>
              <span className="dash-metric-label">Published Posts</span>
              <span className="dash-metric-val">{startupPostsCount}</span>
              <span className="dash-metric-sub">sales &amp; milestone updates</span>
            </div>
          </div>

          {toastNotice && (
            <div className="dash-toast" role="status">
              <Icon name="check" /> {toastNotice}
            </div>
          )}

          <div className="settings-shell">
            <nav className="settings-nav">
              {SECTIONS.map(([key, label]) => {
                let badge = 0;
                if (key === 'investments') badge = pendingInvestments;
                if (key === 'collab') badge = pendingApplications;
                return (
                  <button
                    key={key}
                    type="button"
                    className={`settings-nav-item${section === key ? ' active' : ''}`}
                    onClick={() => setSection(key)}
                    style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                  >
                    <span>{label}</span>
                    {badge > 0 && (
                      <span className="nav-badge" style={{ position: 'static', margin: 0, padding: '1px 6px' }}>
                        {badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>

            <div className="settings-panel">
              {section === 'overview' && (
                <OverviewEditTab
                  id={activeId}
                  s={s}
                  updateStartup={updateStartup}
                  updateFunding={updateFunding}
                  navigate={navigate}
                />
              )}

              {section === 'investments' && (
                <InvestmentsPortalTab
                  id={activeId}
                  investments={investments}
                  setInvestmentStatus={setInvestmentStatus}
                  onSelectInvestor={(inv) => setActiveInvestorModal(inv)}
                  setNotice={showToast}
                />
              )}

              {section === 'collab' && (
                <CollaborationPortalTab
                  id={activeId}
                  s={s}
                  applications={applications}
                  setApplicationStatus={setApplicationStatus}
                  saveCollaboration={saveCollaboration}
                  onSelectApplicant={(app) => setActiveApplicantModal(app)}
                  setNotice={showToast}
                />
              )}

              {section === 'posts' && (
                <StartupPostsTab
                  id={activeId}
                  posts={posts}
                  pinPost={pinPost}
                  deletePost={deletePost}
                  openCreatePost={openCreatePost}
                />
              )}

              {section === 'analytics' && <AnalyticsTab id={activeId} navigate={navigate} />}

              {section === 'settings' && (
                <DangerZoneTab s={s} id={activeId} deleteStartup={deleteStartup} navigate={navigate} />
              )}
            </div>
          </div>
        </main>
      </div>

      {/* Modals for Investor Portal and Collaborator Profile */}
      <InvestorPortalModal
        investment={activeInvestorModal}
        onClose={() => setActiveInvestorModal(null)}
        onAccept={(invId) => {
          setInvestmentStatus(invId, 'accepted');
          showToast(`✓ Investment accepted! Notification sent to investor.`);
        }}
        onReject={(invId) => {
          setInvestmentStatus(invId, 'rejected');
          showToast(`Investment declined. Notification sent to investor.`);
        }}
        navigate={navigate}
      />

      <CollaboratorProfileModal
        application={activeApplicantModal}
        onClose={() => setActiveApplicantModal(null)}
        onAccept={(appId) => {
          setApplicationStatus(appId, 'accepted');
          showToast(`✓ Collaborator accepted! Notification sent to candidate.`);
        }}
        onDecline={(appId) => {
          setApplicationStatus(appId, 'declined');
          showToast(`Application declined. Notification sent to candidate.`);
        }}
        navigate={navigate}
      />
    </div>
  );
}
