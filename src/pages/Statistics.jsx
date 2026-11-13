import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Topbar from '../components/Topbar';
import LeftNav from '../components/LeftNav';
import CreateStartupModal from '../components/CreateStartupModal';
import { Icon } from '../components/IconSprite';
import { useApp } from '../context/AppContext';
import { api } from '../api/client';
import '../styles/settings.css';
import '../styles/statistics.css';

export default function Statistics() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { signedIn, myStartups, currentUser } = useApp();

  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [selectedSlug, setSelectedSlug] = useState('');
  const [reports, setReports] = useState([]);
  const [activeReport, setActiveReport] = useState(null);
  const [loadingReports, setLoadingReports] = useState(false);

  const [fileToUpload, setFileToUpload] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [dragOver, setDragOver] = useState(false);

  const fileInputRef = useRef(null);

  // Initialize selected startup from query param or first owned startup
  useEffect(() => {
    if (myStartups.length > 0) {
      const paramSlug = searchParams.get('startup');
      const found = myStartups.find(([slug]) => slug === paramSlug);
      if (found) {
        setSelectedSlug(found[0]);
      } else if (!selectedSlug) {
        setSelectedSlug(myStartups[0][0]);
      }
    }
  }, [myStartups, searchParams, selectedSlug]);

  // Load existing reports for selected startup
  useEffect(() => {
    if (!signedIn || !selectedSlug) return;
    let isMounted = true;
    setLoadingReports(true);
    setErrorMessage('');

    api.get(`/statistics/?startup=${selectedSlug}`)
      .then((data) => {
        if (!isMounted) return;
        const list = Array.isArray(data) ? data : data.results || [];
        setReports(list);
        if (list.length > 0) {
          setActiveReport(list[0]);
        } else {
          setActiveReport(null);
        }
      })
      .catch((err) => {
        if (!isMounted) return;
        setErrorMessage(err.message || 'Could not load statistics history.');
      })
      .finally(() => {
        if (isMounted) setLoadingReports(false);
      });

    return () => { isMounted = false; };
  }, [signedIn, selectedSlug]);

  const selectedStartup = useMemo(() => {
    const s = myStartups.find(([slug]) => slug === selectedSlug);
    return s ? s[1] : null;
  }, [myStartups, selectedSlug]);

  // Handle file drop & selection
  function handleFileDrop(e) {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      validateAndSetFile(e.dataTransfer.files[0]);
    }
  }

  function handleFileInput(e) {
    if (e.target.files && e.target.files[0]) {
      validateAndSetFile(e.target.files[0]);
    }
  }

  function validateAndSetFile(f) {
    const ext = f.name.split('.').pop().toLowerCase();
    if (ext !== 'csv' && ext !== 'pdf') {
      setErrorMessage('Please upload a valid CSV (.csv) or PDF (.pdf) file.');
      return;
    }
    if (f.size > 10 * 1024 * 1024) {
      setErrorMessage('File size exceeds 10 MB limit.');
      return;
    }
    setErrorMessage('');
    setFileToUpload(f);
  }

  // Upload file & compute baseline
  async function handleUpload() {
    if (!fileToUpload || !selectedSlug) return;
    setUploading(true);
    setErrorMessage('');

    const formData = new FormData();
    formData.append('file', fileToUpload);
    formData.append('startup_slug', selectedSlug);

    try {
      const created = await api.post('/statistics/', formData);
      setReports((prev) => [created, ...prev]);
      setActiveReport(created);
      setFileToUpload(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err) {
      setErrorMessage(err.message || 'Failed to upload and parse file.');
    } finally {
      setUploading(false);
    }
  }

  // Trigger DeepSeek AI Analysis
  async function handleAnalyze() {
    if (!activeReport) return;
    setAnalyzing(true);
    setErrorMessage('');

    try {
      const updated = await api.post(`/statistics/${activeReport.id}/analyze/`);
      setActiveReport(updated);
      setReports((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
    } catch (err) {
      setErrorMessage(err.message || 'AI analysis request failed.');
    } finally {
      setAnalyzing(false);
    }
  }

  function handleDownloadSample() {
    window.open('/api/statistics/sample-csv/', '_blank');
  }

  // Summary figures
  const raw = activeReport?.raw_summary || {};
  const ai = activeReport?.ai_analysis || null;
  const isCompleted = activeReport?.status === 'completed' && Boolean(ai);

  // Maximum value for monthly chart scaling
  const monthlyTimeline = raw.monthly_timeline || [];
  const maxMonthlyVal = Math.max(
    ...monthlyTimeline.map((m) => Math.max(m.sales || 0, m.costs || 0)),
    100
  );

  return (
    <div>
      <Topbar />
      <div className="layout layout-2col">
        <LeftNav />
        <main className="center-col stats-page">
          {/* Header Card */}
          <div className="stats-header-card">
            <div className="stats-header-titles">
              <h2>
                <Icon name="chart" />
                Startup Statistics &amp; AI Intelligence
              </h2>
              <p>
                Powered by DeepSeek AI · Automatic unit economics, customer analytics &amp; strategic roadmap
              </p>
            </div>

            {myStartups.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <label htmlFor="startup-select" style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                  Startup:
                </label>
                <select
                  id="startup-select"
                  className="stats-startup-select"
                  value={selectedSlug}
                  onChange={(e) => setSelectedSlug(e.target.value)}
                >
                  {myStartups.map(([slug, s]) => (
                    <option key={slug} value={slug}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Case 1: Not Logged In */}
          {!signedIn ? (
            <div className="founder-gate-card">
              <div className="founder-gate-icon">
                <Icon name="user" />
              </div>
              <h3>Sign in to Access Founder Statistics</h3>
              <p>
                Access to AI-powered sales calculation, customer cohort analysis, and interactive charts is
                available for startup founders.
              </p>
              <button className="btn btn-accent" onClick={() => navigate('/login')}>
                Sign in to your account
              </button>
            </div>
          ) : myStartups.length === 0 ? (
            /* Case 2: Logged In, but 0 Startups Created (Founder Gate) */
            <div className="founder-gate-card">
              <div className="founder-gate-icon">
                <Icon name="flag" />
              </div>
              <h3>Exclusive to Startup Founders</h3>
              <p>
                The Statistics &amp; AI Intelligence feature is dedicated to creators and founders on Forge &amp; Flight.
                Once you create a startup, you can upload sales transactions, customer metrics, and operating costings
                to generate interactive growth charts and DeepSeek AI strategic evaluations.
              </p>
              <button className="btn btn-accent" onClick={() => setCreateModalOpen(true)}>
                <Icon name="flag" />
                Create your first startup
              </button>
            </div>
          ) : (
            /* Case 3: Founder with Startups */
            <>
              {errorMessage && (
                <div className="modal-error" style={{ marginBottom: 20 }}>
                  <Icon name="close" /> {errorMessage}
                </div>
              )}

              {/* Upload Card */}
              <div className="stats-upload-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                  <h4 style={{ margin: 0, fontSize: 16 }}>Upload Financial &amp; Customer Records</h4>
                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    onClick={handleDownloadSample}
                    title="Download template CSV with sales, customer names, and costings"
                  >
                    <Icon name="doc" /> Download Sample CSV
                  </button>
                </div>

                <div
                  className={`upload-dropzone${dragOver ? ' dragover' : ''}`}
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={handleFileDrop}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv,.pdf"
                    style={{ display: 'none' }}
                    onChange={handleFileInput}
                  />
                  <div className="upload-dropzone-icon">
                    <Icon name="doc" />
                  </div>
                  <b style={{ display: 'block', fontSize: 15, marginBottom: 4 }}>
                    {fileToUpload ? fileToUpload.name : 'Choose a CSV spreadsheet or PDF report'}
                  </b>
                  <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                    {fileToUpload
                      ? `${(fileToUpload.size / 1024).toFixed(1)} KB · Ready to calculate`
                      : 'Drag & drop here or click to browse (Max 10 MB)'}
                  </span>
                </div>

                <div className="upload-actions">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {fileToUpload && (
                      <span className="file-pill">
                        <Icon name="check" /> {fileToUpload.name}
                      </span>
                    )}
                    {reports.length > 0 && (
                      <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                        {reports.length} report{reports.length > 1 ? 's' : ''} on record
                      </span>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: 10 }}>
                    {fileToUpload && (
                      <button
                        type="button"
                        className="btn btn-accent btn-sm"
                        disabled={uploading}
                        onClick={handleUpload}
                      >
                        {uploading ? 'Processing Data…' : 'Upload & Compute Baseline'}
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Data & AI Analytics Section */}
              {activeReport && (
                <>
                  {/* KPI Cards Grid */}
                  <div className="stats-kpi-grid">
                    <div className="kpi-tile">
                      <span className="kpi-label">Total Revenue</span>
                      <span className="kpi-value">${(raw.total_sales || 0).toLocaleString()}</span>
                      <span className="kpi-sub">Total sales volume</span>
                    </div>

                    <div className="kpi-tile">
                      <span className="kpi-label">Total Costs</span>
                      <span className="kpi-value">${(raw.total_costs || 0).toLocaleString()}</span>
                      <span className="kpi-sub">Operating expenditures</span>
                    </div>

                    <div className="kpi-tile">
                      <span className="kpi-label">Net Profit</span>
                      <span className={`kpi-value ${(raw.net_profit || 0) >= 0 ? 'kpi-positive' : 'kpi-negative'}`}>
                        ${(raw.net_profit || 0).toLocaleString()}
                      </span>
                      <span className="kpi-sub">Net bottom line</span>
                    </div>

                    <div className="kpi-tile">
                      <span className="kpi-label">Profit Margin</span>
                      <span className={`kpi-value ${(raw.profit_margin || 0) >= 0 ? 'kpi-positive' : 'kpi-negative'}`}>
                        {raw.profit_margin || 0}%
                      </span>
                      <span className="kpi-sub">Gross margin ratio</span>
                    </div>

                    <div className="kpi-tile">
                      <span className="kpi-label">Active Customers</span>
                      <span className="kpi-value">{raw.total_customers || 0}</span>
                      <span className="kpi-sub">Unique accounts</span>
                    </div>

                    <div className="kpi-tile">
                      <span className="kpi-label">Avg Rev / Customer</span>
                      <span className="kpi-value">${(raw.arpu || 0).toLocaleString()}</span>
                      <span className="kpi-sub">ARPU</span>
                    </div>
                  </div>

                  {/* Analyze Callout (If not yet analyzed) */}
                  {!isCompleted && !analyzing && (
                    <div className="stats-ai-card" style={{ textAlign: 'center', padding: '32px 24px' }}>
                      <span className="ai-brand-badge" style={{ marginBottom: 12 }}>
                        DeepSeek Reasoning Engine
                      </span>
                      <h3 style={{ margin: '8px 0 10px', fontSize: 20 }}>
                        Ready for Strategic AI Business Evaluation
                      </h3>
                      <p style={{ color: 'var(--text-muted)', maxWidth: 560, margin: '0 auto 20px', fontSize: 14 }}>
                        DeepSeek will analyze your sales concentration, assess profitability ratios, identify operational bottlenecks, and formulate an actionable scaling strategy.
                      </p>
                      <button
                        type="button"
                        className="btn btn-accent"
                        style={{ padding: '10px 24px', fontSize: 15 }}
                        onClick={handleAnalyze}
                      >
                        <Icon name="bolt" /> Analyze {selectedStartup?.name || 'Startup'} with DeepSeek AI
                      </button>
                    </div>
                  )}

                  {/* AI Analyzing State */}
                  {analyzing && (
                    <div className="stats-ai-card ai-spinner-container">
                      <div className="ai-pulse-orb" />
                      <h4 style={{ margin: '0 0 6px', fontSize: 18 }}>DeepSeek is Analyzing Business Performance…</h4>
                      <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: 0, maxWidth: 460 }}>
                        Synthesizing unit economics, evaluating customer concentration risks, and calculating health scores…
                      </p>
                    </div>
                  )}

                  {/* DeepSeek Strategic Analysis Output */}
                  {isCompleted && (
                    <div className="stats-ai-card">
                      <div className="ai-header">
                        <div>
                          <span className="ai-brand-badge">DeepSeek AI Strategic Report</span>
                          <h3 style={{ margin: '8px 0 0', fontSize: 20 }}>
                            {selectedStartup?.name} Business Evaluation
                          </h3>
                        </div>

                        <div className="health-score-dial">
                          <div className="health-score-circle">
                            {ai.health_score || 75}
                          </div>
                          <div className="health-score-meta">
                            <b>Health Score</b>
                            <span>{ai.health_status || 'Solid Trajectory'}</span>
                          </div>
                        </div>
                      </div>

                      {ai.executive_summary && (
                        <div className="ai-executive-summary">
                          <b>Executive Summary:</b> {ai.executive_summary}
                        </div>
                      )}

                      <div className="ai-insights-grid">
                        {ai.key_strengths && ai.key_strengths.length > 0 && (
                          <div className="ai-insights-box">
                            <h4>
                              <Icon name="check" style={{ color: '#10b981' }} />
                              Key Business Strengths
                            </h4>
                            <ul className="ai-list strengths">
                              {ai.key_strengths.map((str, idx) => (
                                <li key={idx}>{str}</li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {ai.critical_risks && ai.critical_risks.length > 0 && (
                          <div className="ai-insights-box">
                            <h4>
                              <Icon name="bell" style={{ color: '#f59e0b' }} />
                              Critical Risks &amp; Bottlenecks
                            </h4>
                            <ul className="ai-list risks">
                              {ai.critical_risks.map((risk, idx) => (
                                <li key={idx}>{risk}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>

                      {ai.actionable_recommendations && ai.actionable_recommendations.length > 0 && (
                        <div className="recommendations-box">
                          <h4>Actionable Strategic Recommendations</h4>
                          {ai.actionable_recommendations.map((rec, idx) => (
                            <div className="rec-item" key={idx}>
                              <span
                                className={`rec-priority priority-${(rec.priority || 'medium').toLowerCase()}`}
                              >
                                {rec.priority || 'Medium'}
                              </span>
                              <div className="rec-content">
                                <b>{rec.title}</b>
                                <p>{rec.description}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Interactive Visual Charts Grid */}
                  <div className="charts-grid">
                    {/* Chart 1: Revenue vs Costs Timeline */}
                    <div className="chart-card">
                      <h4>Revenue vs. Operating Costs</h4>
                      <p className="chart-subtitle">Monthly cash flow and margin progression</p>

                      {monthlyTimeline.length > 0 ? (
                        <>
                          <div className="interactive-bar-chart">
                            {monthlyTimeline.map((item, idx) => {
                              const sHeight = Math.round(((item.sales || 0) / maxMonthlyVal) * 100);
                              const cHeight = Math.round(((item.costs || 0) / maxMonthlyVal) * 100);
                              return (
                                <div
                                  className="bar-group"
                                  key={idx}
                                  title={`${item.period}\nSales: $${(item.sales || 0).toLocaleString()}\nCosts: $${(item.costs || 0).toLocaleString()}\nProfit: $${(item.profit || 0).toLocaleString()}`}
                                >
                                  <div className="bars-wrapper">
                                    <div
                                      className="bar-stem bar-sales"
                                      style={{ height: `${Math.max(4, sHeight)}%` }}
                                    />
                                    <div
                                      className="bar-stem bar-costs"
                                      style={{ height: `${Math.max(4, cHeight)}%` }}
                                    />
                                  </div>
                                  <span className="bar-label-text">{item.period}</span>
                                </div>
                              );
                            })}
                          </div>

                          <div className="chart-legend">
                            <div className="legend-item">
                              <span className="legend-color" style={{ background: 'var(--accent)' }} />
                              <span>Revenue ($)</span>
                            </div>
                            <div className="legend-item">
                              <span className="legend-color" style={{ background: '#f43f5e' }} />
                              <span>Cost ($)</span>
                            </div>
                          </div>
                        </>
                      ) : (
                        <p style={{ color: 'var(--text-muted)', fontSize: 13, padding: '40px 0', textAlign: 'center' }}>
                          Upload a CSV with dates to generate monthly cash flow progression.
                        </p>
                      )}
                    </div>

                    {/* Chart 2: Top Customers Leaderboard */}
                    <div className="chart-card">
                      <h4>Top Customers by Spend</h4>
                      <p className="chart-subtitle">Customer revenue share &amp; concentration</p>

                      {raw.top_customers && raw.top_customers.length > 0 ? (
                        <div className="customer-leaderboard">
                          {raw.top_customers.map((cust, idx) => (
                            <div className="customer-row" key={idx}>
                              <div className="customer-meta">
                                <span className="customer-name">{cust.name}</span>
                                <span className="customer-spend">
                                  ${cust.spend.toLocaleString()} ({cust.share_pct}%)
                                </span>
                              </div>
                              <div className="customer-track">
                                <div
                                  className="customer-fill"
                                  style={{ width: `${Math.min(100, Math.max(8, cust.share_pct * 2))}%` }}
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p style={{ color: 'var(--text-muted)', fontSize: 13, padding: '40px 0', textAlign: 'center' }}>
                          No customer breakdown detected in the uploaded file.
                        </p>
                      )}
                    </div>

                    {/* Chart 3: Cost Structure Categories */}
                    {raw.category_breakdown && raw.category_breakdown.length > 0 && (
                      <div className="chart-card" style={{ gridColumn: '1 / -1' }}>
                        <h4>Cost Structure Breakdown</h4>
                        <p className="chart-subtitle">Expenditures by category</p>
                        <div className="category-bars">
                          {raw.category_breakdown.map((cat, idx) => {
                            const pct = raw.total_costs > 0
                              ? Math.round((cat.amount / raw.total_costs) * 100)
                              : 0;
                            return (
                              <div className="customer-row" key={idx}>
                                <div className="customer-meta">
                                  <span className="customer-name">{cat.name}</span>
                                  <span className="customer-spend">
                                    ${cat.amount.toLocaleString()} ({pct}%)
                                  </span>
                                </div>
                                <div className="customer-track">
                                  <div
                                    className="customer-fill"
                                    style={{
                                      width: `${Math.min(100, Math.max(5, pct))}%`,
                                      background: 'linear-gradient(90deg, #f43f5e 0%, #f59e0b 100%)',
                                    }}
                                  />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Raw Data Preview Table */}
                  {raw.preview_rows && raw.preview_rows.length > 0 && (
                    <div className="chart-card" style={{ marginTop: 20 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                        <h4 style={{ margin: 0 }}>Uploaded Data Sample</h4>
                        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                          Showing first {raw.preview_rows.length} rows of {raw.rows_count} total records
                        </span>
                      </div>
                      <div className="data-preview-table-wrapper">
                        <table className="data-preview-table">
                          <thead>
                            <tr>
                              {raw.columns.map((c, i) => (
                                <th key={i}>{c}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {raw.preview_rows.map((row, rIdx) => (
                              <tr key={rIdx}>
                                {raw.columns.map((c, cIdx) => (
                                  <td key={cIdx}>{row[c] !== undefined ? String(row[c]) : ''}</td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </main>
      </div>
      <CreateStartupModal open={createModalOpen} onClose={() => setCreateModalOpen(false)} />
    </div>
  );
}
