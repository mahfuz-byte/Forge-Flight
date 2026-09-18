import { useNavigate } from 'react-router-dom';
import LogoBadge from './LogoBadge';
import { useApp } from '../context/AppContext';

const RECOMMENDED = ['ecoride', 'nimbus'];

export default function RightRail() {
  const navigate = useNavigate();
  const { startups } = useApp();
  return (
    <aside className="side-right">
      <div className="widget">
        <h4>Upcoming Funding Deadlines</h4>
        <div className="deadline-row"><span className="d-left">MedAI</span><span className="d-right status-soon" style={{ color: 'var(--warning)' }}>3 days left</span></div>
        <div className="deadline-row"><span className="d-left">EcoRide</span><span className="d-right" style={{ color: 'var(--text-muted)' }}>5 days left</span></div>
        <div className="deadline-row"><span className="d-left">FarmChain</span><span className="d-right" style={{ color: 'var(--text-muted)' }}>7 days left</span></div>
      </div>
      <div className="widget">
        <h4>Recommended for You</h4>
        <p style={{ fontSize: 11.5, color: 'var(--text-faint)', marginBottom: 10 }}>Because you follow AI &amp; Healthcare</p>
        {RECOMMENDED.map((id) => {
          const s = startups[id];
          return (
            <div className="trend-row" key={id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/profile/${id}`)}>
              <LogoBadge id={id} initials={s.initials} size={32} />
              <div><div className="t-name">{s.name}</div><div className="t-meta">{s.tags[0]}</div></div>
            </div>
          );
        })}
      </div>
      <div className="widget">
        <h4>Platform Stats</h4>
        <div className="stat-grid">
          <div className="stat-tile"><b>520</b><span>Active Startups</span></div>
          <div className="stat-tile"><b>46</b><span>Funding Open</span></div>
          <div className="stat-tile"><b>103</b><span>Collaborations</span></div>
          <div className="stat-tile"><b>38</b><span>Investors Online</span></div>
        </div>
      </div>
    </aside>
  );
}
