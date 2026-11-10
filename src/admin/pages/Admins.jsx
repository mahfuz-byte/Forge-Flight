import { useCallback, useEffect, useState } from 'react';
import { adminApi } from '../adminApi';
import { useAdmin } from '../context';
import { AdminTable, ErrorState, fmtDate, Pill } from '../components';
import { ROLE_OPTIONS } from './Users';

const roleLabel = (r) => (ROLE_OPTIONS.find(([v]) => v === r) || [r, r])[1];

function AssignRole({ onDone }) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('moderator');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      const user = await adminApi.post('/staff/set-role/', { email: email.trim(), role });
      setMessage({ ok: true, text: `${user.email} is now ${roleLabel(user.role)}.` });
      setEmail('');
      onDone();
    } catch (err) {
      setMessage({ ok: false, text: err.data?.email?.[0] || err.data?.role?.[0] || err.message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="admin-card" onSubmit={submit}>
      <h2>Assign a role</h2>
      <p className="admin-muted" style={{ marginTop: 0 }}>Choose “Member” to remove someone’s staff access. Changes are logged and take effect immediately.</p>
      <div className="admin-filter-bar">
        <label className="admin-field" style={{ flex: '1 1 240px' }}>
          <span>Account email</span>
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" />
        </label>
        <label className="admin-field" style={{ flex: '0 1 200px' }}>
          <span>Role</span>
          <select value={role} onChange={(e) => setRole(e.target.value)}>
            {ROLE_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </label>
        <button type="submit" className="btn btn-accent btn-sm" disabled={busy} style={{ marginBottom: 2 }}>{busy ? 'Saving…' : 'Save role'}</button>
      </div>
      {message && <p className={message.ok ? 'admin-form-ok' : 'admin-form-error'} role="status" style={{ marginTop: 10 }}>{message.text}</p>}
    </form>
  );
}

function RoleMatrix() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  useEffect(() => { adminApi.get('/roles/').then(setData).catch(setError); }, []);
  if (error) return <ErrorState error={error} />;
  if (!data) return null;
  return (
    <section className="admin-card">
      <h2>What each role can do</h2>
      <div className="admin-table-wrap" style={{ border: 'none' }}>
        <table className="admin-matrix">
          <thead>
            <tr><th scope="col">Capability</th>{data.roles.map((r) => <th key={r.role} scope="col" title={r.summary}>{r.label}</th>)}</tr>
          </thead>
          <tbody>
            {data.capabilities.map((cap) => (
              <tr key={cap}>
                <td><code>{cap}</code></td>
                {data.roles.map((r) => (
                  <td key={r.role}>{r.capabilities.includes(cap) ? <span aria-label="yes">✓</span> : <span aria-label="no" className="admin-muted">—</span>}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default function Admins() {
  const { me } = useAdmin();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    adminApi.get('/staff/', { page_size: 100 })
      .then((d) => { setRows(d.results); setError(null); })
      .catch(setError)
      .finally(() => setLoading(false));
  }, []);
  useEffect(load, [load]);

  const columns = [
    { key: 'name', label: 'Name', render: (u) => <>{u.name}{u.id === me.id && <span className="admin-sub"> (you)</span>}</> },
    { key: 'email', label: 'Email' },
    { key: 'role', label: 'Role', render: (u) => roleLabel(u.role) },
    { key: 'is_active', label: 'Status', render: (u) => <Pill value={u.is_active ? 'active' : 'suspended'} /> },
    { key: 'last_login', label: 'Last sign-in', render: (u) => fmtDate(u.last_login) },
  ];

  return (
    <div className="admin-page">
      <div className="admin-page-head"><h1>Admins &amp; roles</h1></div>
      <AssignRole onDone={load} />
      <AdminTable columns={columns} rows={rows} loading={loading} error={error} onRetry={load} empty="No staff accounts." />
      <RoleMatrix />
    </div>
  );
}
