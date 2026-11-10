import { useState } from 'react';
import { Link } from 'react-router-dom';
import { mediaUrl } from '../../api/client';
import { adminApi } from '../adminApi';
import { AdminTable, FilterBar, Pagination, Pill, ReasonDialog, SearchFilter, SelectFilter, Tabs, fmtDate } from '../components';
import useAdminList from '../useAdminList';

function ContentList({ kind }) {
  const path = kind === 'post' ? '/posts/' : '/comments/';
  const list = useAdminList(path, { filterKeys: ['q', 'reported'] });
  const { filters, setFilter } = list;
  const [removing, setRemoving] = useState(null);

  const columns = [
    {
      key: 'content', label: kind === 'post' ? 'Post' : 'Comment',
      render: (r) => (
        <>
          {kind === 'post' && <b>{r.title}</b>}
          <div className="admin-sub" style={{ whiteSpace: 'pre-wrap' }}>{(r.text || '').slice(0, 280)}</div>
          {r.media && <a className="admin-sub" href={mediaUrl(r.media)} target="_blank" rel="noreferrer">View attachment</a>}
        </>
      ),
    },
    { key: 'author', label: 'Author', render: (r) => <>{r.author_name || 'Deleted user'}<br /><span className="admin-sub">{r.author_email}</span></> },
    { key: 'startup', label: 'Where', render: (r) => (r.startup ? <Link to={`/profile/${r.startup}`} target="_blank" rel="noreferrer">{r.startup_name}</Link> : <span className="admin-sub">Personal</span>) },
    { key: 'open_reports', label: 'Reports', render: (r) => (r.open_reports ? <Pill value="open" label={`${r.open_reports} open`} /> : '—') },
    { key: 'created_at', label: 'Posted', render: (r) => fmtDate(r.created_at) },
    { key: 'actions', label: 'Actions', render: (r) => <button type="button" className="btn btn-outline btn-sm" onClick={() => setRemoving(r)}>Remove</button> },
  ];

  return (
    <>
      <FilterBar>
        <SearchFilter value={filters.q} onChange={(v) => setFilter('q', v)} placeholder={`Search ${kind}s or author email`} />
        <SelectFilter label="Reports" value={filters.reported} onChange={(v) => setFilter('reported', v)} options={[['1', 'Has open reports']]} />
      </FilterBar>
      <AdminTable columns={columns} rows={list.rows} loading={list.loading} error={list.error} onRetry={list.reload} empty={`No ${kind}s match.`} />
      <Pagination page={list.page} totalPages={list.totalPages} count={list.count} onPage={list.setPage} noun={`${kind}s`} />
      {removing && (
        <ReasonDialog
          title={`Remove this ${kind}?`}
          description="It is deleted permanently. The author is notified with your reason, and any open reports on it are closed."
          label="Reason (sent to the author)"
          confirmLabel="Remove"
          danger
          onSubmit={async (reason) => {
            await adminApi.delete(`${path}${removing.id}/?reason=${encodeURIComponent(reason)}`);
            list.reload();
          }}
          onClose={() => setRemoving(null)}
        />
      )}
    </>
  );
}

export default function Community() {
  const [tab, setTab] = useState('post');
  return (
    <div className="admin-page">
      <div className="admin-page-head">
        <h1>Community</h1>
        <span className="admin-muted">Reported content is listed first.</span>
      </div>
      <Tabs tabs={[['post', 'Posts'], ['comment', 'Comments']]} value={tab} onChange={setTab} />
      <ContentList key={tab} kind={tab} />
    </div>
  );
}
