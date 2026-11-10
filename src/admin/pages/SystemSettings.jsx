import { useCallback, useEffect, useState } from 'react';
import { adminApi } from '../adminApi';
import { DetailList, ErrorState } from '../components';

const SWITCHES = [
  ['registration_open', 'Open registration', 'New people can create accounts with email and password, or with Google.'],
  ['google_signin_enabled', 'Google sign-in', '"Continue with Google" works for sign-in and sign-up.'],
  ['require_startup_approval', 'Review new startups', 'New startups stay hidden until an admin approves them.'],
];

export default function SystemSettings() {
  const [data, setData] = useState(null);
  const [form, setForm] = useState(null);
  const [error, setError] = useState(null);
  const [state, setState] = useState({ busy: false, message: null });

  const load = useCallback(() => {
    setError(null);
    adminApi.get('/settings/').then((d) => { setData(d); setForm(d); }).catch(setError);
  }, []);
  useEffect(load, [load]);

  if (error) return <ErrorState error={error} onRetry={load} />;
  if (!form) return <p className="admin-muted">Loading…</p>;

  const dirty = SWITCHES.some(([k]) => form[k] !== data[k]) || form.site_banner !== data.site_banner;

  async function save(e) {
    e.preventDefault();
    const turningOff = SWITCHES.filter(([k]) => data[k] && !form[k]).map(([, l]) => l);
    if (turningOff.length && !window.confirm(`Turn off: ${turningOff.join(', ')}? This affects everyone immediately.`)) return;
    setState({ busy: true, message: null });
    try {
      const body = { site_banner: form.site_banner };
      SWITCHES.forEach(([k]) => { body[k] = form[k]; });
      const res = await adminApi.patch('/settings/', body);
      setData(res);
      setForm(res);
      setState({ busy: false, message: { ok: true, text: 'Saved. Changes apply within a minute.' } });
    } catch (err) {
      setState({ busy: false, message: { ok: false, text: err.message } });
    }
  }

  const s = data.security;
  return (
    <div className="admin-page">
      <div className="admin-page-head"><h1>System settings</h1></div>
      <form className="admin-card" onSubmit={save}>
        <h2>Platform switches</h2>
        {SWITCHES.map(([key, label, help]) => (
          <label key={key} className="admin-switch">
            <input type="checkbox" checked={!!form[key]} onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.checked }))} />
            <div><b>{label}</b><span>{help}</span></div>
          </label>
        ))}
        <label className="admin-field" style={{ marginTop: 12 }}>
          <span>Site banner <small>(shown at the top of every page; leave empty to hide)</small></span>
          <input type="text" maxLength={255} value={form.site_banner} onChange={(e) => setForm((f) => ({ ...f, site_banner: e.target.value }))} placeholder="Scheduled maintenance tonight 22:00–23:00 UTC" />
        </label>
        <div className="admin-row-actions" style={{ marginTop: 14, alignItems: 'center' }}>
          <button type="submit" className="btn btn-accent btn-sm" disabled={!dirty || state.busy}>{state.busy ? 'Saving…' : 'Save settings'}</button>
          {dirty && <button type="button" className="btn btn-outline btn-sm" onClick={() => setForm(data)}>Discard changes</button>}
          {state.message && <span className={state.message.ok ? 'admin-form-ok' : 'admin-form-error'} role="status">{state.message.text}</span>}
        </div>
      </form>

      <section className="admin-card">
        <h2>Security configuration</h2>
        <p className="admin-muted" style={{ marginTop: 0 }}>Set by the server’s environment variables; shown here so you can check them.</p>
        <DetailList items={[
          ['Debug mode', s.debug ? 'ON (never in production)' : 'Off'],
          ['Login lockout', `${s.login_max_failures} failures → ${s.login_lockout_minutes} min`],
          ['Auth rate limit', `${s.auth_rate_limit} per IP`],
          ['Session length', `${s.session_days} days`],
          ['Secure cookies', s.secure_cookies ? 'Yes' : 'No (HTTP only, dev)'],
          ['Google client configured', s.google_client_configured ? 'Yes' : 'No'],
        ]} />
      </section>
    </div>
  );
}
