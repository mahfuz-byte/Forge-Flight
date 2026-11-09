import { useEffect, useState } from 'react';
import { Icon } from '../components/IconSprite';

// ----------------------------------------------------------------- errors

/** One way to show any AdminApiError (Phase 5.1 centralized error handling). */
export function ErrorState({ error, onRetry }) {
  if (!error) return null;
  const retryable = error.kind === 'server' || error.kind === 'network';
  return (
    <div className="admin-error" role="alert">
      <b>{error.kind === 'forbidden' ? 'Not available for your role' : 'Something went wrong'}</b>
      <p>{error.message}</p>
      {retryable && onRetry && <button type="button" className="btn btn-outline btn-sm" onClick={onRetry}>Try again</button>}
    </div>
  );
}

// ----------------------------------------------------------------- filters

/** Search box that updates the filter after the user pauses typing. */
export function SearchFilter({ value, onChange, placeholder = 'Search…', label = 'Search' }) {
  const [draft, setDraft] = useState(value || '');
  useEffect(() => { setDraft(value || ''); }, [value]);
  useEffect(() => {
    if ((draft || '') === (value || '')) return undefined;
    const t = window.setTimeout(() => onChange(draft.trim()), 350);
    return () => window.clearTimeout(t);
  }, [draft]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <label className="admin-filter admin-filter-search">
      <span className="sr-only">{label}</span>
      <Icon name="search" />
      <input type="search" value={draft} placeholder={placeholder} onChange={(e) => setDraft(e.target.value)} />
    </label>
  );
}

export function SelectFilter({ label, value, onChange, options }) {
  return (
    <label className="admin-filter">
      <span className="admin-filter-label">{label}</span>
      <select value={value || ''} onChange={(e) => onChange(e.target.value)}>
        <option value="">All</option>
        {options.map(([v, text]) => <option key={v} value={v}>{text}</option>)}
      </select>
    </label>
  );
}

export function DateFilter({ label, value, onChange }) {
  return (
    <label className="admin-filter">
      <span className="admin-filter-label">{label}</span>
      <input type="date" value={value || ''} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

export function FilterBar({ children }) {
  return <div className="admin-filter-bar">{children}</div>;
}

// ----------------------------------------------------------------- table

/**
 * columns: [{ key, label, render?(row), width?, className? }]
 * Renders loading, error and empty states consistently.
 */
export function AdminTable({ columns, rows, loading, error, onRetry, empty = 'Nothing to show yet.', rowKey = 'id' }) {
  if (error) return <ErrorState error={error} onRetry={onRetry} />;
  return (
    <div className="admin-table-wrap" aria-busy={loading}>
      <table className="admin-table">
        <thead>
          <tr>{columns.map((c) => <th key={c.key} style={c.width ? { width: c.width } : undefined} scope="col">{c.label}</th>)}</tr>
        </thead>
        <tbody>
          {loading && rows.length === 0 ? (
            <tr><td colSpan={columns.length} className="admin-table-state">Loading…</td></tr>
          ) : rows.length === 0 ? (
            <tr><td colSpan={columns.length} className="admin-table-state">{empty}</td></tr>
          ) : rows.map((row) => (
            <tr key={row[rowKey]} className={loading ? 'is-stale' : undefined}>
              {columns.map((c) => (
                <td key={c.key} data-label={c.label} className={c.className}>
                  {c.render ? c.render(row) : row[c.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Pagination({ page, totalPages, count, onPage, noun = 'results' }) {
  if (!count) return null;
  return (
    <nav className="admin-pagination" aria-label="Pagination">
      <span>{count.toLocaleString()} {noun} · page {page} of {totalPages}</span>
      <div>
        <button type="button" className="btn btn-outline btn-sm" disabled={page <= 1} onClick={() => onPage(page - 1)}>Previous</button>
        <button type="button" className="btn btn-outline btn-sm" disabled={page >= totalPages} onClick={() => onPage(page + 1)}>Next</button>
      </div>
    </nav>
  );
}

// ----------------------------------------------------------------- dashboard

export function StatCard({ label, value, hint, tone }) {
  return (
    <div className={`admin-stat${tone ? ` tone-${tone}` : ''}`}>
      <span className="admin-stat-label">{label}</span>
      <b className="admin-stat-value">{value}</b>
      {hint && <span className="admin-stat-hint">{hint}</span>}
    </div>
  );
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function monthLabel(ym) {
  const [, m] = ym.split('-');
  return MONTHS[Number(m) - 1] || ym;
}

/** Monthly bar chart in plain SVG; values are listed in a table for screen readers. */
export function BarChart({ title, months, values, format = (v) => v.toLocaleString() }) {
  const max = Math.max(1, ...values);
  const w = 100 / Math.max(values.length, 1);
  const total = values.reduce((a, b) => a + b, 0);
  return (
    <figure className="admin-chart">
      <figcaption>
        <span>{title}</span>
        <b>{format(total)} <small>last 12 months</small></b>
      </figcaption>
      <svg viewBox="0 0 100 50" preserveAspectRatio="none" role="img" aria-label={`${title}: ${format(total)} over the last 12 months`}>
        {values.map((v, i) => {
          const h = (v / max) * 46;
          return (
            <rect key={months[i]} x={i * w + w * 0.18} y={50 - h} width={w * 0.64} height={Math.max(h, v ? 0.8 : 0)} rx="0.6">
              <title>{`${monthLabel(months[i])}: ${format(v)}`}</title>
            </rect>
          );
        })}
      </svg>
      <div className="admin-chart-axis" aria-hidden="true">
        {months.map((m, i) => <span key={m}>{(values.length - 1 - i) % 2 === 0 ? monthLabel(m) : ''}</span>)}
      </div>
      <table className="sr-only">
        <caption>{title} by month</caption>
        <tbody>{months.map((m, i) => <tr key={m}><th scope="row">{m}</th><td>{format(values[i])}</td></tr>)}</tbody>
      </table>
    </figure>
  );
}
