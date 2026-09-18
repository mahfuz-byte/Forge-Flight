import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon } from './IconSprite';
import LogoBadge from './LogoBadge';
import InvestButton from './InvestButton';
import { fmtMoney, fundingPct, statusMeta, LOGO_GRADIENTS } from '../data/startups';
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

function FounderPanel({ post, onEdit, onDelete, onPin }) {
  function handleEdit() {
    const newText = prompt('Edit your post:', post.postText);
    if (newText !== null) onEdit(post.id, newText);
  }

  function handleDelete() {
    if (window.confirm('Are you sure you want to delete this post?')) {
      onDelete(post.id);
    }
  }

  function handleAnalytics() {
    alert(`Post Analytics:\nLikes: ${post.likesCount}\nViews: ${post.likesCount * 3} (est.)`);
  }

  return (
    <div className="founder-panel">
      <button onClick={handleEdit}><Icon name="edit" />Edit</button>
      <button onClick={handleDelete}><Icon name="trash" />Delete</button>
      <button onClick={() => onPin(post.id, post.pinned)}><Icon name="pin" />{post.pinned ? 'Unpin' : 'Pin'}</button>
      <button onClick={handleAnalytics}><Icon name="chart" />View Analytics</button>
    </div>
  );
}

export default function FeedCard({ post }) {
  const [reported, setReported] = useState(false);
  const navigate = useNavigate();
  const { currentUser, startups, saved, toggleSaved, followed, toggleFollow, toggleLikePost, deletePost, pinPost, editPost } = useApp();

  const id = post.startupId;
  const s = startups[id];
  const isOwner = s.ownerId === currentUser.id;
  const isSaved = saved.has(id);
  const isFollowing = followed.has(id);
  const showFunding = s.goal > 0 && (s.status === 'open' || s.status === 'soon' || s.status === 'closed');

  let extra = null;
  if (isOwner) extra = <FounderPanel post={post} onEdit={editPost} onDelete={deletePost} onPin={pinPost} />;
  else if (s.goal > 0 && (s.status === 'open' || s.status === 'soon')) extra = <InvestorPanel id={id} s={s} />;

  return (
    <article className="feed-card" data-startup={id}>
      <div className="card-head">
        <LogoBadge id={id} initials={s.initials} />
        <div className="who">
          <div className="name-row">
            {s.name}
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
        <span className="spacer" />
        <button className="action-btn view-startup" onClick={() => navigate(`/profile/${id}`)}>View Startup <Icon name="arrow-r" /></button>
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
