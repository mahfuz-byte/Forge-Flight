import { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { Icon } from '../components/IconSprite';
import Topbar from '../components/Topbar';
import LogoBadge from '../components/LogoBadge';
import InvestButton from '../components/InvestButton';
import { LOGO_GRADIENTS, statusMeta, fmtMoney, fundingPct, initialsOf } from '../data/startups';
import { useApp } from '../context/AppContext';
import { api, mediaUrl } from '../api/client';
import Avatar from '../components/Avatar';

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
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const { addApplication, applications, currentUser } = useApp();
  const existing = applications.find(
    (a) => a.startupId === id && a.applicantId === currentUser.id && (a.status === 'pending' || a.status === 'accepted'),
  );

  // An unpublished listing is only visible to its owner.
  if (!s.collab || (!s.collab.isOpen && !isOwner)) {
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

  async function handleSubmit(e) {
    e.preventDefault();
    const form = e.target;
    setBusy(true);
    setError('');
    try {
      await addApplication({
        type: 'collaboration',
        startupId: id,
        role: s.collab.role,
        name: form.name.value,
        email: form.email.value,
        link: form.link.value,
        message: form.message.value,
      });
      setSubmitted(true); // only once the server has saved it
    } catch (err) {
      setError(err.message || 'Could not submit your application. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="role-card">
      <b>{s.collab.role}</b>
      <p>{s.collab.body}</p>
      {isOwner ? (
        <p style={{ fontSize: 12.5, color: 'var(--text-faint)', marginBottom: 0 }}>
          {s.collab.isOpen
            ? 'This is your listing. Review applicants from your dashboard.'
            : 'This listing is unpublished, so only you can see it. Publish it from your dashboard.'}
        </p>
      ) : existing && !submitted ? (
        <p className="apply-success"><Icon name="check" />You applied for this role · {existing.status}</p>
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
            {error && <p className="modal-error" role="alert">{error}</p>}
            <button className="btn btn-accent btn-sm" type="submit" disabled={busy}>{busy ? 'Submitting…' : 'Submit application'}</button>
          </form>
        </>
      )}
    </div>
  );
}

// Documents with working links; the owner can upload and remove them (FE-09).
function DocumentsPanel({ id, s, isOwner }) {
  const { uploadDocument, removeDocument } = useApp();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function handleUpload(e) {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    setBusy(true);
    setError('');
    try {
      await uploadDocument(id, file);
    } catch (err) {
      setError(err.message || 'Upload failed. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  async function handleRemove(doc) {
    if (!window.confirm(`Remove "${doc.name}"? This deletes the file.`)) return;
    try {
      await removeDocument(id, doc.id);
    } catch (err) {
      setError(err.message || 'Could not remove the document.');
    }
  }

  return (
    <div>
      {s.docs.length === 0 && <p style={{ fontSize: 13, color: 'var(--text-faint)' }}>No documents uploaded yet.</p>}
      {s.docs.map((doc) => (
        <div className="doc-row" key={doc.id}>
          <Icon name="doc" />
          {doc.url ? (
            <a href={doc.url} target="_blank" rel="noreferrer" className="doc-link">{doc.name}</a>
          ) : (
            <span title="This document has no file attached">{doc.name}</span>
          )}
          <span className="d-meta">{doc.size}</span>
          {isOwner && (
            <button type="button" className="icon-btn" aria-label={`Remove ${doc.name}`} onClick={() => handleRemove(doc)}>
              <Icon name="trash" />
            </button>
          )}
        </div>
      ))}
      {isOwner && (
        <div style={{ marginTop: 16 }}>
          <label className="btn btn-outline btn-sm" style={{ cursor: busy ? 'wait' : 'pointer' }}>
            <Icon name="doc" />{busy ? 'Uploading…' : 'Upload document'}
            <input
              type="file"
              hidden
              disabled={busy}
              accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.jpg,.jpeg,.png,.gif,.webp"
              onChange={handleUpload}
            />
          </label>
          <p className="settings-hint" style={{ marginTop: 8 }}>PDF, Office documents or images, up to 20 MB.</p>
        </div>
      )}
      {error && <p className="modal-error" role="alert">{error}</p>}
    </div>
  );
}

// Images and videos this startup has posted (FE-09).
function GalleryPanel({ id }) {
  const [items, setItems] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setItems(null);
    api.get('/posts/', { startup: id, has_media: 1, page_size: 30 })
      .then((data) => {
        if (cancelled) return;
        const media = (data.results || [])
          .map((p) => ({ id: p.id, title: p.title, url: mediaUrl(p.media) }))
          .filter((p) => /\.(jpe?g|png|gif|webp|mp4|webm|mov|m4v)$/i.test(p.url.split('?')[0]));
        setItems(media);
      })
      .catch((err) => { if (!cancelled) setError(err.message); });
    return () => { cancelled = true; };
  }, [id]);

  if (error) return <p className="modal-error">{error}</p>;
  if (items === null) return <p style={{ fontSize: 13, color: 'var(--text-faint)' }}>Loading gallery…</p>;
  if (items.length === 0) {
    return <p style={{ fontSize: 13, color: 'var(--text-faint)' }}>No photos or videos yet. Images and videos attached to posts appear here.</p>;
  }
  return (
    <div className="gallery-grid">
      {items.map((item) => (
        /\.(mp4|webm|mov|m4v)$/i.test(item.url.split('?')[0]) ? (
          <video key={item.id} className="gallery-tile gallery-media" src={item.url} controls preload="metadata" title={item.title} />
        ) : (
          <a key={item.id} className="gallery-tile gallery-media" href={item.url} target="_blank" rel="noreferrer" title={item.title}>
            <img src={item.url} alt={item.title} loading="lazy" />
          </a>
        )
      ))}
    </div>
  );
}

// Comments with edit/delete for their author; moderators can delete (FE-07 / FE-11).
function CommentsPanel({ id }) {
  const { comments, addComment, editComment, deleteComment, currentUser, signedIn } = useApp();
  const navigate = useNavigate();
  const [draft, setDraft] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState('');
  const [error, setError] = useState('');
  const list = comments[id] || [];
  const canModerate = ['moderator', 'admin', 'super_admin'].includes(currentUser.role);

  async function attempt(fn) {
    setError('');
    try {
      await fn();
      return true;
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.');
      return false;
    }
  }

  async function submit(e) {
    e.preventDefault();
    if (!signedIn) { navigate('/login'); return; }
    if (!draft.trim()) return;
    if (await attempt(() => addComment(id, draft.trim()))) setDraft('');
  }

  async function saveEdit(e) {
    e.preventDefault();
    if (!editText.trim()) return;
    if (await attempt(() => editComment(id, editingId, editText.trim()))) setEditingId(null);
  }

  async function remove(c) {
    if (!window.confirm('Delete this comment?')) return;
    await attempt(() => deleteComment(id, c.id));
  }

  return (
    <div id="comments">
      {list.length === 0 && <p style={{ fontSize: 13, color: 'var(--text-faint)' }}>No comments yet. Start the conversation.</p>}
      {list.map((c) => {
        const mine = c.authorId === currentUser.id;
        return (
          <div className="comment-item" key={c.id}>
            <Avatar src={c.avatar} name={c.name} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="c-name">{c.name} <time>· {c.time}</time></div>
              {editingId === c.id ? (
                <form onSubmit={saveEdit} className="field" style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                  <input type="text" value={editText} onChange={(e) => setEditText(e.target.value)} style={{ flex: 1, minWidth: 0 }} autoFocus />
                  <button className="btn btn-accent btn-sm" type="submit">Save</button>
                  <button className="btn btn-outline btn-sm" type="button" onClick={() => setEditingId(null)}>Cancel</button>
                </form>
              ) : (
                <div className="c-text">{c.text}</div>
              )}
            </div>
            {(mine || canModerate) && editingId !== c.id && (
              <div className="comment-actions">
                {mine && (
                  <button type="button" className="icon-btn" aria-label="Edit comment" onClick={() => { setEditingId(c.id); setEditText(c.text); }}>
                    <Icon name="edit" />
                  </button>
                )}
                <button type="button" className="icon-btn" aria-label="Delete comment" onClick={() => remove(c)}>
                  <Icon name="trash" />
                </button>
              </div>
            )}
          </div>
        );
      })}
      {error && <p className="modal-error" role="alert">{error}</p>}
      <form onSubmit={submit} className="field" style={{ marginTop: 16, display: 'flex', gap: 10, alignItems: 'center' }}>
        <input type="text" placeholder={signedIn ? 'Add a comment...' : 'Sign in to comment'} value={draft} onChange={(e) => setDraft(e.target.value)} style={{ flex: 1, minWidth: 0 }} />
        <button className="btn btn-accent btn-sm" type="submit">Post</button>
      </form>
    </div>
  );
}

export default function Profile() {
  const { id = 'healthsync' } = useParams();
  const [tab, setTab] = useState('overview');
  const navigate = useNavigate();
  const location = useLocation();
  const { currentUser, startups, saved, toggleSaved, followed, toggleFollow, startConversation, signedIn } = useApp();
  const s = startups[id];
  const isOwner = !!s && s.ownerId === currentUser.id;
  const isSaved = saved.has(id);
  const isFollowing = followed.has(id);

  useEffect(() => {
    if (location.hash === '#comments') setTab('comments');
  }, [location.hash, id]);

  // Deleted or mistyped startup: say so instead of showing a different one.
  if (!s) {
    return (
      <div>
        <Topbar />
        <div className="settings-card" style={{ maxWidth: 480, margin: '48px auto' }}>
          <h4>Startup not found</h4>
          <p className="settings-hint">It may have been renamed or removed.</p>
          <button className="btn btn-accent btn-sm" onClick={() => navigate('/explore')}>Explore startups</button>
        </div>
      </div>
    );
  }

  const pct = fundingPct(s.raised, s.goal);

  // Save/follow/message: guests sign in first; failures are shown, not swallowed (FE-06).
  async function guarded(fn) {
    if (!signedIn) { navigate('/login'); return; }
    try {
      await fn();
    } catch (err) {
      window.alert(err.message || 'That didn’t work. Please try again.');
    }
  }

  function handleMessage() {
    return guarded(async () => {
      const convId = await startConversation(id);
      navigate(`/messages?id=${convId}`);
    });
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
                  onClick={() => guarded(() => toggleSaved(id))}
                >
                  <Icon name="bookmark" />{isSaved ? 'Saved' : 'Save'}
                </button>
                <button
                  className={isFollowing ? 'btn btn-outline btn-sm' : 'btn btn-accent btn-sm'}
                  onClick={() => guarded(() => toggleFollow(id))}
                >
                  {isFollowing ? 'Following' : 'Follow'}
                </button>
                <button
                  className="btn btn-outline btn-sm"
                  onClick={handleMessage}
                >
                  <Icon name="chat" />Message
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

          {tab === 'documents' && <DocumentsPanel id={id} s={s} isOwner={isOwner} />}

          {tab === 'gallery' && <GalleryPanel id={id} />}

          {tab === 'collaboration' && <CollaborationPanel id={id} s={s} isOwner={isOwner} navigate={navigate} />}

          {tab === 'updates' && (
            <div className="prose">
              <h5>Recent updates</h5>
              {s.updates.length === 0 && <p>No updates posted yet.</p>}
              {s.updates.map((u) => <p key={u}>· {u}</p>)}
            </div>
          )}

          {tab === 'comments' && <CommentsPanel id={id} />}
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
                <Avatar src={s.founderAvatar} name={s.founder} />
                <div><div className="t-name">{s.founder}</div><div className="t-meta">View your account</div></div>
              </button>
            ) : (
              <div className="trend-row" style={{ padding: 0 }}>
                <Avatar src={s.founderAvatar} name={s.founder} />
                <div><div className="t-name">{s.founder}</div><div className="t-meta">Founder &amp; CEO</div></div>
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
