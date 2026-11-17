import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon } from './IconSprite';
import { useApp } from '../context/AppContext';
import Avatar from './Avatar';
import '../styles/modal.css';

export default function CreateStartupModal({ open, onClose }) {
  const { createStartup, currentUser } = useApp();
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [tagline, setTagline] = useState('');
  const [tags, setTags] = useState('');
  const [overview, setOverview] = useState('');
  const [goal, setGoal] = useState('');
  const [tradeLicense, setTradeLicense] = useState('');
  const [tinNumber, setTinNumber] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (!open) return null;

  function reset() {
    setName('');
    setTagline('');
    setTags('');
    setOverview('');
    setGoal('');
    setTradeLicense('');
    setTinNumber('');
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
    if (!tradeLicense.trim()) {
      setError('Trade License number is compulsory.');
      return;
    }
    if (!tinNumber.trim()) {
      setError('TIN (Tax Identification Number) is compulsory.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const id = await createStartup({
        name: name.trim(),
        tagline: tagline.trim(),
        tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
        overview: overview.trim(),
        goal,
        tradeLicense: tradeLicense.trim(),
        tinNumber: tinNumber.trim(),
      });
      reset();
      onClose();
      navigate(`/dashboard/${id}`);
    } catch (err) {
      const serverMsg = err?.data?.detail || err?.data?.trade_license?.[0] || err?.data?.tin_number?.[0] || err?.message;
      setError(serverMsg || 'Could not register your startup — try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>Register New Startup</h3>
          <button className="icon-btn" onClick={handleClose} aria-label="Close"><Icon name="close" /></button>
        </div>

        <div className="modal-poster">
          <Avatar src={currentUser.avatar} name={currentUser.name} initials={currentUser.initials} />
          <div><b>{currentUser.name}</b><span>You'll be listed as Founder &amp; CEO</span></div>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="cs-name">Startup name <span style={{ color: '#ef4444' }}>*</span></label>
            <input id="cs-name" type="text" placeholder="e.g. Nimbus Robotics" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>

          <div className="field">
            <label htmlFor="cs-trade-license">
              Trade License Number <span style={{ color: '#ef4444' }}>*</span> <span className="field-hint">(compulsory for verification)</span>
            </label>
            <input
              id="cs-trade-license"
              type="text"
              placeholder="e.g. TRAD/DNCC/012345/2026"
              value={tradeLicense}
              onChange={(e) => setTradeLicense(e.target.value)}
              required
            />
          </div>

          <div className="field">
            <label htmlFor="cs-tin">
              TIN Number (Tax Identification Number) <span style={{ color: '#ef4444' }}>*</span> <span className="field-hint">(compulsory for verification)</span>
            </label>
            <input
              id="cs-tin"
              type="text"
              placeholder="e.g. 123456789012"
              value={tinNumber}
              onChange={(e) => setTinNumber(e.target.value)}
              required
            />
          </div>

          <div className="field">
            <label htmlFor="cs-tagline">Tagline <span className="field-hint">(what you do · industry · location)</span></label>
            <input id="cs-tagline" type="text" placeholder="Autonomous warehouse drones · Robotics · Singapore" value={tagline} onChange={(e) => setTagline(e.target.value)} />
          </div>

          <div className="field">
            <label htmlFor="cs-overview">Overview</label>
            <textarea id="cs-overview" rows="3" placeholder="What problem you're solving and how." value={overview} onChange={(e) => setOverview(e.target.value)} />
          </div>

          <div className="field">
            <label htmlFor="cs-tags">Tags</label>
            <input id="cs-tags" type="text" placeholder="AI, Robotics, Warehousing" value={tags} onChange={(e) => setTags(e.target.value)} />
          </div>

          <div className="field">
            <label htmlFor="cs-goal">Funding goal ($) <span className="field-hint">(optional — leave blank if you're not raising yet)</span></label>
            <input id="cs-goal" type="number" min="0" step="1000" placeholder="0" value={goal} onChange={(e) => setGoal(e.target.value)} />
          </div>

          <div style={{ margin: '12px 0 16px', padding: '10px 12px', background: 'var(--warning-soft)', borderRadius: 8, border: '1px solid var(--warning)', fontSize: 12.5, color: 'var(--text)' }}>
            <b>Admin Approval Required:</b> Newly registered startups must be verified by an administrator. Until approved, your startup status will be <b>Pending</b> and will not be publicly visible.
          </div>

          {error && <p className="modal-error">{error}</p>}
          <div className="modal-actions">
            <button type="button" className="btn btn-outline btn-sm" onClick={handleClose}>Cancel</button>
            <button type="submit" className="btn btn-accent btn-sm" disabled={busy}>{busy ? 'Submitting…' : 'Register Startup'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
