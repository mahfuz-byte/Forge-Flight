import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon } from './IconSprite';
import { api } from '../api/client';
import { useApp } from '../context/AppContext';

const REASONS = [
  ['spam', 'Spam or advertising'],
  ['scam', 'Scam or fraud'],
  ['harassment', 'Harassment or hate'],
  ['inappropriate', 'Inappropriate content'],
  ['misinformation', 'False or misleading'],
  ['other', 'Something else'],
];

/** Sends a real report to moderators (reviewed in the admin panel). */
export default function ReportButton({ targetType, targetId, className = 'action-btn' }) {
  const { signedIn } = useApp();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('spam');
  const [details, setDetails] = useState('');
  const [state, setState] = useState('idle'); // idle | sending | done
  const [error, setError] = useState('');

  if (state === 'done') {
    return <button type="button" className={`${className} reported`} disabled><Icon name="flag" />Reported</button>;
  }

  async function submit(e) {
    e.preventDefault();
    setState('sending');
    setError('');
    try {
      await api.post('/reports/', { target_type: targetType, target_id: String(targetId), reason, details: details.trim() });
      setState('done');
      setOpen(false);
    } catch (err) {
      setError(err.message || 'Could not send the report.');
      setState('idle');
    }
  }

  return (
    <span className="report-wrap">
      <button
        type="button"
        className={className}
        aria-expanded={open}
        onClick={() => (signedIn ? setOpen((v) => !v) : navigate('/login'))}
      >
        <Icon name="flag" />Report
      </button>
      {open && (
        <form className="report-pop" onSubmit={submit}>
          <b>Why are you reporting this?</b>
          {REASONS.map(([value, label]) => (
            <label key={value} className="report-reason">
              <input type="radio" name={`reason-${targetType}-${targetId}`} value={value} checked={reason === value} onChange={() => setReason(value)} />
              {label}
            </label>
          ))}
          <textarea rows="2" maxLength={1000} placeholder="Anything moderators should know? (optional)" value={details} onChange={(e) => setDetails(e.target.value)} />
          {error && <p className="modal-error" role="alert" style={{ margin: 0 }}>{error}</p>}
          <div className="report-actions">
            <button type="button" className="btn btn-outline btn-sm" onClick={() => setOpen(false)}>Cancel</button>
            <button type="submit" className="btn btn-accent btn-sm" disabled={state === 'sending'}>{state === 'sending' ? 'Sending…' : 'Send report'}</button>
          </div>
        </form>
      )}
    </span>
  );
}
