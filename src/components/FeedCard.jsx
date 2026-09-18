import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon } from './IconSprite';
import LogoBadge from './LogoBadge';
import InvestButton from './InvestButton';
import { fmtMoney, fundingPct, statusMeta, LOGO_GRADIENTS } from '../data/startups';
import { POST_TYPES } from '../data/posts';
import { useApp } from '../context/AppContext';

function FundingBlock({ s }) {
  const pct = fundingPct(s.raised, s.goal);
  const meta = statusMeta(s.status);
  return (
    <div className="funding-block">
      <div className="funding-top">
        <span className={`status-pill ${meta.cls}`}>{meta.label}</span>
        <span className="mono" style={{ fontSize: 12.5, color: 'var(--text-faint)' }}>{s.deadline}</span>
      </div>
      <div className="gauge"><span style={{ width: `${pct}%` }} /></div>
      <div className="funding-nums">
        <span>Raised <b>{fmtMoney(s.raised)}</b></span>
        <span className="muted">Goal <b className="mono">{fmtMoney(s.goal)}</b></span>
        <span className="muted">{pct}%</span>
      </div>
    </div>
  );
}

function InvestorPanel({ id, s }) {
  const remaining = s.deadline.match(/\d+/) ? s.deadline.match(/\d+/)[0] : '0';
  return (
    <div className="investor-panel">
      <div className="ip-grid">
        <div className="ip-item"><span>Investment Needed</span><b>{fmtMoney(s.goal - s.raised)}</b></div>
        <div className="ip-item"><span>Remaining Days</span><b>{remaining}</b></div>
        <div className="ip-item"><span>Current Investors</span><b>{3 + Math.round(s.raised / 40000)}</b></div>
        <div className="ip-item"><span>Expected ROI</span><b>{4 + Math.round(s.raised / 60000)}x (est.)</b></div>
      </div>
      <InvestButton startupId={id} wide />
    </div>
  );
}

