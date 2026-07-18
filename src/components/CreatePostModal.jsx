import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon } from './IconSprite';
import LogoBadge from './LogoBadge';
import { POST_TYPES } from '../data/posts';
import { useApp } from '../context/AppContext';
import '../styles/modal.css';

export default function CreatePostModal() {
  const { postModalOpen, closeCreatePost, addPost, myStartups } = useApp();
  const navigate = useNavigate();

  const [selectedId, setSelectedId] = useState('');
  const [postType, setPostType] = useState(POST_TYPES[0]);
  const [title, setTitle] = useState('');
  const [text, setText] = useState('');
  const [tags, setTags] = useState('');
  const [media, setMedia] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (!postModalOpen) return null;

  function reset() {
    setSelectedId('');
    setPostType(POST_TYPES[0]);
    setTitle('');
    setText('');
    setTags('');
    setMedia('');
    setError('');
  }

  function handleClose() {
    reset();
    closeCreatePost();
  }

  if (myStartups.length === 0) {
    return (
      <div className="modal-overlay" onClick={handleClose}>
        <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
          <div className="modal-head">
            <h3>Share a progress update</h3>
            <button className="icon-btn" onClick={handleClose} aria-label="Close"><Icon name="close" /></button>
          </div>
          <p style={{ fontSize: 13.5, color: 'var(--text-muted)', marginBottom: 18 }}>
            You need a startup to post as. Create one from your account page first.
          </p>
          <div className="modal-actions">
            <button type="button" className="btn btn-outline btn-sm" onClick={handleClose}>Cancel</button>
            <button type="button" className="btn btn-accent btn-sm" onClick={() => { handleClose(); navigate('/account'); }}>Go to your account</button>
          </div>
        </div>
      </div>
    );
  }

  const activeId = myStartups.some(([sid]) => sid === selectedId) ? selectedId : myStartups[0][0];
  const startup = myStartups.find(([sid]) => sid === activeId)[1];

  async function handleSubmit(e) {
    e.preventDefault();
    if (!title.trim() || !text.trim()) {
      setError('Give your update a title and a short description.');
      return;
    }
    setBusy(true);
    try {
      await addPost({
        startupId: activeId,
        postType,
        postTitle: title.trim(),
        postText: text.trim(),
        tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
        media: media.trim() || null,
      });
      reset();
      closeCreatePost();
      navigate('/feed');
    } catch {
      setError('Could not publish your update — try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>Share a progress update</h3>
          <button className="icon-btn" onClick={handleClose} aria-label="Close"><Icon name="close" /></button>
        </div>

        {myStartups.length > 1 ? (
          <div className="field">
            <label htmlFor="cp-startup">Posting as</label>
            <select id="cp-startup" value={activeId} onChange={(e) => setSelectedId(e.target.value)}>
              {myStartups.map(([sid, s]) => <option key={sid} value={sid}>{s.name}</option>)}
            </select>
          </div>
        ) : (
          <div className="modal-poster">
            <LogoBadge id={activeId} initials={startup.initials} size={38} />
            <div><b>{startup.name}</b><span>Posting as {startup.founder}</span></div>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="cp-type">Post type</label>
            <select id="cp-type" value={postType} onChange={(e) => setPostType(e.target.value)}>
              {POST_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="cp-title">Title</label>
            <input id="cp-title" type="text" placeholder="We just shipped v2 of our onboarding flow." value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="cp-text">Description</label>
            <textarea id="cp-text" rows="4" placeholder="What happened, and why it matters." value={text} onChange={(e) => setText(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="cp-tags">Tags</label>
            <input id="cp-tags" type="text" placeholder="AI, Healthcare, Startup" value={tags} onChange={(e) => setTags(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="cp-media">Attachment <span className="field-hint">(image, video, pitch deck, or a link — optional)</span></label>
            <input id="cp-media" type="text" placeholder="e.g. Demo Video · 1:20" value={media} onChange={(e) => setMedia(e.target.value)} />
          </div>
          {error && <p className="modal-error">{error}</p>}
          <div className="modal-actions">
            <button type="button" className="btn btn-outline btn-sm" onClick={handleClose}>Cancel</button>
            <button type="submit" className="btn btn-accent btn-sm" disabled={busy}>{busy ? 'Posting…' : 'Post update'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
