import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fmtMoney } from '../../data/startups';
import { timeAgo } from '../../utils/timeAgo';
import { adminApi } from '../adminApi';
import { BarChart, ErrorState, StatCard } from '../components';

const ACTIVITY_LABELS = {
  user: 'New user',
  startup: 'Startup',
  investment: 'Investment',
  application: 'Collaboration',
  report: 'Report',
};

export default function AdminDashboard() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  const load = useCallback(() => {
    setError(null);
    adminApi.get('/dashboard/').then(setData).catch(setError);
  }, []);
  useEffect(load, [load]);

  if (error) return <ErrorState error={error} onRetry={load} />;
  if (!data) return <p className="admin-muted">Loading dashboard…</p>;

  const { stats, charts, recent_activity: activity } = data;
  const n = (v) => v.toLocaleString();

  return (
    <div className="admin-page">
      <div className="admin-page-head">
        <h1>Dashboard</h1>
        <button type="button" className="btn btn-outline btn-sm" onClick={load}>Refresh</button>
      </div>

      <section className="admin-stats" aria-label="Platform totals">
        <StatCard label="Total users" value={n(stats.total_users)} hint={stats.suspended_users ? `${n(stats.suspended_users)} suspended` : 'None suspended'} />
        <StatCard label="Active users" value={n(stats.active_users)} hint={`Signed in within ${stats.active_window_days} days`} />
        <StatCard label="Total startups" value={n(stats.total_startups)} />
        <StatCard label="Pending approvals" value={n(stats.pending_startup_approvals)} hint="Startups not yet verified" tone={stats.pending_startup_approvals ? 'warning' : undefined} />
        <StatCard label="Investment requests" value={n(stats.investment_requests)} hint={`${fmtMoney(stats.investment_requests_amount)} pending`} />
        <StatCard label="Accepted investments" value={n(stats.accepted_investments)} hint={`${fmtMoney(stats.accepted_investments_amount)} committed`} tone="success" />
        <StatCard label="Pending collaborations" value={n(stats.pending_collaborations)} hint="Applications awaiting a founder" />
        <StatCard label="Reported content" value={n(stats.reported_content)} hint="Open reports" tone={stats.reported_content ? 'warning' : undefined} />
      </section>

      <section className="admin-charts" aria-label="Growth">
        <BarChart title="User growth" months={charts.months} values={charts.user_growth} />
        <BarChart title="Startup growth" months={charts.months} values={charts.startup_growth} />
        <BarChart title="Investment requests" months={charts.months} values={charts.investment_requests} />
        <BarChart title="Investment accepted" months={charts.months} values={charts.investment_accepted_amount} format={fmtMoney} />
      </section>

      <section className="admin-card">
        <h2>Recent platform activity</h2>
        {activity.length === 0 ? (
          <p className="admin-muted">No activity yet.</p>
        ) : (
          <ul className="admin-activity">
            {activity.map((e, i) => (
              <li key={`${e.type}-${e.at}-${i}`}>
                <span className={`admin-badge type-${e.type}`}>{ACTIVITY_LABELS[e.type] || e.type}</span>
                <span className="admin-activity-text">
                  {e.link ? <Link to={e.link}>{e.text}</Link> : e.text}
                </span>
                <time dateTime={e.at} title={new Date(e.at).toLocaleString()}>{timeAgo(e.at)}</time>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
