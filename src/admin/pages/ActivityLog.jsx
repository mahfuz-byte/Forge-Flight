import { useState } from 'react';
import { AdminTable, DateFilter, FilterBar, Pagination, SearchFilter, SelectFilter } from '../components';
import useAdminList from '../useAdminList';

const ACTION_GROUPS = [
  ['auth.', 'Sign-in & security'],
  ['user.', 'Account changes'],
  ['investment.', 'Investments'],
  ['application.', 'Collaborations'],
  ['admin', 'Admin actions'],
  ['post.', 'Post moderation'],
  ['comment.', 'Comment moderation'],
  ['startup.', 'Startups'],
];

const ROLES = [
  ['user', 'Member'],
  ['support_admin', 'Support admin'],
  ['moderator', 'Moderator'],
  ['finance_admin', 'Finance admin'],
  ['admin', 'Admin'],
  ['super_admin', 'Super admin'],
];

function Details({ data }) {
  const [open, setOpen] = useState(false);
  const entries = Object.entries(data || {});
  if (entries.length === 0) return <span className="admin-muted">—</span>;
  return (
    <>
      <button type="button" className="admin-link-btn" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        {open ? 'Hide' : `${entries.length} detail${entries.length > 1 ? 's' : ''}`}
      </button>
      {open && <pre className="admin-json">{JSON.stringify(data, null, 2)}</pre>}
    </>
  );
}

const COLUMNS = [
  {
    key: 'created_at', label: 'When', width: '170px',
    render: (r) => <time dateTime={r.created_at}>{new Date(r.created_at).toLocaleString()}</time>,
  },
  {
    key: 'actor', label: 'Who',
    render: (r) => (r.actor_email
      ? <><b>{r.actor_email}</b><br /><span className="admin-muted">{r.actor_role}</span></>
      : <span className="admin-muted">System / anonymous</span>),
  },
  { key: 'action', label: 'Action', render: (r) => <code>{r.action}</code> },
  {
    key: 'target', label: 'Target',
    render: (r) => (r.target_repr || r.target_id
      ? <>{r.target_repr || r.target_id}<br /><span className="admin-muted">{r.target_type}</span></>
      : <span className="admin-muted">—</span>),
  },
  { key: 'data', label: 'Details', render: (r) => <Details data={r.data} /> },
  { key: 'ip', label: 'IP', render: (r) => <span className="mono">{r.ip || '—'}</span> },
];

export default function ActivityLog() {
  const list = useAdminList('/activity/', { filterKeys: ['q', 'action', 'actor_role', 'since', 'until'] });
  const { filters, setFilter } = list;

  return (
    <div className="admin-page">
      <div className="admin-page-head">
        <h1>Activity log</h1>
        <span className="admin-muted">Every sensitive and administrative action. Read-only.</span>
      </div>
      <FilterBar>
        <SearchFilter value={filters.q} onChange={(v) => setFilter('q', v)} placeholder="Search email, action or target" />
        <SelectFilter label="Type" value={filters.action} onChange={(v) => setFilter('action', v)} options={ACTION_GROUPS} />
        <SelectFilter label="Role" value={filters.actor_role} onChange={(v) => setFilter('actor_role', v)} options={ROLES} />
        <DateFilter label="From" value={filters.since} onChange={(v) => setFilter('since', v)} />
        <DateFilter label="To" value={filters.until} onChange={(v) => setFilter('until', v)} />
      </FilterBar>
      <AdminTable
        columns={COLUMNS}
        rows={list.rows}
        loading={list.loading}
        error={list.error}
        onRetry={list.reload}
        empty="No activity matches these filters."
      />
      <Pagination page={list.page} totalPages={list.totalPages} count={list.count} onPage={list.setPage} noun="entries" />
    </div>
  );
}
