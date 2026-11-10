import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fmtMoney } from '../../data/startups';
import { adminApi } from '../adminApi';
import { AdminTable, ErrorState, FilterBar, Pagination, Pill, SearchFilter, SelectFilter, StatCard, Tabs, fmtDate } from '../components';
import useAdminList from '../useAdminList';

const STATUSES = [['pending', 'Pending'], ['accepted', 'Accepted'], ['rejected', 'Rejected'], ['withdrawn', 'Withdrawn'], ['completed', 'Completed']];

function Requests() {
  const list = useAdminList('/investments/', { filterKeys: ['q', 'status', 'startup', 'min_amount', 'max_amount'] });
  const { filters, setFilter } = list;
  const columns = [
    { key: 'created_at', label: 'Requested', render: (i) => fmtDate(i.created_at) },
    { key: 'investor', label: 'Investor', render: (i) => <>{i.investor_name}<br /><span className="admin-sub">{i.investor_email}</span></> },
    { key: 'startup', label: 'Startup', render: (i) => <Link to={`/profile/${i.startup}`} target="_blank" rel="noreferrer">{i.startup_name}</Link> },
    { key: 'amount', label: 'Amount', render: (i) => <b className="mono">{fmtMoney(i.amount)}</b> },
    { key: 'status', label: 'Status', render: (i) => <Pill value={i.status} /> },
    {
      key: 'decision', label: 'Decision',
      render: (i) => (i.decided_at
        ? <>{fmtDate(i.decided_at)} by {i.decided_by_name || 'unknown'}{i.decision_note && <><br /><span className="admin-sub">“{i.decision_note}”</span></>}</>
        : <span className="admin-sub">—</span>),
    },
  ];
  return (
    <>
      <FilterBar>
        <SearchFilter value={filters.q} onChange={(v) => setFilter('q', v)} placeholder="Search investor or startup" />
        <SelectFilter label="Status" value={filters.status} onChange={(v) => setFilter('status', v)} options={STATUSES} />
        <label className="admin-filter">
          <span className="admin-filter-label">Min $</span>
          <input type="number" min="0" value={filters.min_amount} onChange={(e) => setFilter('min_amount', e.target.value)} style={{ width: 110 }} />
        </label>
        <label className="admin-filter">
          <span className="admin-filter-label">Max $</span>
          <input type="number" min="0" value={filters.max_amount} onChange={(e) => setFilter('max_amount', e.target.value)} style={{ width: 110 }} />
        </label>
      </FilterBar>
      <AdminTable columns={columns} rows={list.rows} loading={list.loading} error={list.error} onRetry={list.reload} empty="No investment requests match." />
      <Pagination page={list.page} totalPages={list.totalPages} count={list.count} onPage={list.setPage} noun="requests" />
    </>
  );
}

function FundingMonitor() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const load = useCallback(() => { setError(null); adminApi.get('/investments/summary/').then(setData).catch(setError); }, []);
  useEffect(load, [load]);
  if (error) return <ErrorState error={error} onRetry={load} />;
  if (!data) return <p className="admin-muted">Loading…</p>;
  const s = (k) => data.by_status[k] || { count: 0, amount: 0 };
  const columns = [
    { key: 'name', label: 'Startup', render: (r) => <Link to={`/profile/${r.slug}`} target="_blank" rel="noreferrer">{r.name}</Link> },
    { key: 'status', label: 'Round', render: (r) => <Pill value={r.status === 'open' ? 'open' : 'closed'} label={r.status} /> },
    { key: 'goal', label: 'Goal', render: (r) => fmtMoney(r.goal) },
    { key: 'raised', label: 'Raised', render: (r) => <>{fmtMoney(r.raised)} <span className="admin-sub">({r.funding_pct}%)</span></> },
    { key: 'split', label: 'Prior + platform', render: (r) => <span className="admin-sub">{fmtMoney(r.external_raised)} + {fmtMoney(r.platform_raised)}</span> },
    { key: 'pending', label: 'Pending', render: (r) => (r.pending_count ? `${r.pending_count} · ${fmtMoney(r.pending_amount)}` : '—') },
    { key: 'drift', label: 'Check', render: (r) => (r.drift === 0 ? <Pill value="approved" label="OK" /> : <Pill value="rejected" label={`Off by ${fmtMoney(r.drift)}`} />) },
  ];
  return (
    <>
      <section className="admin-stats">
        <StatCard label="Pending" value={s('pending').count} hint={fmtMoney(s('pending').amount)} tone={s('pending').count ? 'warning' : undefined} />
        <StatCard label="Accepted" value={s('accepted').count + s('completed').count} hint={fmtMoney(s('accepted').amount + s('completed').amount)} tone="success" />
        <StatCard label="Rejected" value={s('rejected').count} hint={fmtMoney(s('rejected').amount)} />
        <StatCard label="Withdrawn" value={s('withdrawn').count} hint={fmtMoney(s('withdrawn').amount)} />
      </section>
      <AdminTable columns={columns} rows={data.rounds} rowKey="slug" empty="No funding rounds yet." />
      <p className="admin-muted">“Check” compares each startup’s raised total with its prior funding plus accepted investments. Anything other than OK needs a look.</p>
    </>
  );
}

export default function Investments() {
  const [tab, setTab] = useState('requests');
  return (
    <div className="admin-page">
      <div className="admin-page-head"><h1>Investments</h1></div>
      <Tabs tabs={[['requests', 'Requests & decisions'], ['monitor', 'Funding monitor']]} value={tab} onChange={setTab} />
      {tab === 'requests' ? <Requests /> : <FundingMonitor />}
    </div>
  );
}
