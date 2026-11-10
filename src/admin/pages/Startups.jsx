import { useState } from 'react';
import { Link } from 'react-router-dom';
import { fmtMoney } from '../../data/startups';
import { adminApi } from '../adminApi';
import { useAdmin } from '../context';
import { AdminTable, FilterBar, Pagination, Pill, ReasonDialog, SearchFilter, SelectFilter, fmtDate } from '../components';
import useAdminList from '../useAdminList';

const REVIEW = [['pending', 'Pending review'], ['approved', 'Approved'], ['rejected', 'Rejected'], ['suspended', 'Suspended']];
const DECISIONS = {
  approve: { label: 'Approve', from: ['pending', 'rejected'], noteRequired: false, text: 'It becomes public immediately and the founder is notified.' },
  reject: { label: 'Reject', from: ['pending'], noteRequired: true, danger: true, text: 'The founder sees your note and can edit and resubmit.' },
  suspend: { label: 'Suspend', from: ['approved', 'pending'], noteRequired: true, danger: true, text: 'It is hidden from the public and stops taking investments.' },
  restore: { label: 'Restore', from: ['suspended'], noteRequired: false, text: 'It becomes public again.' },
};

export default function Startups() {
  const { can } = useAdmin();
  const list = useAdminList('/startups/', { filterKeys: ['q', 'review_status', 'featured', 'status'] });
  const { filters, setFilter } = list;
  const [dialog, setDialog] = useState(null); // { startup, decision }
  const [flagError, setFlagError] = useState('');
  const manage = can('startups.manage');

  async function setFlag(s, field, value) {
    setFlagError('');
    try {
      await adminApi.post(`/startups/${s.slug}/flags/`, { [field]: value });
      list.reload();
    } catch (err) {
      setFlagError(err.message);
    }
  }

  const columns = [
    {
      key: 'name', label: 'Startup',
      render: (s) => (
        <>
          <Link to={`/profile/${s.slug}`} target="_blank" rel="noreferrer">{s.name}</Link>
          {s.featured && <span className="admin-pill tone-good" style={{ marginLeft: 6 }}>Featured</span>}
          {s.verified && <span className="admin-pill tone-muted" style={{ marginLeft: 6 }}>Verified</span>}
          <br /><span className="admin-sub">{s.tagline}</span>
        </>
      ),
    },
    { key: 'owner', label: 'Founder', render: (s) => <>{s.owner_name}<br /><span className="admin-sub">{s.owner_email}</span></> },
    {
      key: 'review_status', label: 'Review',
      render: (s) => (
        <>
          <Pill value={s.review_status} label={REVIEW.find(([v]) => v === s.review_status)?.[1]} />
          {s.review_note && <><br /><span className="admin-sub">“{s.review_note}”</span></>}
        </>
      ),
    },
    { key: 'funding', label: 'Funding', render: (s) => (s.goal ? <>{fmtMoney(s.raised)} / {fmtMoney(s.goal)}<br /><span className="admin-sub">Round {s.status}</span></> : <span className="admin-sub">No round</span>) },
    { key: 'open_reports', label: 'Reports', render: (s) => (s.open_reports ? <Pill value="open" label={`${s.open_reports} open`} /> : '—') },
    { key: 'created_at', label: 'Created', render: (s) => fmtDate(s.created_at) },
    manage && {
      key: 'actions', label: 'Actions',
      render: (s) => (
        <div className="admin-row-actions">
          {Object.entries(DECISIONS).filter(([, d]) => d.from.includes(s.review_status)).map(([key, d]) => (
            <button key={key} type="button" className={`btn btn-sm ${d.danger ? 'btn-outline' : 'btn-accent'}`} onClick={() => setDialog({ startup: s, decision: key })}>
              {d.label}
            </button>
          ))}
          {s.review_status === 'approved' && (
            <button type="button" className="btn btn-outline btn-sm" onClick={() => setFlag(s, 'featured', !s.featured)}>
              {s.featured ? 'Unfeature' : 'Feature'}
            </button>
          )}
          <button type="button" className="btn btn-outline btn-sm" onClick={() => setFlag(s, 'verified', !s.verified)}>
            {s.verified ? 'Unverify' : 'Verify'}
          </button>
        </div>
      ),
    },
  ].filter(Boolean);

  const d = dialog && DECISIONS[dialog.decision];
  return (
    <div className="admin-page">
      <div className="admin-page-head">
        <h1>Startups</h1>
        <button type="button" className="btn btn-outline btn-sm" onClick={() => setFilter('review_status', 'pending')}>Review queue</button>
      </div>
      <FilterBar>
        <SearchFilter value={filters.q} onChange={(v) => setFilter('q', v)} placeholder="Search name or founder email" />
        <SelectFilter label="Review" value={filters.review_status} onChange={(v) => setFilter('review_status', v)} options={REVIEW} />
        <SelectFilter label="Featured" value={filters.featured} onChange={(v) => setFilter('featured', v)} options={[['1', 'Featured'], ['0', 'Not featured']]} />
        <SelectFilter label="Round" value={filters.status} onChange={(v) => setFilter('status', v)} options={[['open', 'Open'], ['soon', 'Opening soon'], ['closed', 'Closed']]} />
      </FilterBar>
      {flagError && <p className="admin-form-error" role="alert">{flagError}</p>}
      <AdminTable columns={columns} rows={list.rows} loading={list.loading} error={list.error} onRetry={list.reload} rowKey="slug" empty="No startups match these filters." />
      <Pagination page={list.page} totalPages={list.totalPages} count={list.count} onPage={list.setPage} noun="startups" />
      {dialog && (
        <ReasonDialog
          title={`${d.label} ${dialog.startup.name}?`}
          description={d.text}
          label={d.noteRequired ? 'Note for the founder' : 'Note'}
          required={d.noteRequired}
          danger={d.danger}
          confirmLabel={d.label}
          onSubmit={async (note) => {
            await adminApi.post(`/startups/${dialog.startup.slug}/review/`, { decision: dialog.decision, note });
            list.reload();
          }}
          onClose={() => setDialog(null)}
        />
      )}
    </div>
  );
}
