import { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { Icon } from '../components/IconSprite';
import Topbar from '../components/Topbar';
import LogoBadge from '../components/LogoBadge';
import InvestButton from '../components/InvestButton';
import { LOGO_GRADIENTS, statusMeta, fmtMoney, fundingPct, initialsOf } from '../data/startups';
import { useApp } from '../context/AppContext';

const TABS = [
  ['overview', 'Overview'],
  ['team', 'Team'],
  ['timeline', 'Timeline'],
  ['funding', 'Funding'],
  ['documents', 'Documents'],
  ['gallery', 'Gallery'],
  ['collaboration', 'Collaboration'],
  ['updates', 'Updates'],
  ['comments', 'Comments'],
];

function FundingPanel({ id, s, isOwner, navigate }) {
  if (s.goal <= 0) {
    return (
      <p style={{ fontSize: 13, color: 'var(--text-faint)' }}>
        {isOwner ? "You haven't opened a funding round yet." : `${s.name} hasn't opened a funding round yet.`}
      </p>
    );
  }
  const pct = fundingPct(s.raised, s.goal);
  const remaining = s.deadline.match(/\d+/) ? s.deadline.match(/\d+/)[0] : '0';
  return (
    <div>
      <div className="funding-block">
        <div className="funding-top">
          <span className={`status-pill ${statusMeta(s.status).cls}`}>{statusMeta(s.status).label}</span>
          <span className="mono" style={{ fontSize: 12.5, color: 'var(--text-faint)' }}>{s.deadline}</span>
        </div>
        <div className="gauge"><span style={{ width: `${pct}%` }} /></div>
        <div className="funding-nums">
          <span>Raised <b>{fmtMoney(s.raised)}</b></span>
          <span className="muted">Goal <b className="mono">{fmtMoney(s.goal)}</b></span>
          <span className="muted">{pct}%</span>
        </div>
      </div>
      {isOwner ? (
        <button className="btn btn-outline btn-sm" onClick={() => navigate(`/dashboard/${id}`)}>Manage funding</button>
      ) : (
        <div className="investor-panel">
          <div className="ip-grid">
            <div className="ip-item"><span>Investment Needed</span><b>{fmtMoney(s.goal - s.raised)}</b></div>
            <div className="ip-item"><span>Remaining Days</span><b>{remaining}</b></div>
            <div className="ip-item"><span>Current Investors</span><b>{3 + Math.round(s.raised / 40000)}</b></div>
            <div className="ip-item"><span>Expected ROI</span><b>{4 + Math.round(s.raised / 60000)}x (est.)</b></div>
          </div>
          <InvestButton startupId={id} wide />
        </div>
      )}
    </div>
  );
}

function CollaborationPanel({ id, s, isOwner, navigate }) {
  const [open, setOpen] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const { addApplication } = useApp();

  if (!s.collab) {
    return (
      <div className="role-card">
        <p style={{ marginBottom: 0 }}>No open collaboration roles right now.</p>
        {isOwner && (
          <button className="btn btn-outline btn-sm" style={{ marginTop: 12 }} onClick={() => navigate(`/dashboard/${id}`)}>
            Open a role from your dashboard
          </button>
        )}
      </div>
    );
  }

  function handleSubmit(e) {
    e.preventDefault();
    const form = e.target;
    addApplication({
      type: 'collaboration',
      startupId: id,
      role: s.collab.role,
      name: form.name.value,
      email: form.email.value,
      link: form.link.value,
      message: form.message.value,
    });
    setSubmitted(true);
  }

  return (
    <div className="role-card">
      <b>{s.collab.role}</b>
      <p>{s.collab.body}</p>
      {isOwner ? (
        <p style={{ fontSize: 12.5, color: 'var(--text-faint)', marginBottom: 0 }}>
          This is your listing — review applicants from your dashboard.
        </p>
      ) : submitted ? (
        <p className="apply-success"><Icon name="check" />Application submitted — {s.founder.split(' ')[0]} will be in touch.</p>
      ) : (
        <>
          <button className="btn btn-accent btn-sm" type="button" onClick={() => setOpen((v) => !v)}>Apply</button>
          <form className={`apply-form${open ? ' open' : ''}`} onSubmit={handleSubmit}>
            <div className="field"><label htmlFor="ap-name">Name</label><input id="ap-name" name="name" type="text" placeholder="Your full name" required /></div>
            <div className="field"><label htmlFor="ap-email">Email</label><input id="ap-email" name="email" type="email" placeholder="you@email.com" required /></div>
            <div className="field"><label htmlFor="ap-link">Portfolio / GitHub link</label><input id="ap-link" name="link" type="text" placeholder="https://" /></div>
            <div className="field"><label htmlFor="ap-msg">Message</label><textarea id="ap-msg" name="message" rows="3" placeholder="Why you're a fit for this role" /></div>
            <button className="btn btn-accent btn-sm" type="submit">Submit application</button>
          </form>
        </>
      )}
    </div>
  );
}

export default function Profile() {
  const { id = 'healthsync' } = useParams();
  const [tab, setTab] = useState('overview');
  const [commentDraft, setCommentDraft] = useState('');
  const navigate = useNavigate();
  const location = useLocation();
  const { currentUser, startups, saved, toggleSaved, followed, toggleFollow, comments, addComment } = useApp();
  const s = startups[id] || startups.healthsync;
  const isOwner = s.ownerId === currentUser.id;
  const isSaved = saved.has(id);
  const isFollowing = followed.has(id);
  const pct = fundingPct(s.raised, s.goal);
  const commentList = comments[id] || [];

  useEffect(() => {
    if (location.hash === '#comments') setTab('comments');
  }, [location.hash, id]);

  function submitComment(e) {
    e.preventDefault();
    if (!commentDraft.trim()) return;
    addComment(id, commentDraft.trim());
    setCommentDraft('');
  }

  return (
    <div>
      <Topbar />
      <button className="back-btn" onClick={() => navigate('/feed')}><Icon name="back" />Back to feed</button>

      <div className="profile-cover" style={{ background: `linear-gradient(120deg, ${(LOGO_GRADIENTS[id] || 'linear-gradient(155deg,#403d39,#252422)').replace('linear-gradient(155deg,', '')}` }} />
      <div className="profile-head">
        <LogoBadge id={id} initials={s.initials} size={88} />
        <div className="profile-info">
          <div>
            <h2 className="profile-name">{s.name}{s.verified && <Icon name="check" />}</h2>
            <p className="profile-tagline">{s.tagline}</p>
          </div>
          <div className="profile-actions">
            <span className={`status-pill ${statusMeta(s.status).cls}`}>{statusMeta(s.status).label}</span>
            {!isOwner && (
              <>
                <button
                  className="btn btn-outline btn-sm"
                  style={isSaved ? { borderColor: 'var(--accent)', color: 'var(--accent)' } : undefined}
                  onClick={() => toggleSaved(id)}
                >
                  <Icon name="bookmark" />{isSaved ? 'Saved' : 'Save'}
                </button>
                <button
                  className={isFollowing ? 'btn btn-outline btn-sm' : 'btn btn-accent btn-sm'}
                  onClick={() => toggleFollow(id)}
                >
                  {isFollowing ? 'Following' : 'Follow'}
                </button>
              </>
            )}
            {isOwner && (
              <>
                <button className="btn btn-outline btn-sm" onClick={() => navigate(`/dashboard/${id}`)}><Icon name="edit" />Manage</button>
                <button className="btn btn-outline btn-sm"><Icon name="bolt" />Boost</button>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="profile-tabs">
        {TABS.map(([key, label]) => (
          <button key={key} className={`ptab${tab === key ? ' active' : ''}`} onClick={() => setTab(key)}>{label}</button>
        ))}
      </div>

      <div className="profile-body">
        <div>
          {tab === 'overview' && (
            <div className="prose">
              <p>{s.overview || 'No overview yet.'}</p>
              <h5>Founder</h5><p>{s.founder}</p>
              <h5>Industry tags</h5>
              <div className="tags-row">{s.tags.map((t) => <span className="tag-chip" key={t}>#{t}</span>)}</div>
            </div>
          )}

          {tab === 'team' && (
            <div className="team-grid">
              {s.team.map(([name, title]) => (
                <div className="team-card" key={name}>
                  <div className="avatar">{initialsOf(name)}</div>
                  <b>{name}</b><span>{title}</span>
                </div>
              ))}
            </div>
          )}

          {tab === 'timeline' && (
            <div>
              {s.timeline.map(([date, title, body]) => (
                <div className="tl-item" key={date + title}>
                  <div className="tl-dot" />
                  <div><time className="mono">{date}</time><b>{title}</b><p>{body}</p></div>
                </div>
              ))}
            </div>
          )}

          {tab === 'funding' && <FundingPanel id={id} s={s} isOwner={isOwner} navigate={navigate} />}

          {tab === 'documents' && (
            <div>
              {s.docs.length === 0 && <p style={{ fontSize: 13, color: 'var(--text-faint)' }}>No documents uploaded yet.</p>}
              {s.docs.map(([name, size]) => (
                <div className="doc-row" key={name}><Icon name="doc" /><span>{name}</span><span className="d-meta">{size}</span></div>
              ))}
            </div>
          )}

          {tab === 'gallery' && (
            <div className="gallery-grid">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div className="gallery-tile" key={i} style={{ background: LOGO_GRADIENTS[id] || 'linear-gradient(155deg,#403d39,#252422)' }}><Icon name="img" style={{ width: 22, height: 22 }} /></div>
              ))}
            </div>
          )}

          {tab === 'collaboration' && <CollaborationPanel id={id} s={s} isOwner={isOwner} navigate={navigate} />}

          {tab === 'updates' && (
            <div className="prose">
              <h5>Recent updates</h5>
              {s.updates.length === 0 && <p>No updates posted yet.</p>}
              {s.updates.map((u) => <p key={u}>· {u}</p>)}
            </div>
          )}

          {tab === 'comments' && (
            <div id="comments">
              {commentList.map((c, i) => (
                <div className="comment-item" key={c.name + c.time + i}>
                  <div className="avatar">{initialsOf(c.name)}</div>
                  <div><div className="c-name">{c.name} <time>· {c.time}</time></div><div className="c-text">{c.text}</div></div>
                </div>
              ))}
              <form onSubmit={submitComment} className="field" style={{ marginTop: 16, display: 'flex', gap: 10, alignItems: 'center' }}>
                <input type="text" placeholder="Add a comment..." value={commentDraft} onChange={(e) => setCommentDraft(e.target.value)} style={{ flex: 1 }} />
                <button className="btn btn-accent btn-sm" type="submit">Post</button>
              </form>
            </div>
          )}
        </div>

        <aside>
          <div className="sidebar-card">
            <h5>Funding</h5>
            {s.goal > 0 ? (
              <>
                <div className="fund-cta-goal mono">{fmtMoney(s.raised)}</div>
                <div className="fund-cta-sub">raised of {fmtMoney(s.goal)} goal · {pct}%</div>
                <div className="gauge"><span style={{ width: `${pct}%` }} /></div>
                {isOwner ? (
                  <p style={{ fontSize: 12, color: 'var(--text-faint)', marginTop: 12 }}>{s.deadline}</p>
                ) : (
                  <>
                    <div className="fund-invest-grid">
                      <div className="fi-row"><span>Remaining</span><b>{s.deadline}</b></div>
                      <div className="fi-row"><span>Expected ROI</span><b>{4 + Math.round(s.raised / 60000)}x (est.)</b></div>
                    </div>
                    <InvestButton startupId={id} wide />
                  </>
                )}
              </>
            ) : (
              <p style={{ fontSize: 12.5, color: 'var(--text-faint)' }}>No funding round open yet.</p>
            )}
          </div>
          <div className="sidebar-card">
            <h5>Founder</h5>
            {isOwner ? (
              <button
                type="button"
                className="trend-row"
                style={{ padding: 0, border: 'none', background: 'none', width: '100%', textAlign: 'left', cursor: 'pointer' }}
                onClick={() => navigate('/account')}
              >
                <div className="avatar">{initialsOf(s.founder)}</div>
                <div><div className="t-name">{s.founder}</div><div className="t-meta">View your account</div></div>
              </button>
            ) : (
              <div className="trend-row" style={{ padding: 0 }}>
                <div className="avatar">{initialsOf(s.founder)}</div>
                <div><div className="t-name">{s.founder}</div><div className="t-meta">Founder &amp; CEO</div></div>
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
