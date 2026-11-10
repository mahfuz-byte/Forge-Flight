import { useState } from 'react';
import { Link } from 'react-router-dom';
import { adminApi } from '../adminApi';
import { useAdmin } from '../context';
import { AdminTable, FilterBar, Pagination, Pill, ReasonDialog, SearchFilter, SelectFilter, fmtDate } from '../components';
import useAdminList from '../useAdminList';

const TARGETS = [['post', 'Post'], ['comment', 'Comment'], ['startup', 'Startup'], ['user', 'Person']];
const REASONS = [
  ['spam', 'Spam'], ['scam', 'Scam or fraud'], ['harassment', 'Harassment'],
  ['inappropriate', 'Inappropriate'], ['misinformation', 'Misleading'], ['other', 'Other'],
];

// Which follow-up actions make sense for each kind of target, and who may take them.
const ACTIONS = {
  post: [['remove_content', 'Remove the post', 'content.moderate']],
  comment: [['remove_content', 'Remove the comment', 'content.moderate']],
  startup: [['suspend_startup', 'Suspend the startup', 'startups.manage']],
  user: [['suspend_user', 'Suspend the account', 'users.manage']],
};

function ResolveDialog({ report, onDone, onClose }) {
  const { can } = useAdmin();
  const options = [['none', 'No further action', null], ...(ACTIONS[report.target_type] || [])]
    .filter(([, , cap]) => !cap || can(cap));
  const [action, setAction] = useState('none');
  return (
    <ReasonDialog
      title="Resolve report"
      description={`This closes all ${report.same_target_open || 1} open report(s) on “${report.target_repr || report.target_id}”.`}
      label="What did you find and do?"
      confirmLabel="Resolve"
      danger={action !== 'none'}
      onSubmit={async (resolution) => {
        await adminApi.post(`/reports/${report.id}/resolve/`, { resolution, action });
        onDone();
      }}
      onClose={onClose}
    >
      {report.target.exists && options.length > 1 && (
        <fieldset className="admin-field" style={{ border: 'none', padding: 0, margin: 0 }}>
          <legend style={{ marginBottom: 6 }}>Action</legend>
          {options.map(([value, label]) => (
            <label key={value} style={{ display: 'flex', gap: 8, fontWeight: 400 }}>
              <input type="radio" name="report-action" value={value} checked={action === value} onChange={() => setAction(value)} />
              {label}
            </label>
          ))}
        </fieldset>
      )}
    </ReasonDialog>
  );
}

export default function Reports() {
  const list = useAdminList('/reports/', { filterKeys: ['status', 'target_type', 'reason', 'q'] });
  const { filters, setFilter } = list;
  const [dialog, setDialog] = useState(null); // { kind: 'resolve'|'dismiss', report }

  const columns = [
    {
      key: 'target', label: 'Reported',
      render: (r) => (
        <>
          <span className="admin-pill tone-muted">{TARGETS.find(([v]) => v === r.target_type)?.[1]}</span>{' '}
          {r.target.exists && r.target.link
            ? <Link to={r.target.link} target="_blank" rel="noreferrer">{r.target_repr || r.target_id}</Link>
            : <span>{r.target_repr || r.target_id}</span>}
          {!r.target.exists && <span className="admin-sub"> (removed)</span>}
          {r.target.text && <div className="admin-sub">{r.target.text.slice(0, 200)}</div>}
        </>
      ),
    },
    {
      key: 'reason', label: 'Reason',
      render: (r) => <>{r.reason_label}{r.details && <div className="admin-sub">“{r.details}”</div>}</>,
    },
    { key: 'reporter', label: 'Reporter', render: (r) => <span className="admin-sub">{r.reporter_email || 'Deleted user'}</span> },
    { key: 'same', label: 'Open on item', render: (r) => (r.status === 'open' ? r.same_target_open : '—') },
    {
      key: 'status', label: 'Status',
      render: (r) => (
        <>
          <Pill value={r.status} />
          {r.resolution && <div className="admin-sub">{r.handled_by_name}: “{r.resolution}”</div>}
        </>
      ),
    },
    { key: 'created_at', label: 'Filed', render: (r) => fmtDate(r.created_at) },
    {
      key: 'actions', label: 'Actions',
      render: (r) => (r.status === 'open' ? (
        <div className="admin-row-actions">
          <button type="button" className="btn btn-accent btn-sm" onClick={() => setDialog({ kind: 'resolve', report: r })}>Resolve</button>
          <button type="button" className="btn btn-outline btn-sm" onClick={() => setDialog({ kind: 'dismiss', report: r })}>Dismiss</button>
        </div>
      ) : '—'),
    },
  ];

  return (
    <div className="admin-page">
      <div className="admin-page-head">
        <h1>Reports</h1>
        <span className="admin-muted">Items with the most open reports come first.</span>
      </div>
      <FilterBar>
        <SearchFilter value={filters.q} onChange={(v) => setFilter('q', v)} placeholder="Search content, details or reporter" />
        <label className="admin-filter">
          <span className="admin-filter-label">Status</span>
          <select value={filters.status || 'open'} onChange={(e) => setFilter('status', e.target.value === 'open' ? '' : e.target.value)}>
            <option value="open">Open</option>
            <option value="resolved">Resolved</option>
            <option value="dismissed">Dismissed</option>
            <option value="all">All</option>
          </select>
        </label>
        <SelectFilter label="Type" value={filters.target_type} onChange={(v) => setFilter('target_type', v)} options={TARGETS} />
        <SelectFilter label="Reason" value={filters.reason} onChange={(v) => setFilter('reason', v)} options={REASONS} />
      </FilterBar>
      <AdminTable columns={columns} rows={list.rows} loading={list.loading} error={list.error} onRetry={list.reload} empty="No reports here. 🎉" />
      <Pagination page={list.page} totalPages={list.totalPages} count={list.count} onPage={list.setPage} noun="reports" />
      {dialog?.kind === 'resolve' && <ResolveDialog report={dialog.report} onDone={list.reload} onClose={() => setDialog(null)} />}
      {dialog?.kind === 'dismiss' && (
        <ReasonDialog
          title="Dismiss report"
          description="Use this when nothing breaks the rules. All open reports on this item are closed."
          label="Why is this fine?"
          confirmLabel="Dismiss"
          onSubmit={async (resolution) => { await adminApi.post(`/reports/${dialog.report.id}/dismiss/`, { resolution }); list.reload(); }}
          onClose={() => setDialog(null)}
        />
      )}
    </div>
  );
}
