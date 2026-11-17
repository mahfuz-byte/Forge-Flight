import { useState, useMemo, useEffect, useCallback } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import Topbar from '../components/Topbar';
import LeftNav from '../components/LeftNav';
import LogoBadge from '../components/LogoBadge';
import Avatar from '../components/Avatar';
import { Icon } from '../components/IconSprite';
import { fmtMoney } from '../data/startups';
import { useApp } from '../context/AppContext';
import { api, mediaUrl } from '../api/client';
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
  ['analytics', 'Analytics & Reports'],
  ['settings', 'Danger Zone'],
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
    if (s?.reviewStatus !== 'approved' && status === 'open') {
      throw new Error('Your startup must be approved by an administrator before opening an investment round.');
    }
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
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={() => navigate(`/profile/${id}`)}
            >
              <Icon name="compass" /> View Public Page
            </button>
          </div>
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
            <option value="open" disabled={s?.reviewStatus !== 'approved'}>
              Open: accepting investments {s?.reviewStatus !== 'approved' ? '(Requires admin approval)' : ''}
            </option>
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
// CREATE / CONFIGURE INVESTMENT ROUND MODAL
// ==========================================
function CreateInvestmentRoundModal({ open, onClose, id, s, updateFunding, addPost, setNotice }) {
  const [roundStage, setRoundStage] = useState('Seed Round');
  const [goal, setGoal] = useState(s?.goal || '');
  const [status, setStatus] = useState(s?.status || 'open');
  const [deadline, setDeadline] = useState(s?.deadline || 'Closing in 30 days');
  const [minInvestment, setMinInvestment] = useState('500');
  const [pitch, setPitch] = useState('');
  const [announceOnFeed, setAnnounceOnFeed] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open && s) {
      setGoal(s.goal || '');
      setStatus(s.status || 'open');
      setDeadline(s.deadline || 'Closing in 30 days');
    }
  }, [open, s]);

  if (!open) return null;

  if (s?.reviewStatus !== 'approved') {
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
          <div className="modal-head">
            <h3>Open Investment Round</h3>
            <button className="icon-btn" onClick={onClose} aria-label="Close"><Icon name="close" /></button>
          </div>
          <div style={{ padding: '14px 16px', background: 'var(--warning-soft)', borderRadius: 8, border: '1px solid var(--warning)', margin: '14px 0', fontSize: 13.5 }}>
            <b style={{ display: 'block', marginBottom: 4 }}>Startup Verification Required</b>
            <p style={{ margin: 0, color: 'var(--text-muted)', lineHeight: 1.5 }}>
              Your startup is currently <b>{s?.reviewStatus === 'pending' ? 'Pending Admin Approval' : s?.reviewStatus}</b>. Startup registrations must be verified and approved by an administrator before opening an investment round or accepting capital.
            </p>
          </div>
          <div className="modal-actions">
            <button type="button" className="btn btn-outline btn-sm" onClick={onClose}>Close</button>
          </div>
        </div>
      </div>
    );
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const numGoal = Number(goal);
    if (!numGoal || numGoal <= 0) {
      setError('Please specify a funding goal greater than $0.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await updateFunding(id, {
        goal: numGoal,
        status,
        deadline: deadline.trim() || 'Closing soon',
      });

      if (announceOnFeed && addPost) {
        const postTitle = `${roundStage}: ${s.name} is raising ${fmtMoney(numGoal)}`;
        const postText = pitch.trim() ||
          `We are excited to announce our ${roundStage}! We are opening our funding round targeting ${fmtMoney(numGoal)} (${deadline}). Investors can review our documents and submit investment proposals directly on our page.`;
        await addPost({
          startupId: id,
          postType: 'Funding Announcement',
          postTitle,
          postText,
          tags: [...(s.tags || []), 'Funding', roundStage.replace(/\s+/g, '')],
        });
      }

      if (setNotice) setNotice(`✓ ${roundStage} saved and updated successfully!`);
      onClose();
    } catch (err) {
      setError(err.message || 'Could not save investment round.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel" style={{ maxWidth: 560 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span className="dash-post-type" style={{ background: 'var(--success-soft)', color: 'var(--success)' }}>
              Investment Round
            </span>
            <h3 style={{ margin: 0, fontSize: 18 }}>{s?.goal > 0 ? 'Configure Investment Round' : 'Create New Investment Round'}</h3>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Close"><Icon name="close" /></button>
        </div>

        <form onSubmit={handleSubmit} style={{ marginTop: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="field">
              <label htmlFor="ir-stage">Round Stage / Title</label>
              <select id="ir-stage" value={roundStage} onChange={(e) => setRoundStage(e.target.value)}>
                <option value="Pre-Seed Round">Pre-Seed Round</option>
                <option value="Seed Round">Seed Round</option>
                <option value="Series A Round">Series A Round</option>
                <option value="Bridge Round">Bridge Round</option>
                <option value="Strategic Round">Strategic Round</option>
                <option value="Community / Grant Round">Community / Grant Round</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="ir-status">Round Status</label>
              <select id="ir-status" value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="open">Open (Accepting investments)</option>
                <option value="soon">Opening soon (Pre-round)</option>
                <option value="closed">Closed (Round finished)</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="field">
              <label htmlFor="ir-goal">Target Funding Goal ($)</label>
              <input
                id="ir-goal"
                type="number"
                min="100"
                step="1000"
                placeholder="100000"
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
                required
              />
            </div>
            <div className="field">
              <label htmlFor="ir-deadline">Deadline / Timeframe</label>
              <input
                id="ir-deadline"
                type="text"
                placeholder="e.g. Closing in 30 days"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
              />
            </div>
          </div>

          <div className="field">
            <label htmlFor="ir-min">Minimum Ticket / Check Size ($) <span className="field-hint">(optional)</span></label>
            <input
              id="ir-min"
              type="number"
              min="50"
              step="50"
              placeholder="e.g. 500"
              value={minInvestment}
              onChange={(e) => setMinInvestment(e.target.value)}
            />
          </div>

          <div className="field">
            <label htmlFor="ir-pitch">Round Pitch &amp; Capital Allocation</label>
            <textarea
              id="ir-pitch"
              rows="3"
              placeholder="How will this capital be deployed? (e.g. Expanding pilot clinics, scaling infrastructure, hiring core engineers)"
              value={pitch}
              onChange={(e) => setPitch(e.target.value)}
            />
          </div>

          <label className="field" style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', margin: '14px 0' }}>
            <input
              type="checkbox"
              checked={announceOnFeed}
              onChange={(e) => setAnnounceOnFeed(e.target.checked)}
            />
            <span style={{ fontSize: 13 }}>
              <b>Announce on Platform Feed:</b> Automatically publish a &ldquo;Funding Announcement&rdquo; post so investors discover this round.
            </span>
          </label>

          {error && <p className="modal-error" style={{ marginBottom: 12 }}>{error}</p>}

          <div className="modal-actions" style={{ justifyContent: 'flex-end', gap: 10 }}>
            <button type="button" className="btn btn-outline btn-sm" onClick={onClose} disabled={busy}>Cancel</button>
            <button type="submit" className="btn btn-accent btn-sm" disabled={busy}>
              {busy ? 'Saving Round…' : s?.goal > 0 ? 'Update Investment Round' : 'Launch Investment Round'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ==========================================
// 4. INVESTMENTS TAB (INVESTOR PORTAL)
// ==========================================
function InvestmentsPortalTab({ id, s, investments, setInvestmentStatus, updateFunding, addPost, onSelectInvestor, setNotice }) {
  const [roundModalOpen, setRoundModalOpen] = useState(false);
  const startupInvestments = investments.filter((i) => i.startupId === id);
  const pendingCount = startupInvestments.filter((i) => i.status === 'pending').length;

  const pct = Math.min(100, Math.round(((s?.raised || 0) / (s?.goal || 1)) * 100));
  const hasActiveRound = (s?.goal || 0) > 0;

  async function handleAccept(invId, invName) {
    await setInvestmentStatus(invId, 'accepted');
    if (setNotice) setNotice(`✓ Investment accepted! Notification sent to ${invName || 'investor'}.`);
  }

  async function handleReject(invId, invName) {
    await setInvestmentStatus(invId, 'rejected');
    if (setNotice) setNotice(`Investment declined. Notification sent to ${invName || 'investor'}.`);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {s?.reviewStatus !== 'approved' && (
        <div style={{ padding: '12px 14px', background: 'var(--warning-soft)', border: '1px solid var(--warning)', borderRadius: 8, fontSize: 13 }}>
          <b>Startup Verification Required:</b> Your startup is currently <b>{s?.reviewStatus === 'pending' ? 'Pending Admin Approval' : s?.reviewStatus}</b>. Investment rounds cannot be launched or funded until approved by an administrator.
        </div>
      )}
      {/* Investment Round Management Card */}
      <div className="settings-card" style={{ background: 'var(--bg-elevated)', borderLeft: '4px solid var(--accent)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12, marginBottom: 12 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <span className={`status-pill ${s?.status === 'open' ? 'status-open' : s?.status === 'soon' ? 'status-soon' : 'status-closed'}`}>
                {s?.status === 'open' ? 'Funding Open' : s?.status === 'soon' ? 'Opening Soon' : 'Funding Closed'}
              </span>
              <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{s?.deadline || 'No deadline set'}</span>
            </div>
            <h4 style={{ margin: 0, fontSize: 18 }}>Investment Round Status</h4>
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn btn-accent btn-sm"
              onClick={() => setRoundModalOpen(true)}
            >
              <Icon name="bolt" /> {hasActiveRound ? 'Edit Investment Round' : 'Create New Investment Round'}
            </button>
          </div>
        </div>

        {hasActiveRound ? (
          <div>
            <div className="gauge" style={{ marginBottom: 8, height: 8 }}>
              <span style={{ width: `${pct}%` }} />
            </div>
            <div className="funding-nums" style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, flexWrap: 'wrap', gap: 8 }}>
              <span>Capital Raised: <b style={{ color: 'var(--accent)' }}>{fmtMoney(s.raised)}</b></span>
              <span>Target Goal: <b className="mono">{fmtMoney(s.goal)}</b></span>
              <span className="muted"><b>{pct}%</b> Funded ({startupInvestments.filter((i) => i.status === 'accepted').length} confirmed deals)</span>
            </div>
          </div>
        ) : (
          <div style={{ padding: '16px 18px', background: 'var(--bg)', borderRadius: 'var(--radius-sm)', border: '1px dashed var(--border)', marginTop: 8 }}>
            <p style={{ margin: '0 0 10px', fontSize: 13.5, color: 'var(--text-muted)' }}>
              You haven&rsquo;t configured an active investment round yet. Create an investment round to set your funding target ($), define deadlines, and allow investors to submit term offers.
            </p>
            <button
              type="button"
              className="btn btn-accent btn-sm"
              onClick={() => setRoundModalOpen(true)}
            >
              <Icon name="bolt" /> Create New Investment Round
            </button>
          </div>
        )}
      </div>

      {/* Offers & Requests Card */}
      <div className="settings-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
          <div>
            <h4 style={{ margin: 0 }}>Investment Offers &amp; Requests ({startupInvestments.length})</h4>
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
            <p>No investment offers yet for this startup. Make sure your investment round is set to &ldquo;Open&rdquo; above to receive proposals.</p>
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

      <CreateInvestmentRoundModal
        open={roundModalOpen}
        onClose={() => setRoundModalOpen(false)}
        id={id}
        s={s}
        updateFunding={updateFunding}
        addPost={addPost}
        setNotice={setNotice}
      />
    </div>
  );
}

// ==========================================
// CREATE / EDIT COLLABORATION ROUND MODAL
// ==========================================
function CreateCollaborationRoundModal({ open, onClose, id, s, saveCollaboration, addPost, setNotice }) {
  const [role, setRole] = useState(s?.collab?.role || '');
  const [collabType, setCollabType] = useState('Equity + Stipend');
  const [skills, setSkills] = useState('');
  const [body, setBody] = useState(s?.collab?.body || '');
  const [isOpen, setIsOpen] = useState(s?.collab ? s.collab.isOpen : true);
  const [announceOnFeed, setAnnounceOnFeed] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open && s?.collab) {
      setRole(s.collab.role || '');
      setBody(s.collab.body || '');
      setIsOpen(s.collab.isOpen !== false);
    }
  }, [open, s]);

  if (!open) return null;

  if (s?.reviewStatus !== 'approved') {
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
          <div className="modal-head">
            <h3>Open Collaboration Round</h3>
            <button className="icon-btn" onClick={onClose} aria-label="Close"><Icon name="close" /></button>
          </div>
          <div style={{ padding: '14px 16px', background: 'var(--warning-soft)', borderRadius: 8, border: '1px solid var(--warning)', margin: '14px 0', fontSize: 13.5 }}>
            <b style={{ display: 'block', marginBottom: 4 }}>Startup Verification Required</b>
            <p style={{ margin: 0, color: 'var(--text-muted)', lineHeight: 1.5 }}>
              Your startup is currently <b>{s?.reviewStatus === 'pending' ? 'Pending Admin Approval' : s?.reviewStatus}</b>. Startup registrations must be verified and approved by an administrator before creating a collaboration round or recruiting team members.
            </p>
          </div>
          <div className="modal-actions">
            <button type="button" className="btn btn-outline btn-sm" onClick={onClose}>Close</button>
          </div>
        </div>
      </div>
    );
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!role.trim()) {
      setError('Please provide a role title.');
      return;
    }
    if (!body.trim()) {
      setError('Please provide a role description and responsibilities.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const formattedBody = skills.trim()
        ? `${body.trim()}\n\n[Compensation / Type]: ${collabType}\n[Target Skills]: ${skills.trim()}`
        : `${body.trim()}\n\n[Compensation / Type]: ${collabType}`;

      await saveCollaboration(id, {
        role: role.trim(),
        body: formattedBody,
        isOpen,
      });

      if (announceOnFeed && addPost && isOpen) {
        const postTitle = `We're recruiting: ${role.trim()}`;
        const postText = `Join the ${s.name} team! We have opened a new collaboration opportunity for a ${role.trim()} (${collabType}).\n\n${body.trim()}`;
        const parsedTags = skills.split(',').map((t) => t.trim()).filter(Boolean);
        await addPost({
          startupId: id,
          postType: 'Collaboration Post',
          postTitle,
          postText,
          tags: [...(s.tags || []), 'Hiring', 'Collaboration', ...parsedTags],
        });
      }

      if (setNotice) setNotice(`✓ Collaboration round for "${role.trim()}" saved successfully!`);
      onClose();
    } catch (err) {
      setError(err.message || 'Could not save collaboration round.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel" style={{ maxWidth: 560 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span className="dash-post-type" style={{ background: 'var(--info-soft)', color: 'var(--info)' }}>
              Collaboration Round
            </span>
            <h3 style={{ margin: 0, fontSize: 18 }}>{s?.collab?.role ? 'Edit Collaboration Role' : 'Create New Collaboration Round / Role'}</h3>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Close"><Icon name="close" /></button>
        </div>

        <form onSubmit={handleSubmit} style={{ marginTop: 14 }}>
          <div className="field">
            <label htmlFor="cr-role">Role Title</label>
            <input
              id="cr-role"
              type="text"
              placeholder="e.g. Lead Full-Stack Engineer, AI Researcher, Growth Lead"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              required
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="field">
              <label htmlFor="cr-type">Collaboration &amp; Compensation Type</label>
              <select id="cr-type" value={collabType} onChange={(e) => setCollabType(e.target.value)}>
                <option value="Equity + Stipend">Equity + Stipend</option>
                <option value="Equity Only (Co-Founder)">Equity Only (Co-Founder)</option>
                <option value="Paid Contract / Milestone">Paid Contract / Milestone</option>
                <option value="Revenue Share">Revenue Share</option>
                <option value="Advisory / Part-Time">Advisory / Part-Time</option>
                <option value="Internship / Fellowship">Internship / Fellowship</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="cr-skills">Key Skills Needed</label>
              <input
                id="cr-skills"
                type="text"
                placeholder="e.g. React, Django, ML, Ops"
                value={skills}
                onChange={(e) => setSkills(e.target.value)}
              />
            </div>
          </div>

          <div className="field">
            <label htmlFor="cr-body">Role Description &amp; What They Will Build</label>
            <textarea
              id="cr-body"
              rows="4"
              placeholder="Describe the problem, responsibilities, technical stack, or deliverables the candidate will own."
              value={body}
              onChange={(e) => setBody(e.target.value)}
              required
            />
          </div>

          <label className="field" style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', margin: '10px 0 6px' }}>
            <input
              type="checkbox"
              checked={isOpen}
              onChange={(e) => setIsOpen(e.target.checked)}
            />
            <span style={{ fontSize: 13 }}>
              <b>Active Listing:</b> Accept candidate applications on your public startup page.
            </span>
          </label>

          <label className="field" style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', margin: '0 0 14px' }}>
            <input
              type="checkbox"
              checked={announceOnFeed}
              onChange={(e) => setAnnounceOnFeed(e.target.checked)}
            />
            <span style={{ fontSize: 13 }}>
              <b>Announce on Platform Feed:</b> Publish a &ldquo;Collaboration Post&rdquo; so builders across the community can discover and apply.
            </span>
          </label>

          {error && <p className="modal-error" style={{ marginBottom: 12 }}>{error}</p>}

          <div className="modal-actions" style={{ justifyContent: 'flex-end', gap: 10 }}>
            <button type="button" className="btn btn-outline btn-sm" onClick={onClose} disabled={busy}>Cancel</button>
            <button type="submit" className="btn btn-accent btn-sm" disabled={busy}>
              {busy ? 'Saving Role…' : s?.collab?.role ? 'Update Collaboration Role' : 'Publish Collaboration Role'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ==========================================
// 5. COLLABORATION TAB (COLLABORATOR PORTAL)
// ==========================================
function CollaborationPortalTab({
  id, s, applications, setApplicationStatus, saveCollaboration, addPost,
  onSelectApplicant, setNotice,
}) {
  const [collabModalOpen, setCollabModalOpen] = useState(false);
  const collabApps = applications.filter((a) => a.startupId === id);
  const pendingCount = collabApps.filter((a) => a.status === 'pending').length;

  const hasRole = !!s?.collab?.role;

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
      {s?.reviewStatus !== 'approved' && (
        <div style={{ padding: '12px 14px', background: 'var(--warning-soft)', border: '1px solid var(--warning)', borderRadius: 8, fontSize: 13 }}>
          <b>Startup Verification Required:</b> Your startup is currently <b>{s?.reviewStatus === 'pending' ? 'Pending Admin Approval' : s?.reviewStatus}</b>. Collaboration rounds cannot be launched or recruited for until approved by an administrator.
        </div>
      )}
      {/* Collaboration Round / Role Status Card */}
      <div className="settings-card" style={{ background: 'var(--bg-elevated)', borderLeft: '4px solid var(--info)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12, marginBottom: 12 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <span className={`status-pill ${hasRole && s?.collab?.isOpen ? 'status-open' : 'status-closed'}`}>
                {hasRole && s?.collab?.isOpen ? 'Active Listing' : hasRole ? 'Paused / Closed' : 'No Open Listing'}
              </span>
              <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                {collabApps.length} total applicant{collabApps.length === 1 ? '' : 's'}
              </span>
            </div>
            <h4 style={{ margin: 0, fontSize: 18 }}>Collaboration Round &amp; Roles</h4>
          </div>

          <button
            type="button"
            className="btn btn-accent btn-sm"
            onClick={() => setCollabModalOpen(true)}
          >
            <Icon name="handshake" /> {hasRole ? 'Edit Collaboration Role' : 'Create Collaboration Round'}
          </button>
        </div>

        {hasRole ? (
          <div style={{ padding: '14px 18px', background: 'var(--bg)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <b style={{ fontSize: 15, color: 'var(--text)' }}>{s.collab.role}</b>
              <span style={{ fontSize: 12, color: s.collab.isOpen ? 'var(--success)' : 'var(--text-faint)' }}>
                {s.collab.isOpen ? '✓ Accepting applications on startup page' : 'Listing is currently paused'}
              </span>
            </div>
            <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)', whiteSpace: 'pre-wrap' }}>
              {s.collab.body}
            </p>
          </div>
        ) : (
          <div style={{ padding: '16px 18px', background: 'var(--bg)', borderRadius: 'var(--radius-sm)', border: '1px dashed var(--border)', marginTop: 8 }}>
            <p style={{ margin: '0 0 10px', fontSize: 13.5, color: 'var(--text-muted)' }}>
              No open collaboration roles right now. Launch a collaboration round to recruit co-founders, specialized developers, product designers, or marketers.
            </p>
            <button
              type="button"
              className="btn btn-accent btn-sm"
              onClick={() => setCollabModalOpen(true)}
            >
              <Icon name="handshake" /> Create Collaboration Round
            </button>
          </div>
        )}
      </div>

      {/* Applicants List Card */}
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

      <CreateCollaborationRoundModal
        open={collabModalOpen}
        onClose={() => setCollabModalOpen(false)}
        id={id}
        s={s}
        saveCollaboration={saveCollaboration}
        addPost={addPost}
        setNotice={setNotice}
      />
    </div>
  );
}

// ==========================================
// 6. STARTUP POSTS TAB
// ==========================================
function StartupPostsTab({ id, s, posts, pinPost, deletePost, openCreatePost }) {
  const startupPosts = posts.filter((p) => p.startupId === id);
  const isApproved = s?.reviewStatus === 'approved';

  return (
    <div className="settings-card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h4 style={{ margin: 0 }}>Startup Posts &amp; Sales Content ({startupPosts.length})</h4>
          <p className="settings-hint" style={{ margin: '2px 0 0' }}>
            All milestone updates, sales announcements, and partnership posts authored for this startup.
          </p>
        </div>
        {isApproved && (
          <button type="button" className="btn btn-accent btn-sm" onClick={openCreatePost}>
            <Icon name="bolt" /> Create New Post
          </button>
        )}
      </div>

      {!isApproved && (
        <div style={{ padding: '12px 14px', background: 'var(--warning-soft)', border: '1px solid var(--warning)', borderRadius: 8, marginBottom: 16, fontSize: 13 }}>
          <b>Startup Verification Required:</b> Your startup is currently <b>{s?.reviewStatus === 'pending' ? 'Pending Admin Approval' : s?.reviewStatus}</b>. Posts and announcements cannot be published until verified and approved by an administrator.
        </div>
      )}

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
// 7. ANALYTICS TAB (FINANCIAL RECORDS & MONTHLY PERFORMANCE)
// ==========================================
function AnalyticsTab({ id, s, posts, investments, applications, navigate, openCreatePost }) {
  const [reports, setReports] = useState([]);
  const [loadingStats, setLoadingStats] = useState(true);
  const [fileToUpload, setFileToUpload] = useState(null);
  const [reportingPeriod, setReportingPeriod] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [uploadSuccess, setUploadSuccess] = useState('');

  const loadReports = useCallback(() => {
    setLoadingStats(true);
    api.get(`/statistics/?startup=${id}`)
      .then((data) => {
        const list = Array.isArray(data) ? data : data.results || [];
        setReports(list);
      })
      .catch(() => {
        setReports([]);
      })
      .finally(() => {
        setLoadingStats(false);
      });
  }, [id]);

  useEffect(() => {
    loadReports();
  }, [loadReports]);

  const startupPosts = (posts || []).filter((p) => p.startupId === id);
  const totalLikes = startupPosts.reduce((acc, p) => acc + (p.likesCount || 0), 0);
  const totalComments = startupPosts.reduce((acc, p) => acc + (p.commentsCount || 0), 0);
  const startupInvestments = (investments || []).filter((i) => i.startupId === id);
  const startupApplications = (applications || []).filter((a) => a.startupId === id);

  const latestReport = reports[0];
  
  // Consolidate financials across all uploaded reports
  const aggregatedSummary = useMemo(() => {
    if (!reports || reports.length === 0) return null;
    const timelineMap = new Map();
    let totalSales = 0;
    let totalCosts = 0;

    reports.forEach((rep) => {
      const r = rep.raw_summary || {};
      (r.monthly_timeline || []).forEach((m) => {
        const p = m.period || m.month || 'Period';
        if (!timelineMap.has(p)) {
          timelineMap.set(p, {
            period: p,
            sales: Number(m.sales) || 0,
            costs: Number(m.costs) || 0,
            profit: Number(m.profit) || ((Number(m.sales) || 0) - (Number(m.costs) || 0)),
          });
        } else {
          const prev = timelineMap.get(p);
          prev.sales = Math.max(prev.sales, Number(m.sales) || 0);
          prev.costs = Math.max(prev.costs, Number(m.costs) || 0);
          prev.profit = prev.sales - prev.costs;
        }
      });
    });

    const timeline = Array.from(timelineMap.values());
    if (timeline.length > 0) {
      totalSales = Math.round(timeline.reduce((acc, t) => acc + t.sales, 0) * 100) / 100;
      totalCosts = Math.round(timeline.reduce((acc, t) => acc + t.costs, 0) * 100) / 100;
    } else {
      totalSales = Math.round(reports.reduce((acc, r) => acc + (r.raw_summary?.total_sales || 0), 0) * 100) / 100;
      totalCosts = Math.round(reports.reduce((acc, r) => acc + (r.raw_summary?.total_costs || 0), 0) * 100) / 100;
    }

    const netProfit = Math.round((totalSales - totalCosts) * 100) / 100;
    const profitMargin = totalSales > 0 ? Math.round((netProfit / totalSales) * 1000) / 10 : 0;
    const totalCustomers = reports.reduce((acc, r) => acc + (r.raw_summary?.total_customers || 0), 0);

    return {
      total_sales: totalSales,
      total_costs: totalCosts,
      net_profit: netProfit,
      profit_margin: profitMargin,
      total_customers: totalCustomers,
      monthly_timeline: timeline,
    };
  }, [reports]);

  const rawSummary = aggregatedSummary || latestReport?.raw_summary;
  const timeline = rawSummary?.monthly_timeline || [];
  const hasFinancialInput = reports.length > 0 && !!rawSummary && typeof rawSummary.total_sales === 'number';
  const hasCommunityInput = startupPosts.length > 0 || startupInvestments.length > 0 || startupApplications.length > 0;

  const maxTimelineVal = timeline.length > 0
    ? Math.max(...timeline.map((m) => Math.max(m.sales || 0, m.costs || 0)), 1)
    : 1;

  async function handleUploadFile(e) {
    e.preventDefault();
    if (s?.reviewStatus !== 'approved') {
      setUploadError('Your startup is waiting to be approved. Financial statements cannot be uploaded until approved by an administrator.');
      return;
    }
    if (!fileToUpload) return;
    setUploading(true);
    setUploadError('');
    setUploadSuccess('');

    const formData = new FormData();
    formData.append('file', fileToUpload);
    formData.append('startup_slug', id);
    if (reportingPeriod.trim()) {
      formData.append('reporting_period', reportingPeriod.trim());
    }

    try {
      await api.post('/statistics/', formData);
      setUploadSuccess('Monthly financial report uploaded and published successfully!');
      setFileToUpload(null);
      setReportingPeriod('');
      loadReports();
    } catch (err) {
      setUploadError(err.message || 'Failed to upload report.');
    } finally {
      setUploading(false);
    }
  }

  async function handleDeleteReport(reportId, reportName) {
    if (!window.confirm(`Delete "${reportName}"? This will remove the file and update the business profile statistics.`)) return;
    try {
      await api.delete(`/statistics/${reportId}/`);
      loadReports();
    } catch (err) {
      alert(err.message || 'Could not delete report.');
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Real Activity & Community Metrics */}
      <div className="settings-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
          <div>
            <h4 style={{ margin: 0 }}>Community Engagement &amp; Activity</h4>
            <p className="settings-hint" style={{ margin: '2px 0 0' }}>
              Real-time activity recorded from your published posts, community discussions, and incoming offers.
            </p>
          </div>
          {startupPosts.length > 0 && (
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={() => openCreatePost(id)}
            >
              <Icon name="edit" /> New Update
            </button>
          )}
        </div>

        {hasCommunityInput ? (
          <div className="stat-grid dash-stats" style={{ marginBottom: 12 }}>
            <div className="stat-tile">
              <b>{startupPosts.length}</b>
              <span>Published Posts</span>
            </div>
            <div className="stat-tile">
              <b>{totalLikes}</b>
              <span>Post Likes</span>
            </div>
            <div className="stat-tile">
              <b>{totalComments}</b>
              <span>Discussion Comments</span>
            </div>
            <div className="stat-tile">
              <b>{startupInvestments.length}</b>
              <span>Investment Requests</span>
            </div>
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '28px 16px', background: 'var(--bg)', borderRadius: 'var(--radius-md)', border: '1px dashed var(--border)' }}>
            <Icon name="chart" style={{ width: 36, height: 36, opacity: 0.4, marginBottom: 8, color: 'var(--accent)' }} />
            <h5 style={{ margin: '0 0 4px', fontSize: 15 }}>No Community Activity Yet</h5>
            <p className="settings-hint" style={{ maxWidth: 440, margin: '0 auto 16px', fontSize: 13 }}>
              Publish your first milestone, prototype demo, or funding announcement to begin collecting likes, comments, and engagement.
            </p>
            <button
              type="button"
              className="btn btn-accent btn-sm"
              onClick={() => openCreatePost(id)}
            >
              <Icon name="edit" /> Publish First Post
            </button>
          </div>
        )}
      </div>

      {/* Financial Records Management Card */}
      <div className="settings-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h4 style={{ margin: 0 }}>Monthly Financial &amp; Sales Records</h4>
            <p className="settings-hint" style={{ margin: '4px 0 0', maxWidth: 600 }}>
              Provide your monthly sales, revenue, and operating costs. These records and CSV files are published directly to your public business profile and will be evaluated by the platform&rsquo;s AI Research engine for investors.
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={() => window.open('/api/statistics/sample-csv/', '_blank')}
            >
              <Icon name="doc" /> Sample CSV
            </button>
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={() => navigate(`/profile/${id}#documents`)}
            >
              <Icon name="doc" /> Published Documents
            </button>
          </div>
        </div>

        {/* Upload Form */}
        {s?.reviewStatus !== 'approved' ? (
          <div style={{ padding: '14px 16px', background: 'var(--warning-soft)', border: '1px solid var(--warning)', borderRadius: 8, marginBottom: 20, fontSize: 13 }}>
            <b>Startup Verification Required:</b> This startup is currently <b>Waiting for Admin Approval</b>. Financial records and CSV statements cannot be uploaded or published until verified and approved by an administrator.
          </div>
        ) : (
          <form onSubmit={handleUploadFile} style={{ background: 'var(--bg)', padding: 16, borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', marginBottom: 20 }}>
            <h5 style={{ margin: '0 0 10px', fontSize: 14 }}>Upload Monthly Records (CSV or PDF)</h5>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12, alignItems: 'flex-end' }}>
              <div className="field" style={{ margin: 0 }}>
                <label htmlFor="fin-file" style={{ fontSize: 12.5 }}>Select File (.csv or .pdf)</label>
                <input
                  id="fin-file"
                  type="file"
                  accept=".csv,.pdf"
                  onChange={(e) => setFileToUpload(e.target.files?.[0] || null)}
                  required
                />
              </div>
              <div className="field" style={{ margin: 0 }}>
                <label htmlFor="fin-period" style={{ fontSize: 12.5 }}>Reporting Period (Optional, e.g. May 2026)</label>
                <input
                  id="fin-period"
                  type="text"
                  placeholder="e.g. Q2 2026 or May 2026"
                  value={reportingPeriod}
                  onChange={(e) => setReportingPeriod(e.target.value)}
                />
              </div>
              <div>
                <button
                  type="submit"
                  className="btn btn-accent btn-sm"
                  disabled={uploading || !fileToUpload}
                  style={{ height: 38, width: '100%' }}
                >
                  {uploading ? 'Processing Data…' : 'Publish Report'}
                </button>
              </div>
            </div>
            {uploadError && <p className="modal-error" style={{ marginTop: 10 }}>{uploadError}</p>}
            {uploadSuccess && <p style={{ color: 'var(--success)', fontSize: 13, marginTop: 10, margin: 0 }}>✓ {uploadSuccess}</p>}
          </form>
        )}

        {loadingStats ? (
          <p className="settings-hint">Loading financial statistics…</p>
        ) : hasFinancialInput ? (
          <>
            {/* KPI Cards */}
            <div className="stat-grid dash-stats" style={{ marginBottom: 20 }}>
              <div className="stat-tile">
                <b>${(rawSummary.total_sales || 0).toLocaleString()}</b>
                <span>Total Revenue</span>
              </div>
              <div className="stat-tile">
                <b>${(rawSummary.total_costs || 0).toLocaleString()}</b>
                <span>Operating Costs</span>
              </div>
              <div className="stat-tile">
                <b style={{ color: (rawSummary.net_profit || 0) >= 0 ? 'var(--success)' : 'var(--accent)' }}>
                  ${(rawSummary.net_profit || 0).toLocaleString()}
                </b>
                <span>Net Profit / Income</span>
              </div>
              <div className="stat-tile">
                <b>{rawSummary.profit_margin || 0}%</b>
                <span>Profit Margin</span>
              </div>
            </div>

            {/* Monthly Timeline Chart */}
            {timeline.length > 0 && (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <h5 style={{ margin: 0, fontSize: 14 }}>Monthly Revenue vs Operating Costs</h5>
                  <div style={{ display: 'flex', gap: 12, fontSize: 12 }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                      <span style={{ width: 10, height: 10, background: 'var(--accent)', borderRadius: 2 }} /> Revenue
                    </span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                      <span style={{ width: 10, height: 10, background: '#ef4444', borderRadius: 2 }} /> Costs
                    </span>
                  </div>
                </div>

                <div className="bar-chart" style={{ marginBottom: 20 }}>
                  {timeline.map((item, idx) => (
                    <div className="bar-col" key={item.period || item.month || idx}>
                      <div className="bar-track" title={`Period: ${item.period || item.month}\nRevenue: $${(item.sales || 0).toLocaleString()}\nCosts: $${(item.costs || 0).toLocaleString()}`}>
                        <div
                          className="bar-fill"
                          style={{
                            height: `${Math.max(4, Math.round(((item.sales || 0) / maxTimelineVal) * 100))}%`,
                            background: 'var(--accent)',
                          }}
                        />
                      </div>
                      <span className="bar-label">{item.period || item.month}</span>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* Published Reports Table */}
            <h5 style={{ margin: '16px 0 10px', fontSize: 14 }}>Published Financial Files ({reports.length})</h5>
            <div style={{ overflowX: 'auto' }}>
              <table className="data-preview-table" style={{ width: '100%', fontSize: 13 }}>
                <thead>
                  <tr>
                    <th>File Name</th>
                    <th>Type</th>
                    <th>Period</th>
                    <th>Upload Date</th>
                    <th>Records</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {reports.map((r) => (
                    <tr key={r.id}>
                      <td>
                        <span style={{ fontWeight: 600 }}>{r.original_filename}</span>
                      </td>
                      <td style={{ textTransform: 'uppercase' }}>{r.file_type}</td>
                      <td>{r.reporting_period || 'Standard'}</td>
                      <td>{new Date(r.created_at).toLocaleDateString()}</td>
                      <td>{r.raw_summary?.rows_count || 'Parsed'} rows</td>
                      <td>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                          {r.file_url && (
                            <a
                              href={mediaUrl(r.file_url)}
                              download={r.original_filename || 'financial_report.csv'}
                              target="_blank"
                              rel="noreferrer"
                              className="btn btn-outline btn-xs"
                              title="Download or view file"
                            >
                              <Icon name="doc" /> Download
                            </a>
                          )}
                          <button
                            type="button"
                            className="btn btn-outline btn-xs"
                            style={{ color: '#ef4444', borderColor: '#ef4444' }}
                            onClick={() => handleDeleteReport(r.id, r.original_filename)}
                          >
                            <Icon name="trash" /> Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <div style={{ textAlign: 'center', padding: '28px 16px', background: 'var(--bg)', borderRadius: 'var(--radius-md)', border: '1px dashed var(--border)' }}>
            <Icon name="doc" style={{ width: 36, height: 36, opacity: 0.4, marginBottom: 8, color: 'var(--info)' }} />
            <h5 style={{ margin: '0 0 4px', fontSize: 15 }}>No Financial Records Published Yet</h5>
            <p className="settings-hint" style={{ maxWidth: 460, margin: '0 auto 16px', fontSize: 13 }}>
              Upload your startup&rsquo;s sales transactions, operating expenses, or monthly income statements above to publish verified metrics for investors and public visitors.
            </p>
          </div>
        )}
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
  const location = useLocation();
  const [section, setSection] = useState('overview');
  const [activeInvestorModal, setActiveInvestorModal] = useState(null);
  const [activeApplicantModal, setActiveApplicantModal] = useState(null);
  const [toastNotice, setToastNotice] = useState('');
  const [createStartupOpen, setCreateStartupOpen] = useState(false);

  useEffect(() => {
    if (location.hash) {
      const h = location.hash.replace('#', '');
      if (h === 'business' || h === 'analytics') setSection('analytics');
      else if (SECTIONS.some(([k]) => k === h)) setSection(h);
    }
  }, [location.hash]);

  const {
    currentUser, myStartups, startups, applications, investments, posts,
    setApplicationStatus, setInvestmentStatus,
    updateFunding, saveCollaboration, updateStartup, deleteStartup,
    pinPost, deletePost, openCreatePost, addPost,
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
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <h2 className="settings-title" style={{ margin: 0 }}>Manage {s.name}</h2>
                {s.reviewStatus === 'pending' && (
                  <span
                    className="status-pill status-soon"
                    style={{ fontWeight: 700, padding: '3px 10px', fontSize: 12 }}
                  >
                    Waiting for Approval
                  </span>
                )}
              </div>
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

          {s.reviewStatus === 'pending' ? (
            <div
              className="review-notice tone-pending"
              role="status"
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 14,
                margin: '16px 0',
                padding: '16px 18px',
                borderRadius: 10,
                border: '1px solid var(--warning)',
                background: 'var(--warning-soft)',
              }}
            >
              <div style={{ fontSize: 24, lineHeight: 1 }} aria-hidden="true">⏳</div>
              <div style={{ flex: 1 }}>
                <b style={{ fontSize: 15, marginBottom: 4, display: 'block', color: 'var(--text)' }}>
                  This startup is waiting to be approved
                </b>
                <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.55, color: 'var(--text)' }}>
                  Your startup has been registered and is currently waiting for administrator approval. Until an administrator reviews and approves it, this startup cannot create posts, open funding rounds, recruit collaborators, or appear in the explore section and public search results. Only you (the startup owner) can view and manage this startup.
                </p>
                {s.reviewNote && (
                  <div style={{ marginTop: 8, fontSize: 12.5, fontStyle: 'italic', color: 'var(--text-muted)' }}>
                    Admin note: &ldquo;{s.reviewNote}&rdquo;
                  </div>
                )}
              </div>
            </div>
          ) : (
            <ReviewNotice startup={s} />
          )}

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
                  s={s}
                  investments={investments}
                  setInvestmentStatus={setInvestmentStatus}
                  updateFunding={updateFunding}
                  addPost={addPost}
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
                  addPost={addPost}
                  onSelectApplicant={(app) => setActiveApplicantModal(app)}
                  setNotice={showToast}
                />
              )}

              {section === 'posts' && (
                <StartupPostsTab
                  id={activeId}
                  s={s}
                  posts={posts}
                  pinPost={pinPost}
                  deletePost={deletePost}
                  openCreatePost={openCreatePost}
                />
              )}

              {section === 'analytics' && (
                <AnalyticsTab
                  id={activeId}
                  s={s}
                  posts={posts}
                  investments={investments}
                  applications={applications}
                  navigate={navigate}
                  openCreatePost={openCreatePost}
                />
              )}

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
