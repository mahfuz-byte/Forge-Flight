import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Topbar from '../components/Topbar';
import LeftNav from '../components/LeftNav';
import LogoBadge from '../components/LogoBadge';
import { Icon } from '../components/IconSprite';
import { useApp } from '../context/AppContext';
import { api, mediaUrl } from '../api/client';
import '../styles/settings.css';
import '../styles/statistics.css';

export default function Statistics() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { startups, currentUser } = useApp();

  const [selectedSlug, setSelectedSlug] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchDropdownOpen, setSearchDropdownOpen] = useState(false);

  const [researchData, setResearchData] = useState(null);
  const [loadingResearch, setLoadingResearch] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const searchBoxRef = useRef(null);

  // Initialize selected startup ONLY if an explicit query param is provided (e.g. direct link)
  // Otherwise, always start with a clean page and do not auto-select any company.
  useEffect(() => {
    const paramSlug = searchParams.get('startup') || searchParams.get('company');
    if (paramSlug) {
      setSelectedSlug(paramSlug);
      const st = startups && startups[paramSlug];
      if (st && st.name) setSearchQuery(st.name);
    } else {
      setSelectedSlug('');
      setSearchQuery('');
      setSearchResults([]);
      setResearchData(null);
    }
  }, [searchParams, startups]);

  // Clean unmount: when leaving this page to go to any other field, wipe all previous search data and graphs
  useEffect(() => {
    return () => {
      setSelectedSlug('');
      setSearchQuery('');
      setSearchResults([]);
      setResearchData(null);
      setErrorMessage('');
    };
  }, []);

  // When switching accounts (logout or login with different account), reset all research, searches, and graphs
  useEffect(() => {
    setSelectedSlug('');
    setSearchQuery('');
    setSearchResults([]);
    setResearchData(null);
    setErrorMessage('');
    setSearchDropdownOpen(false);
    if (searchParams.get('startup') || searchParams.get('company')) {
      setSearchParams({}, { replace: true });
    }
  }, [currentUser?.id, searchParams, setSearchParams]);

  // Debounced live company search
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    const timer = setTimeout(() => {
      api.get(`/statistics/search-companies/?q=${encodeURIComponent(searchQuery.trim())}`)
        .then((data) => {
          setSearchResults(Array.isArray(data) ? data : []);
        })
        .catch(() => {
          setSearchResults([]);
        });
    }, 200);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Close search dropdown on click outside
  useEffect(() => {
    function handleClickOutside(e) {
      if (searchBoxRef.current && !searchBoxRef.current.contains(e.target)) {
        setSearchDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fetch company research dossier when selectedSlug changes
  useEffect(() => {
    if (!selectedSlug) {
      setResearchData(null);
      setLoadingResearch(false);
      return;
    }
    let isMounted = true;
    setLoadingResearch(true);
    setErrorMessage('');

    api.get(`/statistics/research/?startup=${encodeURIComponent(selectedSlug)}`)
      .then((data) => {
        if (!isMounted) return;
        setResearchData(data);
      })
      .catch((err) => {
        if (!isMounted) return;
        setErrorMessage(err.message || 'Could not load company research data.');
        setResearchData(null);
      })
      .finally(() => {
        if (isMounted) setLoadingResearch(false);
      });

    return () => { isMounted = false; };
  }, [selectedSlug]);

  function handleSelectCompany(slug, name) {
    setSelectedSlug(slug);
    setSearchQuery(name || slug);
    setSearchDropdownOpen(false);
  }

  function handleClearSearch() {
    setSelectedSlug('');
    setSearchQuery('');
    setSearchResults([]);
    setResearchData(null);
    setErrorMessage('');
    setSearchDropdownOpen(false);
    if (searchParams.get('startup') || searchParams.get('company')) {
      setSearchParams({}, { replace: true });
    }
  }

  // Trigger / Re-run DeepSeek AI Analysis on all published data
  async function handleRefreshAnalysis() {
    if (!selectedSlug) return;
    setAnalyzing(true);
    setErrorMessage('');

    try {
      const updated = await api.post('/statistics/research/', { startup: selectedSlug });
      setResearchData(updated);
    } catch (err) {
      setErrorMessage(err.message || 'AI valuation and projection request failed.');
    } finally {
      setAnalyzing(false);
    }
  }

  const startupInfo = researchData?.startup || (startups && startups[selectedSlug]);
  const verdict = researchData?.verdict || {};
  const raw = researchData?.aggregated_summary || {};
  const publishedReports = researchData?.published_reports || [];

  // Combine historical and future projection periods for unified visualization
  const combinedTimeline = useMemo(() => {
    const historical = (raw?.monthly_timeline || []).map((m) => ({
      period: m.period || m.month,
      sales: m.sales || 0,
      costs: m.costs || 0,
      profit: m.profit || 0,
      isForecast: false,
    }));

    const forecast = (verdict?.future_projections || []).map((f) => ({
      period: f.period,
      sales: f.sales || 0,
      costs: f.costs || 0,
      profit: f.profit || 0,
      isForecast: true,
    }));

    return [...historical, ...forecast];
  }, [raw?.monthly_timeline, verdict?.future_projections]);

  const maxVal = useMemo(() => {
    if (!combinedTimeline.length) return 100;
    return Math.max(
      ...combinedTimeline.map((item) => Math.max(item.sales || 0, item.costs || 0)),
      100
    );
  }, [combinedTimeline]);

  return (
    <div>
      <Topbar />
      <div className="layout layout-2col">
        <LeftNav />
        <main className="center-col stats-page">
          {/* Header Card with Universal Company Search */}
          <div className="stats-header-card">
            <div className="stats-header-titles">
              <h2>
                <Icon name="chart" />
                AI Company Research &amp; Projections
              </h2>
              <p>
                DeepSeek AI Valuation · Forward Projections · Growth Trajectory &amp; Verdict
              </p>
            </div>

            {/* Live Autocomplete Company Search Bar */}
            <div className="research-search-wrapper" ref={searchBoxRef}>
              <div style={{ position: 'relative' }}>
                <span className="research-search-icon">
                  <Icon name="compass" />
                </span>
                <input
                  type="text"
                  className="research-search-input"
                  style={{ paddingRight: (searchQuery || selectedSlug) ? 36 : 16 }}
                  placeholder="Search any company (e.g. HealthSync, Pathao)..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setSearchDropdownOpen(true);
                  }}
                  onFocus={() => setSearchDropdownOpen(true)}
                />
                {(searchQuery || selectedSlug) && (
                  <button
                    type="button"
                    onClick={handleClearSearch}
                    style={{
                      position: 'absolute',
                      right: 12,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      color: 'var(--text-muted)',
                      cursor: 'pointer',
                      fontSize: 16,
                      lineHeight: 1,
                      padding: 4,
                    }}
                    title="Clear search"
                    aria-label="Clear search"
                  >
                    ✕
                  </button>
                )}
              </div>

              {searchDropdownOpen && searchResults.length > 0 && (
                <div className="research-dropdown">
                  {searchResults.map((item) => (
                    <div
                      key={item.slug}
                      className="research-dropdown-item"
                      onClick={() => handleSelectCompany(item.slug, item.name)}
                    >
                      <div>
                        <b style={{ fontSize: 14 }}>{item.name}</b>
                        <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--text-muted)' }}>
                          {item.tagline || item.slug}
                        </p>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        {item.has_reports ? (
                          <span className="badge badge-accent" style={{ fontSize: 11 }}>
                            {item.reports_count} Published File{item.reports_count === 1 ? '' : 's'}
                          </span>
                        ) : (
                          <span style={{ fontSize: 11, color: 'var(--text-faint)' }}>Registered</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {errorMessage && (
            <div className="modal-error" style={{ marginBottom: 20 }}>
              <Icon name="close" /> {errorMessage}
            </div>
          )}

          {/* Company Context Bar (shown only when a company is selected and research is loaded) */}
          {startupInfo && researchData && !loadingResearch && (
            <div className="settings-card" style={{ padding: '16px 20px', marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <LogoBadge id={startupInfo.slug} initials={startupInfo.initials} size={48} />
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <h3 style={{ margin: 0, fontSize: 18 }}>
                      {startupInfo.name}
                    </h3>
                    {startupInfo.verified && (
                      <span title="Verified Startup" style={{ color: 'var(--accent)', display: 'inline-flex' }}>
                        <Icon name="check" />
                      </span>
                    )}
                    {startupInfo.status && (
                      <span className={`status-pill status-${startupInfo.status}`}>
                        {startupInfo.status === 'open' ? 'Funding Open' : startupInfo.status}
                      </span>
                    )}
                  </div>
                  <p style={{ margin: '2px 0 0', fontSize: 13, color: 'var(--text-muted)' }}>
                    {startupInfo.tagline || 'Startup on Forge & Flight'} · {publishedReports.length} Published Financial File{publishedReports.length === 1 ? '' : 's'}
                  </p>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  onClick={handleClearSearch}
                  title="Clear this research and return to clean research page"
                >
                  <Icon name="close" /> Clear Search
                </button>
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  onClick={() => navigate(`/profile/${startupInfo.slug}`)}
                >
                  <Icon name="compass" /> View Profile
                </button>
                <button
                  type="button"
                  className="btn btn-accent btn-sm"
                  disabled={analyzing}
                  onClick={handleRefreshAnalysis}
                >
                  <Icon name="sparkle" /> {analyzing ? 'Reasoning with DeepSeek…' : 'Run DeepSeek AI Verdict'}
                </button>
              </div>
            </div>
          )}

          {/* Clean State (When no search has been performed yet) */}
          {!loadingResearch && !analyzing && (!selectedSlug || !researchData) && (
            <div className="founder-gate-card" style={{ maxWidth: 680, margin: '20px auto 40px', padding: '44px 32px' }}>
              <div className="founder-gate-icon" style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}>
                <Icon name="sparkle" />
              </div>
              <h3 style={{ fontSize: 22, marginBottom: 8 }}>Search a Company for AI Research</h3>
              <p style={{ maxWidth: 520, margin: '0 auto 24px', lineHeight: 1.6, color: 'var(--text-muted)' }}>
                Type any company name or select a featured startup below to run real-time DeepSeek AI valuations, forward projections, unit economics, and investment health grades.
              </p>

              {/* Quick Suggestion Chips */}
              <div style={{ marginTop: 20 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 12 }}>
                  Featured Companies for Analysis
                </span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'center' }}>
                  {Object.entries(startups || {})
                    .filter(([, s]) => s.reviewStatus === 'approved')
                    .slice(0, 5)
                    .map(([slug, s]) => (
                      <button
                        key={slug}
                        type="button"
                        className="btn btn-outline btn-sm"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 14px' }}
                        onClick={() => handleSelectCompany(slug, s.name)}
                      >
                        <LogoBadge id={slug} initials={s.initials} size={20} />
                        <span>{s.name}</span>
                      </button>
                    ))}
                </div>
              </div>

              {/* Highlights 3-col info */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginTop: 36, textAlign: 'left', borderTop: '1px solid var(--border)', paddingTop: 24 }}>
                <div style={{ padding: '8px 12px' }}>
                  <b style={{ fontSize: 13, display: 'block', marginBottom: 4, color: 'var(--text)' }}>
                    📈 Forward Projections
                  </b>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>
                    Multi-month projected revenue, operating cost models, and EBITDA forecasts.
                  </span>
                </div>
                <div style={{ padding: '8px 12px' }}>
                  <b style={{ fontSize: 13, display: 'block', marginBottom: 4, color: 'var(--text)' }}>
                    💎 Valuation Estimates
                  </b>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>
                    Low-to-high valuation ranges based on industry ARR multiples and traction.
                  </span>
                </div>
                <div style={{ padding: '8px 12px' }}>
                  <b style={{ fontSize: 13, display: 'block', marginBottom: 4, color: 'var(--text)' }}>
                    🛡️ Verified Statements
                  </b>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>
                    Evidence backed by published CSV sales transactions and monthly reports.
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Loading Research State */}
          {loadingResearch && (
            <div className="stats-ai-card ai-spinner-container">
              <div className="ai-pulse-orb" />
              <h4 style={{ margin: '0 0 6px', fontSize: 18 }}>Loading Business Intelligence &amp; Statistics…</h4>
              <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: 0, maxWidth: 460 }}>
                Synthesizing published CSV spreadsheets, calculating unit economics, and loading forward projections…
              </p>
            </div>
          )}

          {/* AI Analyzing State */}
          {analyzing && (
            <div className="stats-ai-card ai-spinner-container">
              <div className="ai-pulse-orb" />
              <h4 style={{ margin: '0 0 6px', fontSize: 18 }}>DeepSeek is Formulating Investment Verdict…</h4>
              <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: 0, maxWidth: 460 }}>
                Modeling future projections, assessing valuation multiples, and computing business growth trajectories…
              </p>
            </div>
          )}

          {!loadingResearch && !analyzing && researchData && (
            <>
              {/* Top AI Scorecard Grid: Valuation, Growth %, and Verdict */}
              <div className="verdict-hero-grid">
                {/* 1. Valuation Estimate Tile */}
                <div className="verdict-tile">
                  <span className="verdict-tile-label">AI Valuation Estimate</span>
                  <span className="verdict-tile-value">
                    ${(verdict.valuation_low || 0).toLocaleString()} – ${(verdict.valuation_high || 0).toLocaleString()}
                  </span>
                  <span className="verdict-tile-sub">
                    Multiple: <b>{verdict.valuation_multiple || '4.0x - 6.5x ARR'}</b>
                  </span>
                </div>

                {/* 2. Business Growth Percentage */}
                <div className="verdict-tile">
                  <span className="verdict-tile-label">Business Growth Rate</span>
                  <span className="verdict-tile-value" style={{ color: '#10b981' }}>
                    +{verdict.projected_annual_growth || 35.0}% <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-muted)' }}>YoY Projected</span>
                  </span>
                  <span className="verdict-tile-sub">
                    Historical: <b>+{verdict.historical_mom_growth || raw.mom_growth_rate || 0}% MoM</b> · {verdict.growth_stage || 'Early Scale'}
                  </span>
                </div>

                {/* 3. Investment Verdict & Health Score */}
                <div className="verdict-tile">
                  <span className="verdict-tile-label">Investment Verdict</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 2 }}>
                    <div className="health-score-circle" style={{ width: 44, height: 44, fontSize: 17, borderColor: (verdict.health_score || 75) >= 75 ? '#10b981' : '#f59e0b', color: (verdict.health_score || 75) >= 75 ? '#10b981' : '#f59e0b' }}>
                      {verdict.health_score || 75}
                    </div>
                    <div>
                      <b style={{ fontSize: 14, color: 'var(--text)', display: 'block' }}>
                        {verdict.investment_verdict || 'Promising Trajectory'}
                      </b>
                      <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>Health Grade</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Verified Baseline Financial Metrics */}
              <div className="stats-kpi-grid">
                <div className="kpi-tile">
                  <span className="kpi-label">Recorded Revenue</span>
                  <span className="kpi-value">${(raw.total_sales || 0).toLocaleString()}</span>
                  <span className="kpi-sub">Total published sales</span>
                </div>

                <div className="kpi-tile">
                  <span className="kpi-label">Operating Expenses</span>
                  <span className="kpi-value">${(raw.total_costs || 0).toLocaleString()}</span>
                  <span className="kpi-sub">Expenditures on record</span>
                </div>

                <div className="kpi-tile">
                  <span className="kpi-label">Net Profit / Income</span>
                  <span className={`kpi-value ${(raw.net_profit || 0) >= 0 ? 'kpi-positive' : 'kpi-negative'}`}>
                    ${(raw.net_profit || 0).toLocaleString()}
                  </span>
                  <span className="kpi-sub">Bottom line margin</span>
                </div>

                <div className="kpi-tile">
                  <span className="kpi-label">Profit Margin</span>
                  <span className={`kpi-value ${(raw.profit_margin || 0) >= 0 ? 'kpi-positive' : 'kpi-negative'}`}>
                    {raw.profit_margin || 0}%
                  </span>
                  <span className="kpi-sub">Gross margin ratio</span>
                </div>

                <div className="kpi-tile">
                  <span className="kpi-label">Customer Accounts</span>
                  <span className="kpi-value">{raw.total_customers || 0}</span>
                  <span className="kpi-sub">Unique buyers</span>
                </div>

                <div className="kpi-tile">
                  <span className="kpi-label">ARPU</span>
                  <span className="kpi-value">${(raw.arpu || 0).toLocaleString()}</span>
                  <span className="kpi-sub">Avg revenue / user</span>
                </div>
              </div>

              {/* AI Strategic Verdict & Executive Reasoning Card */}
              <div className="stats-ai-card">
                <div className="ai-header">
                  <div>
                    <span className="ai-brand-badge">
                      <Icon name="sparkle" /> DeepSeek Strategic Report
                    </span>
                    <h3 style={{ margin: '8px 0 0', fontSize: 20 }}>
                      {startupInfo?.name} Strategic Verdict &amp; Valuation
                    </h3>
                  </div>

                  <div className="health-score-dial">
                    <div className="health-score-circle">
                      {verdict.health_score || 75}
                    </div>
                    <div className="health-score-meta">
                      <b>Health Score</b>
                      <span>{verdict.investment_verdict || 'Solid Trajectory'}</span>
                    </div>
                  </div>
                </div>

                {verdict.executive_summary && (
                  <div className="ai-executive-summary">
                    <b>Executive Verdict:</b> {verdict.executive_summary}
                  </div>
                )}

                {verdict.valuation_rationale && (
                  <div style={{ padding: '12px 16px', background: 'var(--bg)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', marginBottom: 20, fontSize: 13.5 }}>
                    <b style={{ color: 'var(--accent)' }}>Valuation Methodology &amp; Multiples: </b>
                    {verdict.valuation_rationale}
                  </div>
                )}

                <div className="ai-insights-grid">
                  {verdict.key_strengths && verdict.key_strengths.length > 0 && (
                    <div className="ai-insights-box">
                      <h4>
                        <Icon name="check" style={{ color: '#10b981' }} />
                        Key Catalysts &amp; Business Strengths
                      </h4>
                      <ul className="ai-list strengths">
                        {verdict.key_strengths.map((str, idx) => (
                          <li key={idx}>{str}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {verdict.critical_risks && verdict.critical_risks.length > 0 && (
                    <div className="ai-insights-box">
                      <h4>
                        <Icon name="bell" style={{ color: '#f59e0b' }} />
                        Critical Bottlenecks &amp; Investment Risks
                      </h4>
                      <ul className="ai-list risks">
                        {verdict.critical_risks.map((risk, idx) => (
                          <li key={idx}>{risk}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                {verdict.actionable_recommendations && verdict.actionable_recommendations.length > 0 && (
                  <div className="recommendations-box">
                    <h4>Actionable Growth &amp; Scaling Recommendations</h4>
                    {verdict.actionable_recommendations.map((rec, idx) => (
                      <div className="rec-item" key={idx}>
                        <span className={`rec-priority priority-${(rec.priority || 'medium').toLowerCase()}`}>
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

              {/* Interactive Visual Charts: Historical Actuals + AI Future Projections */}
              <div className="charts-grid">
                {/* Unified Timeline Chart */}
                <div className="chart-card" style={{ gridColumn: '1 / -1' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 10 }}>
                    <div>
                      <h4 style={{ margin: 0 }}>Historical Cash Flow &amp; AI Future Projections</h4>
                      <p className="chart-subtitle" style={{ margin: '2px 0 0' }}>
                        Solid bars represent published historical actuals; dashed columns represent DeepSeek forward projections
                      </p>
                    </div>

                    <div className="chart-legend" style={{ margin: 0 }}>
                      <div className="legend-item">
                        <span className="legend-color" style={{ background: 'var(--accent)' }} />
                        <span>Revenue / Sales ($)</span>
                      </div>
                      <div className="legend-item">
                        <span className="legend-color" style={{ background: '#f43f5e' }} />
                        <span>Costs / Expenses ($)</span>
                      </div>
                      <div className="legend-item">
                        <span className="forecast-bar-tag">AI Forecast</span>
                        <span>Projected Quarters</span>
                      </div>
                    </div>
                  </div>

                  {combinedTimeline.length > 0 ? (
                    <div className="interactive-bar-chart" style={{ minHeight: 180, paddingTop: 16 }}>
                      {combinedTimeline.map((item, idx) => {
                        const sHeight = Math.round(((item.sales || 0) / maxVal) * 100);
                        const cHeight = Math.round(((item.costs || 0) / maxVal) * 100);
                        return (
                          <div
                            className={`bar-group${item.isForecast ? ' forecast-col' : ''}`}
                            key={idx}
                            title={`${item.period}${item.isForecast ? ' (AI Projection)' : ''}\nSales: $${(item.sales || 0).toLocaleString()}\nCosts: $${(item.costs || 0).toLocaleString()}\nNet Profit: $${(item.profit || 0).toLocaleString()}`}
                          >
                            <div className="bars-wrapper">
                              <div
                                className="bar-stem bar-sales"
                                style={{
                                  height: `${Math.max(4, sHeight)}%`,
                                  background: item.isForecast ? 'repeating-linear-gradient(45deg, var(--accent), var(--accent) 4px, rgba(14,165,233,0.3) 4px, rgba(14,165,233,0.3) 8px)' : 'var(--accent)',
                                  border: item.isForecast ? '1px dashed var(--accent)' : 'none',
                                }}
                              />
                              <div
                                className="bar-stem bar-costs"
                                style={{
                                  height: `${Math.max(4, cHeight)}%`,
                                  background: item.isForecast ? 'repeating-linear-gradient(45deg, #f43f5e, #f43f5e 4px, rgba(244,63,94,0.3) 4px, rgba(244,63,94,0.3) 8px)' : '#f43f5e',
                                  border: item.isForecast ? '1px dashed #f43f5e' : 'none',
                                }}
                              />
                            </div>
                            <span className="bar-label-text">
                              {item.period}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p style={{ color: 'var(--text-muted)', fontSize: 13, padding: '40px 0', textAlign: 'center' }}>
                      No published timeline data available for this company.
                    </p>
                  )}
                </div>

                {/* Customer Breakdown */}
                {raw.top_customers && raw.top_customers.length > 0 && (
                  <div className="chart-card">
                    <h4>Top Accounts &amp; Concentration Risk</h4>
                    <p className="chart-subtitle">Revenue share across published client accounts</p>
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
                  </div>
                )}

                {/* Cost Structure Breakdown */}
                {raw.category_breakdown && raw.category_breakdown.length > 0 && (
                  <div className="chart-card">
                    <h4>Cost Structure &amp; Expenditures</h4>
                    <p className="chart-subtitle">Expense allocations by department</p>
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

              {/* Published Files & Data Evidence Section */}
              <div className="chart-card" style={{ marginTop: 24 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
                  <div>
                    <h4 style={{ margin: 0 }}>Published Financial Files &amp; CSV Evidence</h4>
                    <p className="chart-subtitle" style={{ margin: '2px 0 0' }}>
                      These published files and reports provided by {startupInfo?.name} were analyzed by DeepSeek to formulate the above valuation and projections.
                    </p>
                  </div>
                </div>

                {publishedReports.length > 0 ? (
                  <div className="data-preview-table-wrapper">
                    <table className="data-preview-table">
                      <thead>
                        <tr>
                          <th>File Document</th>
                          <th>Format</th>
                          <th>Reporting Period</th>
                          <th>Upload Date</th>
                          <th>Records Parsed</th>
                          <th>Download &amp; Verify</th>
                        </tr>
                      </thead>
                      <tbody>
                        {publishedReports.map((r) => (
                          <tr key={r.id}>
                            <td>
                              <b style={{ color: 'var(--text)' }}>{r.original_filename}</b>
                            </td>
                            <td style={{ textTransform: 'uppercase' }}>{r.file_type}</td>
                            <td>{r.reporting_period || 'Monthly'}</td>
                            <td>{new Date(r.created_at).toLocaleDateString()}</td>
                            <td>{r.raw_summary?.rows_count ? `${r.raw_summary.rows_count} records` : 'Verified'}</td>
                            <td>
                              {r.file_url ? (
                                <a
                                  href={mediaUrl(r.file_url)}
                                  download={r.original_filename || 'financial_statement.csv'}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="btn btn-outline btn-xs"
                                  title="Download published file"
                                >
                                  <Icon name="doc" /> Download CSV
                                </a>
                              ) : (
                                <span style={{ fontSize: 12, color: 'var(--text-faint)' }}>Available on record</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p style={{ color: 'var(--text-muted)', fontSize: 13, padding: '24px 0', textAlign: 'center' }}>
                    No published financial documents attached yet for this company.
                  </p>
                )}
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
}
