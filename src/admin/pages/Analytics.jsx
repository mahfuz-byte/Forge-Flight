import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { BASE_URL } from '../../api/client';
import { fmtMoney } from '../../data/startups';
import { adminApi } from '../adminApi';
import { useAdmin } from '../context';
import { ErrorState, StatCard } from '../components';

const DATASETS = [
  ['users', 'Users', 'users.view'],
  ['startups', 'Startups', 'startups.view'],
  ['investments', 'Investments', 'investments.view'],
  ['applications', 'Applications', 'collaborations.view'],
];

function isoDaysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

/** Line-free mini bar chart for arbitrary daily/weekly buckets. */
function Series({ title, labels, values, format = (v) => v.toLocaleString() }) {
  const max = Math.max(1, ...values);
  const total = values.reduce((a, b) => a + b, 0);
  const w = 100 / Math.max(values.length, 1);
  return (
    <figure className="admin-chart">
      <figcaption><span>{title}</span><b>{format(total)}</b></figcaption>
      <svg viewBox="0 0 100 50" preserveAspectRatio="none" role="img" aria-label={`${title}: ${format(total)} in this period`}>
        {values.map((v, i) => {
          const h = (v / max) * 46;
          return (
            <rect key={labels[i]} x={i * w + w * 0.12} y={50 - h} width={w * 0.76} height={Math.max(h, v ? 0.8 : 0)} rx="0.4">
              <title>{`${labels[i]}: ${format(v)}`}</title>
            </rect>
          );
        })}
      </svg>
      <div className="admin-chart-axis" style={{ gridTemplateColumns: '1fr 1fr' }} aria-hidden="true">
        <span style={{ textAlign: 'left' }}>{labels[0]}</span>
        <span style={{ textAlign: 'right' }}>{labels[labels.length - 1]}</span>
      </div>
    </figure>
  );
}

export default function Analytics() {
  const { can } = useAdmin();
  const [range, setRange] = useState({ from: isoDaysAgo(29), to: isoDaysAgo(0) });
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  const load = useCallback(() => {
    setError(null);
    adminApi.get('/analytics/', range).then(setData).catch(setError);
  }, [range]);
  useEffect(load, [load]);

  const preset = (days) => setRange({ from: isoDaysAgo(days - 1), to: isoDaysAgo(0) });
  const t = data?.totals;
  const pct = (v) => (v === null || v === undefined ? '—' : `${v}%`);

  return (
    <div className="admin-page">
      <div className="admin-page-head"><h1>Analytics</h1></div>
      <div className="admin-filter-bar">
        {[[7, '7 days'], [30, '30 days'], [90, '90 days'], [365, '12 months']].map(([d, l]) => (
          <button key={d} type="button" className="btn btn-outline btn-sm" onClick={() => preset(d)}>{l}</button>
        ))}
        <label className="admin-filter"><span className="admin-filter-label">From</span>
          <input type="date" value={range.from} max={range.to} onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))} />
        </label>
        <label className="admin-filter"><span className="admin-filter-label">To</span>
          <input type="date" value={range.to} min={range.from} onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))} />
        </label>
      </div>

      {error && <ErrorState error={error} onRetry={load} />}
      {!data && !error && <p className="admin-muted">Loading…</p>}
      {data && (
        <>
          <section className="admin-stats">
            <StatCard label="New users" value={t.new_users.toLocaleString()} />
            <StatCard label="New startups" value={t.new_startups.toLocaleString()} />
            <StatCard label="Investment requests" value={t.investment_requests.toLocaleString()} hint={`${fmtMoney(t.investment_requested_amount)} requested`} />
            <StatCard label="Investments accepted" value={t.investments_accepted.toLocaleString()} hint={`${fmtMoney(t.investment_accepted_amount)} · ${pct(t.investment_acceptance_rate)} acceptance`} tone="success" />
            <StatCard label="Applications" value={t.applications.toLocaleString()} hint={`${pct(t.application_acceptance_rate)} accepted`} />
          </section>
          <section className="admin-charts">
            <Series title={`New users per ${data.unit}`} labels={data.series.labels} values={data.series.new_users} />
            <Series title={`New startups per ${data.unit}`} labels={data.series.labels} values={data.series.new_startups} />
            <Series title={`Investment requests per ${data.unit}`} labels={data.series.labels} values={data.series.investment_requests} />
            <Series title={`Accepted investment per ${data.unit}`} labels={data.series.labels} values={data.series.investment_accepted_amount} format={fmtMoney} />
          </section>
          <section className="admin-card">
            <h2>Top startups by funding</h2>
            {data.top_startups.length === 0 ? <p className="admin-muted">No approved startups yet.</p> : (
              <ol style={{ margin: 0, paddingLeft: 20, display: 'grid', gap: 6 }}>
                {data.top_startups.map((s) => (
                  <li key={s.slug}>
                    <Link to={`/profile/${s.slug}`} target="_blank" rel="noreferrer">{s.name}</Link>{' '}
                    <span className="admin-sub">{fmtMoney(s.raised)} of {fmtMoney(s.goal)} · {s.followers} followers</span>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </>
      )}

      <section className="admin-card">
        <h2>Download reports (CSV)</h2>
        <p className="admin-muted" style={{ marginTop: 0 }}>Records created between {range.from} and {range.to}. Downloads are logged.</p>
        <div className="admin-row-actions">
          {DATASETS.filter(([, , cap]) => can(cap)).map(([key, label]) => (
            <a
              key={key}
              className="btn btn-outline btn-sm"
              href={`${BASE_URL}/admin/analytics/export/?dataset=${key}&from=${range.from}&to=${range.to}`}
              download
            >
              {label}.csv
            </a>
          ))}
        </div>
      </section>
    </div>
  );
}
