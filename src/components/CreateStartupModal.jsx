import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon } from './IconSprite';
import { useApp } from '../context/AppContext';
import '../styles/modal.css';

export default function CreateStartupModal({ open, onClose }) {
  const { createStartup, currentUser } = useApp();
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [tagline, setTagline] = useState('');
  const [tags, setTags] = useState('');
  const [overview, setOverview] = useState('');
  const [goal, setGoal] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (!open) return null;

  function reset() {
    setName('');
    setTagline('');
    setTags('');
    setOverview('');
    setGoal('');
    setError('');
  }

  function handleClose() {
    reset();
    onClose();
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!name.trim()) {
      setError('Give your startup a name.');
      return;
    }
    setBusy(true);
    try {
      const id = await createStartup({
        name: name.trim(),
        tagline: tagline.trim(),
        tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
        overview: overview.trim(),
        goal,
      });
      reset();
      onClose();
      navigate(`/profile/${id}`);
    } catch {
      setError('Could not create your startup — try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>Create a startup</h3>
          <button className="icon-btn" onClick={handleClose} aria-label="Close"><Icon name="close" /></button>
        </div>

        <div className="modal-poster">
          <div className="avatar">{currentUser.initials}</div>
          <div><b>{currentUser.name}</b><span>You'll be listed as Founder &amp; CEO</span></div>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="cs-name">Startup name</label>
            <input id="cs-name" type="text" placeholder="e.g. Nimbus Robotics" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="cs-tagline">Tagline <span className="field-hint">(what you do · industry · location)</span></label>
            <input id="cs-tagline" type="text" placeholder="Autonomous warehouse drones · Robotics · Singapore" value={tagline} onChange={(e) => setTagline(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="cs-overview">Overview</label>
            <textarea id="cs-overview" rows="4" placeholder="What problem you're solving and how." value={overview} onChange={(e) => setOverview(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="cs-tags">Tags</label>
            <input id="cs-tags" type="text" placeholder="AI, Robotics, Warehousing" value={tags} onChange={(e) => setTags(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="cs-goal">Funding goal ($) <span className="field-hint">(optional — leave blank if you're not raising yet)</span></label>
            <input id="cs-goal" type="number" min="0" step="1000" placeholder="0" value={goal} onChange={(e) => setGoal(e.target.value)} />
          </div>
          {error && <p className="modal-error">{error}</p>}
          <div className="modal-actions">
            <button type="button" className="btn btn-outline btn-sm" onClick={handleClose}>Cancel</button>
            <button type="submit" className="btn btn-accent btn-sm" disabled={busy}>{busy ? 'Creating…' : 'Create startup'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
