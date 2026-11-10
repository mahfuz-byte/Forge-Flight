import { useEffect, useState } from 'react';
import { adminApi } from '../adminApi';
import { AdminTable, Pagination, fmtDate } from '../components';
import useAdminList from '../useAdminList';

const AUDIENCES = [
  ['all', 'Everyone'],
  ['founders', 'Founders (own a startup)'],
  ['investors', 'Investors (sent an investment request)'],
  ['collaborators', 'Collaborators (applied to a role)'],
  ['staff', 'Staff (any admin role)'],
  ['users', 'Specific people (by account ID)'],
];

function Composer({ onSent }) {
  const [text, setText] = useState('');
  const [link, setLink] = useState('');
  const [audience, setAudience] = useState('all');
  const [ids, setIds] = useState('');
  const [reach, setReach] = useState(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);
  const userIds = ids.split(/[\s,]+/).filter((v) => /^\d+$/.test(v));

  // Show how many people this will reach before sending.
  useEffect(() => {
    let cancelled = false;
    setReach(null);
    if (audience === 'users' && userIds.length === 0) return undefined;
    const t = window.setTimeout(() => {
      adminApi.get('/announcements/preview/', { audience, user_ids: userIds.join(',') })
        .then((d) => { if (!cancelled) setReach(d.recipients); })
        .catch(() => {});
    }, 300);
    return () => { cancelled = true; window.clearTimeout(t); };
  }, [audience, ids]); // eslint-disable-line react-hooks/exhaustive-deps

  async function send(e) {
    e.preventDefault();
    if (!window.confirm(`Send this to ${reach ?? 'the selected'} people? It can't be unsent.`)) return;
    setBusy(true);
    setMessage(null);
    try {
      const res = await adminApi.post('/announcements/', {
        text: text.trim(), link: link.trim(), audience, ...(audience === 'users' ? { user_ids: userIds.map(Number) } : {}),
      });
      setMessage({ ok: true, text: `Sent to ${res.recipient_count.toLocaleString()} people.` });
      setText('');
      setLink('');
      onSent();
    } catch (err) {
      const d = err.data || {};
      setMessage({ ok: false, text: d.text?.[0] || d.link?.[0] || d.user_ids?.[0] || d.audience?.[0] || err.message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="admin-card" onSubmit={send} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <h2 style={{ margin: 0 }}>New announcement</h2>
      <label className="admin-field">
        <span>Message <small>({255 - text.length} characters left)</small></span>
        <textarea rows="3" maxLength={255} required value={text} onChange={(e) => setText(e.target.value)} placeholder="Pitch Day applications close this Friday." />
      </label>
      <div className="admin-two-col">
        <label className="admin-field">
          <span>Audience</span>
          <select value={audience} onChange={(e) => setAudience(e.target.value)}>
            {AUDIENCES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </label>
        <label className="admin-field">
          <span>Link <small>(optional, inside the app, e.g. /explore)</small></span>
          <input type="text" value={link} onChange={(e) => setLink(e.target.value)} placeholder="/feed" />
        </label>
      </div>
      {audience === 'users' && (
        <label className="admin-field">
          <span>Account IDs <small>(from the Users page, separated by commas)</small></span>
          <input type="text" value={ids} onChange={(e) => setIds(e.target.value)} placeholder="12, 48, 103" />
        </label>
      )}
      <div className="admin-row-actions" style={{ alignItems: 'center' }}>
        <button type="submit" className="btn btn-accent btn-sm" disabled={busy || !text.trim() || reach === 0}>{busy ? 'Sending…' : 'Send announcement'}</button>
        <span className="admin-muted">{reach === null ? '' : `Reaches ${reach.toLocaleString()} ${reach === 1 ? 'person' : 'people'}`}</span>
      </div>
      {message && <p className={message.ok ? 'admin-form-ok' : 'admin-form-error'} role="status">{message.text}</p>}
    </form>
  );
}

export default function Announcements() {
  const list = useAdminList('/announcements/');
  const columns = [
    { key: 'created_at', label: 'Sent', render: (a) => fmtDate(a.created_at) },
    { key: 'text', label: 'Message', render: (a) => <>{a.text}{a.link && <div className="admin-sub">{a.link}</div>}</> },
    { key: 'audience', label: 'Audience', render: (a) => AUDIENCES.find(([v]) => v === a.audience)?.[1] || a.audience },
    { key: 'recipient_count', label: 'Recipients', render: (a) => a.recipient_count.toLocaleString() },
    { key: 'sender_name', label: 'Sent by' },
  ];
  return (
    <div className="admin-page">
      <div className="admin-page-head"><h1>Announcements</h1></div>
      <Composer onSent={list.reload} />
      <h2 style={{ fontSize: '1.05rem', margin: 0 }}>History</h2>
      <AdminTable columns={columns} rows={list.rows} loading={list.loading} error={list.error} onRetry={list.reload} empty="Nothing sent yet." />
      <Pagination page={list.page} totalPages={list.totalPages} count={list.count} onPage={list.setPage} noun="announcements" />
    </div>
  );
}