function FounderPanel({ post, onEdit, onDelete, onPin, myStartups }) {
  const [showEditModal, setShowEditModal] = useState(false);
  const [editStartupId, setEditStartupId] = useState('');
  const [editPostType, setEditPostType] = useState('');
  const [editTitle, setEditTitle] = useState('');
  const [editPrompt, setEditPrompt] = useState('');
  const [editTags, setEditTags] = useState('');
  const [showAnalyticsModal, setShowAnalyticsModal] = useState(false);

  function handleEdit() {
    setEditStartupId(post.startupId);
    setEditPostType(post.postType || POST_TYPES[0]);
    setEditTitle(post.postTitle || '');
    setEditPrompt(post.postText || '');
    setEditTags((post.tags || []).join(', '));
    setShowEditModal(true);
  }

  function saveEdit(e) {
    e.preventDefault();
    onEdit(post.id, {
      startupId: editStartupId,
      postType: editPostType,
      postTitle: editTitle,
      postText: editPrompt,
      tags: editTags.split(',').map(t => t.trim()).filter(Boolean)
    });
    setShowEditModal(false);
  }

  function handleDelete() {
    if (window.confirm('Are you sure you want to delete this post?')) {
      onDelete(post.id);
    }
  }

  function handleAnalytics() {
    setShowAnalyticsModal(true);
  }

  return (
    <div className="founder-panel">
      <button onClick={handleEdit}><Icon name="edit" />Edit</button>
      <button onClick={handleDelete}><Icon name="trash" />Delete</button>
      <button onClick={() => onPin(post.id, post.pinned)}><Icon name="pin" />{post.pinned ? 'Unpin' : 'Pin'}</button>
      <button onClick={handleAnalytics}><Icon name="chart" />View Analytics</button>

      {showEditModal && (
        <div className="modal-overlay">
          <div className="modal-panel">
            <div className="modal-head">
              <h3>Edit Post</h3>
              <button className="icon-btn" onClick={() => setShowEditModal(false)}><Icon name="close" /></button>
            </div>
            <form onSubmit={saveEdit}>
              {myStartups && myStartups.length > 0 && (
                <div className="field">
                  <label htmlFor="ep-startup">Posting as (Startup)</label>
                  <select id="ep-startup" value={editStartupId} onChange={(e) => setEditStartupId(e.target.value)}>
                    {myStartups.map(([sid, s]) => <option key={sid} value={sid}>{s.name}</option>)}
                  </select>
                </div>
              )}
              <div className="field">
                <label htmlFor="ep-type">Post type</label>
                <select id="ep-type" value={editPostType} onChange={(e) => setEditPostType(e.target.value)}>
                  {POST_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="field">
                <label htmlFor="ep-title">Title</label>
                <input id="ep-title" type="text" placeholder="We just shipped v2 of our onboarding flow." value={editTitle} onChange={(e) => setEditTitle(e.target.value)} />
              </div>
              <div className="field">
                <label htmlFor="ep-text">Description</label>
                <textarea id="ep-text" rows="4" placeholder="What happened, and why it matters." value={editPrompt} onChange={(e) => setEditPrompt(e.target.value)} />
              </div>
              <div className="field">
                <label htmlFor="ep-tags">Tags</label>
                <input id="ep-tags" type="text" placeholder="AI, Healthcare, Startup" value={editTags} onChange={(e) => setEditTags(e.target.value)} />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-outline btn-sm" onClick={() => setShowEditModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-accent btn-sm">Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showAnalyticsModal && (
        <div className="modal-overlay">
          <div className="modal-panel" style={{ maxWidth: '600px' }}>
            <div className="modal-head">
              <h3 style={{ fontSize: '20px', fontWeight: '700' }}>Analytics</h3>
              <button className="icon-btn" onClick={() => setShowAnalyticsModal(false)}><Icon name="close" /></button>
            </div>
            
            <div className="stat-grid dash-stats" style={{ marginBottom: 24, gap: '12px', display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
              <div className="stat-tile" style={{ background: 'var(--bg)', padding: '16px 20px', borderRadius: '8px' }}>
                <b style={{ display: 'block', fontSize: '28px', color: 'var(--text)', marginBottom: '4px' }}>1,284</b>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Profile Views</span>
              </div>
              <div className="stat-tile" style={{ background: 'var(--bg)', padding: '16px 20px', borderRadius: '8px' }}>
                <b style={{ display: 'block', fontSize: '28px', color: 'var(--text)', marginBottom: '4px' }}>6,940</b>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Post Impressions</span>
              </div>
              <div className="stat-tile" style={{ background: 'var(--bg)', padding: '16px 20px', borderRadius: '8px' }}>
                <b style={{ display: 'block', fontSize: '28px', color: 'var(--text)', marginBottom: '4px' }}>7.8%</b>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Engagement Rate</span>
              </div>
              <div className="stat-tile" style={{ background: 'var(--bg)', padding: '16px 20px', borderRadius: '8px' }}>
                <b style={{ display: 'block', fontSize: '28px', color: 'var(--text)', marginBottom: '4px' }}>2.4k</b>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Followers</span>
              </div>
            </div>

            <h5 className="dash-chart-label" style={{ fontSize: '13px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '16px' }}>Profile views this week</h5>
            <div className="bar-chart" style={{ display: 'flex', justifyContent: 'space-between', height: '140px', alignItems: 'flex-end', gap: '8px', marginBottom: '24px' }}>
              {[
                ['Mon', 38], ['Tue', 52], ['Wed', 44], ['Thu', 68], ['Fri', 61], ['Sat', 30], ['Sun', 47]
              ].map(([day, val]) => {
                const max = 68;
                return (
                  <div className="bar-col" key={day} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', flex: 1 }}>
                    <div className="bar-track" style={{ width: '100%', maxWidth: '36px', height: '110px', background: 'var(--bg)', borderRadius: '4px', position: 'relative', overflow: 'hidden' }}>
                      <div className="bar-fill" style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'var(--accent)', height: `${Math.round((val / max) * 100)}%`, borderRadius: '4px' }} />
                    </div>
                    <span className="bar-label" style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{day}</span>
                  </div>
                );
              })}
            </div>

          </div>
        </div>
      )}
    </div>
  );
}


export default function FeedCard({ post }) {
  const [reported, setReported] = useState(false);
  const navigate = useNavigate();
  const { currentUser, startups, saved, toggleSaved, followed, toggleFollow, toggleLikePost, deletePost, pinPost, editPost, myStartups } = useApp();

  const id = post.startupId;
  const s = startups[id];
  const isOwner = s.ownerId === currentUser.id;
  const isSaved = saved.has(id);
  const isFollowing = followed.has(id);
  const showFunding = s.goal > 0 && (s.status === 'open' || s.status === 'soon' || s.status === 'closed');

  let extra = null;
  if (isOwner) extra = <FounderPanel post={post} onEdit={editPost} onDelete={deletePost} onPin={pinPost} myStartups={myStartups} />;
  else if (s.goal > 0 && (s.status === 'open' || s.status === 'soon')) extra = <InvestorPanel id={id} s={s} />;

  return (
    <article className="feed-card" data-startup={id}>
      <div className="card-head">
        <LogoBadge id={id} initials={s.initials} />
        <div className="who">
          <div className="name-row" onClick={() => navigate(`/profile/${id}`)} style={{ cursor: 'pointer' }}>
            <span style={{ fontWeight: 700 }}>{s.name}</span>
            {s.verified && <Icon name="check" />}
            {isOwner && <span className="your-startup-tag">Your startup</span>}
          </div>
          <div className="meta"><b>{s.founder}</b> · {post.timestamp}</div>
        </div>
      </div>
      <span className="post-type-tag" style={{ color: post.tagColor || 'var(--accent)' }}>{post.postType}</span>
      <div className="card-title">{post.postTitle}</div>
      <p className="card-text">{post.postText}</p>
      {post.media && (
        <div className="card-media" style={{ background: LOGO_GRADIENTS[id], overflow: 'hidden' }}>
          {(() => {
            const ext = post.media.split('.').pop().toLowerCase();
            if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) {
              return <img src={post.media} alt="Post attachment" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />;
            }
            if (['mp4', 'webm', 'ogg'].includes(ext)) {
              return <video src={post.media} controls style={{ width: '100%', height: '100%', objectFit: 'cover' }} />;
            }
            return (
              <a href={post.media} target="_blank" rel="noreferrer" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', color: 'var(--bg)', textDecoration: 'none', fontWeight: 'bold' }}>
                View Attachment
              </a>
            );
          })()}
        </div>
      )}
      <div className="tags-row">
        {post.tags.map((t) => <span className="tag-chip" key={t}>#{t}</span>)}
      </div>
      {showFunding && <FundingBlock s={s} />}
      {extra}
      <div className="action-row">
        <button className={`action-btn${post.isLiked ? ' liked' : ''}`} onClick={() => toggleLikePost(post.id)}>
          {post.isLiked ? '❤️' : '🤍'} {post.likesCount || 0}
        </button>
        <button className="action-btn" onClick={() => navigate(`/profile/${id}#comments`)}><Icon name="comment" />Comment</button>
        <button className={`action-btn${isSaved ? ' liked' : ''}`} onClick={() => toggleSaved(id)}><Icon name="bookmark" />{isSaved ? 'Saved' : 'Save'}</button>
        <button className={`action-btn${isFollowing ? ' following' : ''}`} onClick={() => toggleFollow(id)}><Icon name="user" />{isFollowing ? 'Following' : 'Follow'}</button>
        <button className={`action-btn${reported ? ' reported' : ''}`} disabled={reported} onClick={() => setReported(true)}><Icon name="flag" />{reported ? 'Reported' : 'Report'}</button>
      </div>
    </article>
  );
}

export function EventCard({ post }) {
  return (
    <article className="feed-card">
      <div className="card-head">
        <div className="logo-badge" style={{ background: 'linear-gradient(155deg,#403d39,#252422)' }}>
          <Icon name="cal" style={{ width: 20, height: 20 }} />
        </div>
        <div className="who"><div className="name-row">Forge &amp; Flight</div><div className="meta">Platform · {post.timestamp}</div></div>
      </div>
      <span className="post-type-tag">Event</span>
      <div className="card-title">{post.postTitle}</div>
      <p className="card-text">{post.postText}</p>
      <div className="action-row"><button className="btn btn-outline btn-sm">Add to calendar</button><span className="spacer" /><span className="status-pill status-info">Upcoming</span></div>
    </article>
  );
}
