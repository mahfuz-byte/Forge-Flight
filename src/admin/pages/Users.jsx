import { useCallback, useEffect, useState } from 'react';
import { adminApi } from '../adminApi';
import { useAdmin } from '../context';
import {
  AdminTable, DetailList, ErrorState, FilterBar, Pagination, Pill, ReasonDialog, SearchFilter, SelectFilter, fmtDate,
} from '../components';
import useAdminList from '../useAdminList';

export const ROLE_OPTIONS = [
  ['user', 'Member'], ['support_admin', 'Support admin'], ['moderator', 'Moderator'],
  ['finance_admin', 'Finance admin'], ['admin', 'Admin'], ['super_admin', 'Super admin'],
];
const roleLabel = (r) => (ROLE_OPTIONS.find(([v]) => v === r) || [r, r])[1];

function UserDetail({ id, onChanged, onClose }) {
  const { can, me } = useAdmin();
  const [user, setUser] = useState(null);
  const [error, setError] = useState(null);
  const [dialog, setDialog] = useState(null);

  const load = useCallback(() => {
    setError(null);
    adminApi.get(`/users/${id}/`).then(setUser).catch(setError);
  }, [id]);
  useEffect(load, [load]);

  async function act(kind, reason) {
    await adminApi.post(`/users/${id}/${kind}/`, { reason });
    load();
    onChanged();
  }

  if (error) return <ErrorState error={error} onRetry={load} />;
  if (!user) return <p className="admin-muted">Loading…</p>;
  const isSelf = user.id === me.id;

  return (
    <section className="admin-card" aria-label={`Details for ${user.name}`}>
      <div className="admin-page-head">
        <h2 style={{ margin: 0 }}>{user.name} <Pill value={user.is_active ? 'active' : 'suspended'} /></h2>
        <button type="button" className="btn btn-outline btn-sm" onClick={onClose}>Close</button>
      </div>
      <DetailList items={[
        ['Email', user.email],
        ['Role', roleLabel(user.role)],
        ['Email verified', user.email_verified ? 'Yes' : 'No'],
        ['Google linked', user.google_linked ? 'Yes' : 'No'],
        ['Joined', fmtDate(user.date_joined)],
        ['Last sign-in', fmtDate(user.last_login)],
        ['Startups', user.startups.length ? user.startups.map((s) => `${s.name} (${s.review_status})`).join(', ') : 'None'],
        ['Investment requests', `${user.investments_count} (accepted $${user.investments_accepted_amount.toLocaleString()})`],
        ['Applications', user.applications_count],
        ['Posts', user.posts_count],
        ['Open reports against', user.open_reports_against],
        user.location && ['Location', user.location],
      ]} />
      {can('users.manage') && !isSelf && (
        <div className="admin-row-actions" style={{ marginTop: 14 }}>
          {user.is_active ? (
            <button type="button" className="btn btn-danger btn-sm" onClick={() => setDialog('suspend')}>Suspend account</button>
          ) : (
            <button type="button" className="btn btn-accent btn-sm" onClick={() => setDialog('activate')}>Reactivate account</button>
          )}
        </div>
      )}
      {dialog === 'suspend' && (
        <ReasonDialog
          title={`Suspend ${user.name}?`}
          description="They are signed out and can't sign in until reactivated. Their content stays."
          confirmLabel="Suspend"
          danger
          onSubmit={(reason) => act('suspend', reason)}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog === 'activate' && (
        <ReasonDialog
          title={`Reactivate ${user.name}?`}
          description="They can sign in again and will get a notification."
          confirmLabel="Reactivate"
          required={false}
          onSubmit={(reason) => act('activate', reason)}
          onClose={() => setDialog(null)}
        />
      )}
    </section>
  );
}

export default function Users() {
  const list = useAdminList('/users/', { filterKeys: ['q', 'role', 'status', 'verified'] });
  const { filters, setFilter } = list;
  const [selected, setSelected] = useState(null);

  const columns = [
    {
      key: 'name', label: 'Person',
      render: (u) => (
        <button type="button" className="admin-link-btn" onClick={() => setSelected(u.id)}>
          {u.name}
        </button>
      ),
    },
    { key: 'email', label: 'Email' },
    { key: 'role', label: 'Role', render: (u) => roleLabel(u.role) },
    { key: 'status', label: 'Status', render: (u) => <Pill value={u.is_active ? 'active' : 'suspended'} /> },
    { key: 'startups_count', label: 'Startups' },
    { key: 'date_joined', label: 'Joined', render: (u) => fmtDate(u.date_joined) },
    { key: 'last_login', label: 'Last sign-in', render: (u) => fmtDate(u.last_login) },
  ];

  return (
    <div className="admin-page">
      <div className="admin-page-head"><h1>Users</h1></div>
      {selected && <UserDetail id={selected} onChanged={list.reload} onClose={() => setSelected(null)} />}
      <FilterBar>
        <SearchFilter value={filters.q} onChange={(v) => setFilter('q', v)} placeholder="Search name or email" />
        <SelectFilter label="Role" value={filters.role} onChange={(v) => setFilter('role', v)} options={ROLE_OPTIONS} />
        <SelectFilter label="Status" value={filters.status} onChange={(v) => setFilter('status', v)} options={[['active', 'Active'], ['suspended', 'Suspended']]} />
        <SelectFilter label="Email" value={filters.verified} onChange={(v) => setFilter('verified', v)} options={[['1', 'Verified'], ['0', 'Not verified']]} />
      </FilterBar>
      <AdminTable columns={columns} rows={list.rows} loading={list.loading} error={list.error} onRetry={list.reload} empty="No people match these filters." />
      <Pagination page={list.page} totalPages={list.totalPages} count={list.count} onPage={list.setPage} noun="people" />
    </div>
  );
}
