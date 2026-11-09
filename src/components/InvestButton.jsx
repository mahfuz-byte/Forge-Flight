import { useState } from 'react';
import { Icon } from './IconSprite';
import { useApp } from '../context/AppContext';

const MIN_AMOUNT = 100;

export default function InvestButton({ startupId, suggested = 5000, wide }) {
  const { addInvestment, startups, currentUser, signedIn } = useApp();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(suggested);
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const s = startups[startupId];
  const style = wide ? { width: '100%' } : undefined;

  if (s && s.ownerId === currentUser.id) return null;

  if (s && s.status !== 'open') {
    return (
      <button className="btn btn-outline btn-sm" style={style} disabled>
        {s.status === 'closed' ? 'Funding closed' : 'Opening soon'}
      </button>
    );
  }

  if (sent) {
    return <div className="invest-sent"><Icon name="check" />Investment request sent</div>;
  }

  if (!open) {
    return (
      <button className="btn btn-accent btn-sm" style={style} onClick={() => setOpen(true)} disabled={!signedIn} title={signedIn ? undefined : 'Sign in to invest'}>
        Invest Now
      </button>
    );
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const value = Number(amount);
    if (!value || value < MIN_AMOUNT) {
      setError(`The minimum investment is $${MIN_AMOUNT}.`);
      return;
    }
    setBusy(true);
    setError('');
    try {
      await addInvestment(startupId, value);
      setSent(true); // only after the server accepted it (BE-10)
    } catch (err) {
      setError(err.message || 'Could not send your request. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="invest-inline" onSubmit={handleSubmit}>
      <div className="invest-inline-row">
        <span className="invest-prefix">$</span>
        <input type="number" min={MIN_AMOUNT} step="100" value={amount} onChange={(e) => setAmount(e.target.value)} />
      </div>
      {error && <p className="modal-error" role="alert" style={{ margin: '6px 0' }}>{error}</p>}
      <div className="invest-inline-actions">
        <button type="button" className="btn btn-outline btn-sm" disabled={busy} onClick={() => { setOpen(false); setError(''); }}>Cancel</button>
        <button type="submit" className="btn btn-accent btn-sm" disabled={busy}>{busy ? 'Sending…' : 'Confirm'}</button>
      </div>
    </form>
  );
}
