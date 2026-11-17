import { useEffect, useState, useCallback } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { Icon } from '../components/IconSprite';
import Topbar from '../components/Topbar';
import LogoBadge from '../components/LogoBadge';
import InvestButton from '../components/InvestButton';
import { LOGO_GRADIENTS, statusMeta, fmtMoney, fundingPct, initialsOf } from '../data/startups';
import { useApp } from '../context/AppContext';
import { api, mediaUrl } from '../api/client';
import Avatar from '../components/Avatar';
import ReviewNotice from '../components/ReviewNotice';
import '../styles/statistics.css';

const TABS = [
  ['overview', 'Overview'],
  ['team', 'Team'],
  ['funding', 'Funding'],
  ['documents', 'Documents'],
  ['gallery', 'Gallery'],
  ['collaboration', 'Collaboration'],
];

function FundingPanel({ id, s, isOwner, navigate, investments }) {
  if (s.goal <= 0) {
    return (
      <div className="settings-card" style={{ padding: '24px 20px' }}>
        <p style={{ fontSize: 13.5, color: 'var(--text-faint)', margin: 0 }}>
          {isOwner
            ? "You haven't opened a funding round yet. You can open an investment round from your founder dashboard."
            : `${s.name} hasn't opened an active funding round yet.`}
        </p>
        {isOwner && (
          <button
            type="button"
            className="btn btn-outline btn-sm"
            style={{ marginTop: 14 }}
            onClick={() => navigate(`/dashboard/${id}`)}
          >
            <Icon name="bolt" /> Open Funding Round
          </button>
        )}
      </div>
    );
  }

  const pct = fundingPct(s.raised, s.goal);
  const confirmedInvestors = (investments || []).filter(
    (i) => i.startupId === id && (i.status === 'accepted' || i.status === 'completed'),
  );
  const needed = Math.max(0, (s.goal || 0) - (s.raised || 0));
  const timelineLabel = s.deadline ? s.deadline : 'Active Round';

  return (
    <div>
      <div className="funding-block">
        <div className="funding-top">
          <span className={`status-pill ${statusMeta(s.status).cls}`}>{statusMeta(s.status).label}</span>
          <span className="mono" style={{ fontSize: 12.5, color: 'var(--text-faint)' }}>{timelineLabel}</span>
        </div>
        <div className="gauge"><span style={{ width: `${pct}%` }} /></div>
        <div className="funding-nums">
          <span>Raised <b>{fmtMoney(s.raised)}</b></span>
          <span className="muted">Goal <b className="mono">{fmtMoney(s.goal)}</b></span>
          <span className="muted">{pct}%</span>
        </div>
      </div>

      {isOwner ? (
        <div style={{ marginTop: 16, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <button className="btn btn-outline btn-sm" onClick={() => navigate(`/dashboard/${id}`)}>
            <Icon name="edit" /> Manage Funding Round
          </button>
          <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            {confirmedInvestors.length} confirmed investor{confirmedInvestors.length === 1 ? '' : 's'} · {fmtMoney(needed)} remaining to target
          </span>
        </div>
      ) : s.reviewStatus !== 'approved' ? (
        <div className="settings-card" style={{ marginTop: 16, padding: '14px 16px' }}>
          <p style={{ margin: 0, fontSize: 13.5, color: 'var(--text-muted)' }}>
            This startup is currently pending admin verification and cannot accept investments.
          </p>
        </div>
      ) : (
        <div className="investor-panel">
          <div className="ip-grid">
            <div className="ip-item"><span>Investment Needed</span><b>{fmtMoney(needed)}</b></div>
            <div className="ip-item"><span>Round Timeline</span><b>{timelineLabel}</b></div>
            <div className="ip-item"><span>Confirmed Investors</span><b>{confirmedInvestors.length}</b></div>
            <div className="ip-item"><span>Round Status</span><b>{statusMeta(s.status).label}</b></div>
          </div>
          <InvestButton startupId={id} wide />
        </div>
      )}
    </div>
  );
}

function parseCollabBody(rawBody = '') {
  let mainBody = rawBody;
  let compType = '';
  let skills = [];

  const compMatch = mainBody.match(/\[Compensation \/ Type\]:\s*([^\n]+)/i);
  if (compMatch) {
    compType = compMatch[1].trim();
    mainBody = mainBody.replace(/\[Compensation \/ Type\]:\s*[^\n]+/i, '').trim();
  }
  const skillsMatch = mainBody.match(/\[Target Skills\]:\s*([^\n]+)/i);
  if (skillsMatch) {
    skills = skillsMatch[1].split(',').map((item) => item.trim()).filter(Boolean);
    mainBody = mainBody.replace(/\[Target Skills\]:\s*[^\n]+/i, '').trim();
  }
  return { mainBody, compType, skills };
}

function CollaborationPanel({ id, s, isOwner, navigate }) {
  const [open, setOpen] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const { addApplication, applications, currentUser } = useApp();

  const existing = applications.find(
    (a) => a.startupId === id && a.applicantId === currentUser.id && (a.status === 'pending' || a.status === 'accepted'),
  );

  const startupApplicants = applications.filter((a) => a.startupId === id);

  if (!s.collab || (!s.collab.isOpen && !isOwner) || (s.reviewStatus !== 'approved' && !isOwner)) {
    return (
      <div className="role-card">
        <p style={{ marginBottom: 0, color: 'var(--text-faint)' }}>
          {s.reviewStatus !== 'approved'
            ? 'This startup is currently pending admin approval and cannot open collaboration roles yet.'
            : 'No open collaboration roles right now.'}
        </p>
        {isOwner && (
          <button className="btn btn-outline btn-sm" style={{ marginTop: 12 }} onClick={() => navigate(`/dashboard/${id}`)}>
            <Icon name="bolt" /> Open a collaboration role from dashboard
          </button>
        )}
      </div>
    );
  }

  const { mainBody, compType, skills } = parseCollabBody(s.collab.body);

  async function handleSubmit(e) {
    e.preventDefault();
    const form = e.target;
    setBusy(true);
    setError('');
    try {
      await addApplication({
        type: 'collaboration',
        startupId: id,
        role: s.collab.role,
        name: form.name.value,
        email: form.email.value,
        link: form.link.value,
        message: form.message.value,
      });
      setSubmitted(true);
    } catch (err) {
      setError(err.message || 'Could not submit your application. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="role-card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10, marginBottom: 8 }}>
        <div>
          <b style={{ fontSize: 17, display: 'block' }}>{s.collab.role}</b>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 4, flexWrap: 'wrap' }}>
            <span className={`status-pill ${s.collab.isOpen ? 'status-open' : 'status-eval'}`}>
              {s.collab.isOpen ? 'Actively Recruiting' : 'Unpublished (Draft)'}
            </span>
            {compType && (
              <span className="badge badge-accent" style={{ fontSize: 11.5, padding: '3px 8px', borderRadius: 4 }}>
                {compType}
              </span>
            )}
          </div>
        </div>
        {isOwner && (
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={() => navigate(`/dashboard/${id}`)}
          >
            <Icon name="edit" /> Manage Role ({startupApplicants.length} applicant{startupApplicants.length === 1 ? '' : 's'})
          </button>
        )}
      </div>

      <p style={{ whiteSpace: 'pre-line', margin: '12px 0' }}>{mainBody || s.collab.body}</p>

      {skills.length > 0 && (
        <div style={{ margin: '12px 0 16px' }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>
            Target Skills
          </span>
          <div className="tags-row">
            {skills.map((sk) => (
              <span key={sk} className="tag-chip">#{sk}</span>
            ))}
          </div>
        </div>
      )}

      {isOwner ? (
        <p style={{ fontSize: 12.5, color: 'var(--text-faint)', marginBottom: 0, marginTop: 12, borderTop: '1px solid var(--border)', paddingTop: 10 }}>
          {s.collab.isOpen
            ? 'This is your active listing. You can review and respond to applicants from your founder dashboard.'
            : 'This listing is unpublished, so only you can see it. Publish it from your dashboard.'}
        </p>
      ) : existing && !submitted ? (
        <p className="apply-success"><Icon name="check" />You applied for this role · Status: {existing.status}</p>
      ) : submitted ? (
        <p className="apply-success"><Icon name="check" />Application submitted — {s.founder.split(' ')[0]} will review and be in touch.</p>
      ) : (
        <>
          <button className="btn btn-accent btn-sm" type="button" onClick={() => setOpen((v) => !v)}>
            {open ? 'Hide application form' : 'Apply for this role'}
          </button>
          <form className={`apply-form${open ? ' open' : ''}`} onSubmit={handleSubmit}>
            <div className="field"><label htmlFor="ap-name">Name</label><input id="ap-name" name="name" type="text" placeholder="Your full name" required /></div>
            <div className="field"><label htmlFor="ap-email">Email</label><input id="ap-email" name="email" type="email" placeholder="you@email.com" required /></div>
            <div className="field"><label htmlFor="ap-link">Portfolio / GitHub link</label><input id="ap-link" name="link" type="text" placeholder="https://" /></div>
            <div className="field"><label htmlFor="ap-msg">Message</label><textarea id="ap-msg" name="message" rows="3" placeholder="Why you're a great fit for this role" /></div>
            {error && <p className="modal-error" role="alert">{error}</p>}
            <button className="btn btn-accent btn-sm" type="submit" disabled={busy}>{busy ? 'Submitting…' : 'Submit application'}</button>
          </form>
        </>
      )}
    </div>
  );
}

// Documents Panel: Working links for all company documents, pitch decks, and published financial CSV statements
function DocumentsPanel({ id, s, isOwner, reportsList = [], onRefreshReports, navigate }) {
  const { uploadDocument, removeDocument } = useApp();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [uploadSuccess, setUploadSuccess] = useState('');

  // Extract any CSV files from s.docs in case any were uploaded as startup documents
  const docCsvs = (s?.docs || []).filter((d) => /\.csv$/i.test(d.name || d.url || ''));
  const docOthers = (s?.docs || []).filter((d) => !/\.csv$/i.test(d.name || d.url || ''));

  // Merge reportsList with docCsvs
  const allCsvFiles = [
    ...reportsList.map((r) => ({
      id: `report-${r.id}`,
      rawId: r.id,
      isReport: true,
      name: r.original_filename,
      period: r.reporting_period || 'Monthly Statement',
      format: (r.file_type || 'CSV').toUpperCase(),
      date: r.created_at ? new Date(r.created_at).toLocaleDateString() : 'Published',
      records: r.raw_summary?.rows_count ? `${r.raw_summary.rows_count} records` : 'Verified',
      url: r.file_url || r.file,
    })),
    ...docCsvs.map((d) => ({
      id: `doc-${d.id}`,
      rawId: d.id,
      isReport: false,
      name: d.name,
      period: 'Published Dataset',
      format: 'CSV',
      date: 'Available',
      records: d.size || 'Dataset file',
      url: d.url,
    })),
  ];

  async function handleUpload(e) {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    setBusy(true);
    setError('');
    setUploadSuccess('');

    try {
      const isCsv = /\.csv$/i.test(file.name);
      if (isCsv) {
        // Upload as financial statistics CSV report so AI and statistics recognize it immediately
        const formData = new FormData();
        formData.append('file', file);
        formData.append('startup_slug', id);
        await api.post('/statistics/', formData);
        if (onRefreshReports) await onRefreshReports();
        setUploadSuccess(`Successfully published "${file.name}" to financial statements!`);
      } else {
        // Upload as company document (PDF, DOCX, XLSX, etc.)
        await uploadDocument(id, file);
        setUploadSuccess(`Successfully uploaded "${file.name}"!`);
      }
    } catch (err) {
      setError(err.message || 'Upload failed. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  async function handleRemoveDoc(docId, docName) {
    if (!window.confirm(`Remove "${docName}"? This deletes the file.`)) return;
    try {
      await removeDocument(id, docId);
    } catch (err) {
      setError(err.message || 'Could not remove the document.');
    }
  }

  async function handleDeleteReport(reportId, reportName) {
    if (!window.confirm(`Delete "${reportName}"? This removes the financial report.`)) return;
    try {
      await api.delete(`/statistics/${reportId}/`);
      if (onRefreshReports) await onRefreshReports();
    } catch (err) {
      setError(err.message || 'Could not remove the financial report.');
    }
  }

  const hasCsvFiles = allCsvFiles.length > 0;
  const hasOtherDocs = docOthers.length > 0;
  const totalFilesCount = allCsvFiles.length + docOthers.length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Overview Banner */}
      <div className="settings-card" style={{ padding: '18px 20px', background: 'var(--bg-elevated)', borderLeft: '4px solid var(--accent)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h4 style={{ margin: 0, fontSize: 16 }}>Company Documents &amp; Financial Statements</h4>
            <p className="settings-hint" style={{ margin: '4px 0 0', maxWidth: 620 }}>
              Official files published by {s.name} for investor due diligence, including financial CSV statements, pitch decks, and compliance documents.
            </p>
          </div>
          <span className="badge badge-accent" style={{ fontSize: 12, padding: '4px 10px' }}>
            {totalFilesCount} Available Document{totalFilesCount === 1 ? '' : 's'}
          </span>
        </div>
      </div>

      {uploadSuccess && (
        <div className="settings-card" style={{ padding: '12px 16px', background: 'rgba(34, 197, 94, 0.1)', borderColor: 'var(--positive)', color: 'var(--positive)' }}>
          {uploadSuccess}
        </div>
      )}

      {/* 1. Published Financial CSV Statements & Reports */}
      <div className="settings-card" style={{ padding: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
          <div>
            <h5 style={{ margin: 0, fontSize: 15, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Icon name="chart" /> Financial Statements &amp; Monthly CSV Files
            </h5>
            <p className="settings-hint" style={{ margin: '2px 0 0' }}>
              Verified monthly revenue, expense, and transaction datasets available for download.
            </p>
          </div>
          {isOwner && (
            <button
              type="button"
              className="btn btn-outline btn-xs"
              onClick={() => navigate(`/dashboard/${id}#analytics`)}
            >
              <Icon name="edit" /> Manage Analytics &amp; Reports
            </button>
          )}
        </div>

        {hasCsvFiles ? (
          <div style={{ overflowX: 'auto' }}>
            <table className="data-preview-table" style={{ width: '100%', fontSize: 13 }}>
              <thead>
                <tr>
                  <th>File Name</th>
                  <th>Format</th>
                  <th>Reporting Period</th>
                  <th>Published Date</th>
                  <th>Records</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {allCsvFiles.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <b style={{ color: 'var(--text)' }}>{r.name}</b>
                    </td>
                    <td style={{ textTransform: 'uppercase' }}>
                      <span className="badge badge-accent" style={{ fontSize: 11, padding: '2px 6px' }}>
                        {r.format}
                      </span>
                    </td>
                    <td>{r.period}</td>
                    <td>{r.date}</td>
                    <td>{r.records}</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {r.url ? (
                          <a
                            href={mediaUrl(r.url)}
                            download={r.name || 'financial_statement.csv'}
                            target="_blank"
                            rel="noreferrer"
                            className="btn btn-outline btn-xs"
                            title="Download published CSV statement"
                          >
                            <Icon name="doc" /> Download CSV
                          </a>
                        ) : (
                          <span style={{ fontSize: 12, color: 'var(--text-faint)' }}>Available on record</span>
                        )}
                        {isOwner && (
                          <button
                            type="button"
                            className="icon-btn"
                            aria-label={`Remove ${r.name}`}
                            onClick={() => (r.isReport ? handleDeleteReport(r.rawId, r.name) : handleRemoveDoc(r.rawId, r.name))}
                            title="Delete file"
                          >
                            <Icon name="trash" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p style={{ fontSize: 13, color: 'var(--text-faint)', margin: 0 }}>
            {isOwner
              ? 'No monthly financial statements published yet. You can upload CSV records below or in your Manage Startup dashboard.'
              : `${s.name} has not published monthly financial CSV files yet.`}
          </p>
        )}
      </div>

      {/* 2. Company Pitch Decks, PDF Documents & Presentations */}
      <div className="settings-card" style={{ padding: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
          <div>
            <h5 style={{ margin: 0, fontSize: 15, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Icon name="doc" /> Pitch Decks, PDF Reports &amp; Legal Materials
            </h5>
            <p className="settings-hint" style={{ margin: '2px 0 0' }}>
              Investor presentations, business overviews, and compliance attachments.
            </p>
          </div>
        </div>

        {hasOtherDocs ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {docOthers.map((doc) => (
              <div className="doc-row" key={doc.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'var(--bg)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                  <Icon name="doc" />
                  <div style={{ minWidth: 0 }}>
                    {doc.url ? (
                      <a href={mediaUrl(doc.url)} download={doc.name} target="_blank" rel="noreferrer" className="doc-link" style={{ fontWeight: 600, fontSize: 13.5 }}>
                        {doc.name}
                      </a>
                    ) : (
                      <span style={{ fontWeight: 600, fontSize: 13.5 }}>{doc.name}</span>
                    )}
                    <span className="d-meta" style={{ display: 'block', fontSize: 11.5, color: 'var(--text-faint)' }}>{doc.size || 'Attachment'}</span>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  {doc.url && (
                    <a
                      href={mediaUrl(doc.url)}
                      download={doc.name}
                      target="_blank"
                      rel="noreferrer"
                      className="btn btn-outline btn-xs"
                      title="Download document"
                    >
                      <Icon name="doc" /> Download
                    </a>
                  )}
                  {isOwner && (
                    <button type="button" className="icon-btn" aria-label={`Remove ${doc.name}`} onClick={() => handleRemoveDoc(doc.id, doc.name)}>
                      <Icon name="trash" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p style={{ fontSize: 13, color: 'var(--text-faint)', margin: 0 }}>
            {isOwner
              ? 'No additional company documents uploaded yet. You can upload your Pitch Deck or one-pager below.'
              : `${s.name} has not published company documents yet.`}
          </p>
        )}

        {isOwner && s.reviewStatus !== 'approved' ? (
          <div style={{ marginTop: 18, padding: '12px 14px', background: 'var(--warning-soft)', border: '1px solid var(--warning)', borderRadius: 8, fontSize: 13 }}>
            <b>Startup Verification Required:</b> Company documents, pitch decks, and financial statements cannot be uploaded until your startup is approved by an administrator.
          </div>
        ) : isOwner ? (
          <div style={{ marginTop: 18, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
            <label className="btn btn-outline btn-sm" style={{ cursor: busy ? 'wait' : 'pointer' }}>
              <Icon name="doc" />{busy ? 'Uploading…' : 'Upload File (CSV, PDF, Pitch Deck, Office)'}
              <input
                type="file"
                hidden
                disabled={busy}
                accept=".csv,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.jpg,.jpeg,.png,.gif,.webp,.txt"
                onChange={handleUpload}
              />
            </label>
            <p className="settings-hint" style={{ marginTop: 8 }}>
              Upload financial CSV datasets (automatically parsed for AI research), pitch decks (PDF), business plans, or legal filings (up to 20 MB).
            </p>
          </div>
        ) : null}
        {error && <p className="modal-error" role="alert" style={{ marginTop: 10 }}>{error}</p>}
      </div>
    </div>
  );
}

// Images and videos this startup has posted
function GalleryPanel({ id }) {
  const [items, setItems] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setItems(null);
    api.get('/posts/', { startup: id, has_media: 1, page_size: 30 })
      .then((data) => {
        if (cancelled) return;
        const media = (data.results || [])
          .map((p) => ({ id: p.id, title: p.title, url: mediaUrl(p.media) }))
          .filter((p) => /\.(jpe?g|png|gif|webp|mp4|webm|mov|m4v)$/i.test(p.url.split('?')[0]));
        setItems(media);
      })
      .catch((err) => { if (!cancelled) setError(err.message); });
    return () => { cancelled = true; };
  }, [id]);

  if (error) return <p className="modal-error">{error}</p>;
  if (items === null) return <p style={{ fontSize: 13, color: 'var(--text-faint)' }}>Loading gallery…</p>;
  if (items.length === 0) {
    return <p style={{ fontSize: 13, color: 'var(--text-faint)' }}>No photos or videos yet. Images and videos attached to posts appear here.</p>;
  }
  return (
    <div className="gallery-grid">
      {items.map((item) => (
        /\.(mp4|webm|mov|m4v)$/i.test(item.url.split('?')[0]) ? (
          <video key={item.id} className="gallery-tile gallery-media" src={item.url} controls preload="metadata" title={item.title} />
        ) : (
          <a key={item.id} className="gallery-tile gallery-media" href={item.url} target="_blank" rel="noreferrer" title={item.title}>
            <img src={item.url} alt={item.title} loading="lazy" />
          </a>
        )
      ))}
    </div>
  );
}

export default function Profile() {
  const { id = 'healthsync' } = useParams();
  const [tab, setTab] = useState('overview');
  const navigate = useNavigate();
  const location = useLocation();
  const {
    currentUser,
    startups,
    refreshStartup,
    saved,
    toggleSaved,
    followed,
    toggleFollow,
    startConversation,
    signedIn,
    investments,
  } = useApp();

  const [reportsList, setReportsList] = useState([]);
  const [loadingStartup, setLoadingStartup] = useState(!startups[id]);

  const s = startups[id];
  const isOwner = !!s && s.ownerId === currentUser.id;
  const isSaved = saved.has(id);
  const isFollowing = followed.has(id);

  // Synchronize startup and reports data fresh on mount / id change
  const fetchReports = useCallback(async () => {
    try {
      const data = await api.get(`/statistics/?startup=${id}`);
      const list = Array.isArray(data) ? data : data?.results || [];
      setReportsList(list);
    } catch {
      setReportsList([]);
    }
  }, [id]);

  useEffect(() => {
    let active = true;
    if (refreshStartup) {
      refreshStartup(id)
        .catch(() => {})
        .finally(() => {
          if (active) setLoadingStartup(false);
        });
    }
    return () => { active = false; };
  }, [id, refreshStartup]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  useEffect(() => {
    if (location.hash) {
      const targetTab = location.hash.replace('#', '');
      if (TABS.some(([k]) => k === targetTab)) {
        setTab(targetTab);
      }
    }
  }, [location.hash, id]);

  if (loadingStartup && !s) {
    return (
      <div>
        <Topbar />
        <div style={{ textAlign: 'center', padding: '64px 20px', color: 'var(--text-muted)' }}>
          Loading startup details…
        </div>
      </div>
    );
  }

  if (!s || (s.reviewStatus !== 'approved' && !isOwner && currentUser?.role !== 'admin')) {
    return (
      <div>
        <Topbar />
        <div className="settings-card" style={{ maxWidth: 480, margin: '48px auto' }}>
          <h4>Startup not found</h4>
          <p className="settings-hint">It may have been renamed, removed, or is awaiting administrator approval.</p>
          <button className="btn btn-accent btn-sm" onClick={() => navigate('/explore')}>Explore startups</button>
        </div>
      </div>
    );
  }

  const pct = fundingPct(s.raised, s.goal);
  const confirmedInvestors = (investments || []).filter(
    (i) => i.startupId === id && (i.status === 'accepted' || i.status === 'completed'),
  );

  async function guarded(fn) {
    if (!signedIn) { navigate('/login'); return; }
    try {
      await fn();
    } catch (err) {
      window.alert(err.message || 'That didn’t work. Please try again.');
    }
  }

  function handleMessage() {
    return guarded(async () => {
      const convId = await startConversation(id);
      navigate(`/messages?id=${convId}`);
    });
  }

  return (
    <div>
      <Topbar />
      <button className="back-btn" onClick={() => navigate('/feed')}><Icon name="back" />Back to feed</button>

      {isOwner && <div style={{ padding: '0 16px' }}><ReviewNotice startup={s} /></div>}
      <div className="profile-cover" style={{ background: `linear-gradient(120deg, ${(LOGO_GRADIENTS[id] || 'linear-gradient(155deg,#403d39,#252422)').replace('linear-gradient(155deg,', '')}` }} />
      <div className="profile-head">
        <LogoBadge id={id} initials={s.initials} size={88} />
        <div className="profile-info">
          <div>
            <h2 className="profile-name">{s.name}{s.verified && <Icon name="check" />}</h2>
            <p className="profile-tagline">{s.tagline}</p>
          </div>
          <div className="profile-actions">
            {s.reviewStatus === 'pending' ? (
              <span
                className="status-pill status-eval"
                style={{ background: 'var(--warning-soft)', color: 'var(--warning)', borderColor: 'var(--warning)' }}
              >
                Pending Approval
              </span>
            ) : (
              <span className={`status-pill ${statusMeta(s.status).cls}`}>{statusMeta(s.status).label}</span>
            )}
            {!isOwner && (
              <>
                <button
                  className="btn btn-accent btn-sm"
                  onClick={() => navigate(signedIn ? `/messages?startup=${encodeURIComponent(id)}` : '/login')}
                >
                  <Icon name="msg" />Message founder
                </button>
                <button
                  className="btn btn-outline btn-sm"
                  style={isSaved ? { borderColor: 'var(--accent)', color: 'var(--accent)' } : undefined}
                  onClick={() => guarded(() => toggleSaved(id))}
                >
                  <Icon name="bookmark" />{isSaved ? 'Saved' : 'Save'}
                </button>
                <button
                  className={isFollowing ? 'btn btn-outline btn-sm' : 'btn btn-accent btn-sm'}
                  onClick={() => guarded(() => toggleFollow(id))}
                >
                  {isFollowing ? 'Following' : 'Follow'}
                </button>
                <button
                  className="btn btn-outline btn-sm"
                  onClick={handleMessage}
                >
                  <Icon name="chat" />Message
                </button>
              </>
            )}
            {isOwner && (
              <button className="btn btn-outline btn-sm" onClick={() => navigate(`/dashboard/${id}`)}><Icon name="edit" />Manage</button>
            )}
          </div>
        </div>
      </div>

      <div className="profile-tabs">
        {TABS.map(([key, label]) => (
          <button key={key} className={`ptab${tab === key ? ' active' : ''}`} onClick={() => setTab(key)}>{label}</button>
        ))}
      </div>

      <div className="profile-body">
        <div>
          {tab === 'overview' && (
            <div className="prose">
              <p style={{ whiteSpace: 'pre-line' }}>{s.overview || 'No overview yet.'}</p>
              <h5>Founder</h5><p>{s.founder}</p>
              <h5>Industry tags</h5>
              <div className="tags-row">{s.tags.map((t) => <span className="tag-chip" key={t}>#{t}</span>)}</div>
              {(s.tradeLicense || s.tinNumber) && (
                <>
                  <h5 style={{ marginTop: 22 }}>Registration Details</h5>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10, margin: '8px 0 16px' }}>
                    <div className="settings-card" style={{ padding: '10px 14px' }}>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, display: 'block' }}>Trade License</span>
                      <b className="mono" style={{ fontSize: 13.5 }}>{s.tradeLicense || '—'}</b>
                    </div>
                    <div className="settings-card" style={{ padding: '10px 14px' }}>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, display: 'block' }}>TIN Number</span>
                      <b className="mono" style={{ fontSize: 13.5 }}>{s.tinNumber || '—'}</b>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}



          {tab === 'team' && (
            <div>
              <div className="team-grid">
                <div className="team-card">
                  <Avatar src={s.founderAvatar} name={s.founder} size={48} />
                  <b>{s.founder}</b><span>Founder &amp; CEO</span>
                </div>
                {s.team.map(([name, title]) => (
                  <div className="team-card" key={name}>
                    <div className="avatar">{initialsOf(name)}</div>
                    <b>{name}</b><span>{title}</span>
                  </div>
                ))}
              </div>
              {s.team.length === 0 && (
                <p style={{ fontSize: 13, color: 'var(--text-faint)', marginTop: 16 }}>
                  {isOwner
                    ? "You haven't listed additional team members yet. Team members can be updated from your settings."
                    : `Solo founder initiative led by ${s.founder}.`}
                </p>
              )}
            </div>
          )}

          {tab === 'funding' && <FundingPanel id={id} s={s} isOwner={isOwner} navigate={navigate} investments={investments} />}

          {tab === 'documents' && <DocumentsPanel id={id} s={s} isOwner={isOwner} reportsList={reportsList} onRefreshReports={fetchReports} navigate={navigate} />}

          {tab === 'gallery' && <GalleryPanel id={id} />}

          {tab === 'collaboration' && <CollaborationPanel id={id} s={s} isOwner={isOwner} navigate={navigate} />}
        </div>

        <aside>
          <div className="sidebar-card">
            <h5>Funding</h5>
            {s.goal > 0 ? (
              <>
                <div className="fund-cta-goal mono">{fmtMoney(s.raised)}</div>
                <div className="fund-cta-sub">raised of {fmtMoney(s.goal)} goal · {pct}%</div>
                <div className="gauge"><span style={{ width: `${pct}%` }} /></div>
                {isOwner ? (
                  <p style={{ fontSize: 12, color: 'var(--text-faint)', marginTop: 12 }}>
                    {s.deadline || 'Active Round'} · {confirmedInvestors.length} confirmed investor{confirmedInvestors.length === 1 ? '' : 's'}
                  </p>
                ) : (
                  <>
                    <div className="fund-invest-grid">
                      <div className="fi-row"><span>Timeline</span><b>{s.deadline || 'Active'}</b></div>
                      <div className="fi-row"><span>Investors</span><b>{confirmedInvestors.length} confirmed</b></div>
                    </div>
                    {s.reviewStatus === 'approved' ? (
                      <InvestButton startupId={id} wide />
                    ) : (
                      <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>Pending admin approval</p>
                    )}
                  </>
                )}
              </>
            ) : (
              <p style={{ fontSize: 12.5, color: 'var(--text-faint)' }}>No funding round open yet.</p>
            )}
          </div>
          <div className="sidebar-card">
            <h5>Founder</h5>
            {isOwner ? (
              <button
                type="button"
                className="trend-row"
                style={{ padding: 0, border: 'none', background: 'none', width: '100%', textAlign: 'left', cursor: 'pointer' }}
                onClick={() => navigate('/account')}
              >
                <Avatar src={s.founderAvatar} name={s.founder} />
                <div><div className="t-name">{s.founder}</div><div className="t-meta">View your account</div></div>
              </button>
            ) : (
              <div className="trend-row" style={{ padding: 0 }}>
                <Avatar src={s.founderAvatar} name={s.founder} />
                <div><div className="t-name">{s.founder}</div><div className="t-meta">Founder &amp; CEO</div></div>
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
