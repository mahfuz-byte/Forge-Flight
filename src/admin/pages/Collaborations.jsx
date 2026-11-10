import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { adminApi } from '../adminApi';
import { useAdmin } from '../context';
import { AdminTable, FilterBar, Pagination, Pill, ReasonDialog, SearchFilter, SelectFilter, Tabs, fmtDate } from '../components';
import useAdminList from '../useAdminList';

function Applications() {
  const list = useAdminList('/collaborations/', { filterKeys: ['q', 'status', 'startup'] });
  const { filters, setFilter } = list;
  const columns = [
    { key: 'created_at', label: 'Applied', render: (a) => fmtDate(a.created_at) },
    { key: 'applicant', label: 'Applicant', render: (a) => <>{a.name || a.applicant_name}<br /><span className="admin-sub">{a.applicant_email}</span></> },
    { key: 'role', label: 'Role', render: (a) => <>{a.role}<br /><Link className="admin-sub" to={`/profile/${a.startup}`} target="_blank" rel="noreferrer">{a.startup_name}</Link></> },
    { key: 'status', label: 'Status', render: (a) => <Pill value={a.status} /> },
    { key: 'message', label: 'Message', render: (a) => <span className="admin-sub">{a.message || '—'}</span> },
    { key: 'decided_at', label: 'Decided', render: (a) => fmtDate(a.decided_at) },
  ];
  return (
    <>
      <FilterBar>
        <SearchFilter value={filters.q} onChange={(v) => setFilter('q', v)} placeholder="Search applicant, role or startup" />
        <SelectFilter label="Status" value={filters.status} onChange={(v) => setFilter('status', v)} options={[['pending', 'Pending'], ['accepted', 'Accepted'], ['declined', 'Declined'], ['withdrawn', 'Withdrawn']]} />
      </FilterBar>
      <AdminTable columns={columns} rows={list.rows} loading={list.loading} error={list.error} onRetry={list.reload} empty="No applications match." />
      <Pagination page={list.page} totalPages={list.totalPages} count={list.count} onPage={list.setPage} noun="applications" />
    </>
  );
}

function Listings() {
  const { can } = useAdmin();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [closing, setClosing] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    adminApi.get('/collaborations/listings/')
      .then((d) => { setRows(d); setError(null); })
      .catch(setError)
      .finally(() => setLoading(false));
  }, []);
  useEffect(load, [load]);

  const columns = [
    { key: 'role', label: 'Opportunity', render: (r) => <>{r.role}<br /><Link className="admin-sub" to={`/profile/${r.startup}`} target="_blank" rel="noreferrer">{r.startup_name}</Link></> },
    { key: 'body', label: 'Description', render: (r) => <span className="admin-sub">{r.body}</span> },
    { key: 'is_open', label: 'Status', render: (r) => <Pill value={r.is_open ? 'open' : 'closed'} label={r.is_open ? 'Published' : 'Unpublished'} /> },
    { key: 'applicants', label: 'Applicants', render: (r) => `${r.applicants} (${r.pending} pending)` },
    can('collaborations.manage') && {
      key: 'actions', label: 'Actions',
      render: (r) => (r.is_open ? <button type="button" className="btn btn-outline btn-sm" onClick={() => setClosing(r)}>Unpublish</button> : '—'),
    },
  ].filter(Boolean);

  return (
    <>
      <AdminTable columns={columns} rows={rows} loading={loading} error={error} onRetry={load} rowKey="startup" empty="No collaboration listings yet." />
      {closing && (
        <ReasonDialog
          title={`Unpublish “${closing.role}”?`}
          description={`${closing.startup_name} stops receiving applications. The founder sees your note and can republish after fixing it.`}
          label="Note for the founder"
          confirmLabel="Unpublish"
          danger
          onSubmit={async (note) => { await adminApi.post(`/collaborations/listings/${closing.startup}/close/`, { note }); load(); }}
          onClose={() => setClosing(null)}
        />
      )}
    </>
  );
}

export default function Collaborations() {
  const [tab, setTab] = useState('applications');
  return (
    <div className="admin-page">
      <div className="admin-page-head"><h1>Collaborations</h1></div>
      <Tabs tabs={[['applications', 'Applications'], ['listings', 'Opportunities']]} value={tab} onChange={setTab} />
      {tab === 'applications' ? <Applications /> : <Listings />}
    </div>
  );
}
