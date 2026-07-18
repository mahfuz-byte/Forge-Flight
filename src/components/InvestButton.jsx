import { useState } from 'react';
import { Icon } from './IconSprite';
import { useApp } from '../context/AppContext';

export default function InvestButton({ startupId, suggested = 5000, wide }) {
  const { addInvestment } = useApp();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(suggested);
  const [sent, setSent] = useState(false);

  if (sent) {
    return <div className="invest-sent"><Icon name="check" />Investment request sent</div>;
  }

  if (!open) {
    return (
      <button className="btn btn-accent btn-sm" style={wide ? { width: '100%' } : undefined} onClick={() => setOpen(true)}>
        Invest Now
      </button>
    );
  }

  return (
    <form
      className="invest-inline"
      onSubmit={(e) => {
        e.preventDefault();
        addInvestment(startupId, Number(amount) || suggested);
        setSent(true);
      }}
    >
      <div className="invest-inline-row">
        <span className="invest-prefix">$</span>
        <input type="number" min="100" step="100" value={amount} onChange={(e) => setAmount(e.target.value)} />
      </div>
      <div className="invest-inline-actions">
        <button type="button" className="btn btn-outline btn-sm" onClick={() => setOpen(false)}>Cancel</button>
        <button type="submit" className="btn btn-accent btn-sm">Confirm</button>
      </div>
    </form>
  );
}
