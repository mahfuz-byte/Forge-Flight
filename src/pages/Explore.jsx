import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Topbar from '../components/Topbar';
import LeftNav from '../components/LeftNav';
import LogoBadge from '../components/LogoBadge';
import { Icon } from '../components/IconSprite';
import { statusMeta, fmtMoney, fundingPct } from '../data/startups';
import { useApp } from '../context/AppContext';
import '../styles/explore.css';

const FILTER_TABS = [
  ['all', 'All Startups'],
  ['trending', 'Trending'],
  ['funding', 'Funding Open'],
  ['collab', 'Collaboration'],
  ['saved', 'Saved'],
];

const TRENDING_IDS = new Set(['healthsync', 'medai', 'nimbus', 'farmchain']);

const HEADINGS = {
  all: ['Explore Startups', 'Discover every startup building in public on Forge & Flight.'],
  trending: ['Trending Startups', 'Startups seeing the strongest traction and attention right now.'],
  funding: ['Funding Opportunities', 'Startups with an open or upcoming funding window.'],
  collab: ['Collaboration Openings', 'Open roles founders are hiring for right now.'],
  saved: ['Saved Startups', 'Startups you’ve bookmarked to revisit later.'],
};

export default function Explore() {
  const [params, setParams] = useSearchParams();
  const filter = params.get('filter') || 'all';
  const [query, setQuery] = useState(() => params.get('q') || '');
  const navigate = useNavigate();
  const { saved, startups } = useApp();

  // Sync state if URL query param changes
  useEffect(() => {
    setQuery(params.get('q') || '');
  }, [params]);

  function setFilter(next) {
    const nextParams = {};
    if (next !== 'all') nextParams.filter = next;
    if (query) nextParams.q = query;
    setParams(nextParams);
  }

  function handleSearchChange(e) {
    const val = e.target.value;
    setQuery(val);
    const nextParams = {};
    if (filter !== 'all') nextParams.filter = filter;
    if (val.trim()) nextParams.q = val;
    setParams(nextParams);
  }

  function handleClearSearch() {
    setQuery('');
    const nextParams = {};
    if (filter !== 'all') nextParams.filter = filter;
    setParams(nextParams);
  }

  function applyTagSearch(t) {
    const nextQuery = `#${t}`;
    setQuery(nextQuery);
    const nextParams = {};
    if (filter !== 'all') nextParams.filter = filter;
    nextParams.q = nextQuery;
    setParams(nextParams);
  }

  const list = useMemo(() => {
    // Only public (approved) startups are explorable, even for staff and owners.
    return Object.entries(startups).filter(([id, s]) => {
      if (s.reviewStatus !== 'approved') return false;
      if (filter === 'trending' && !TRENDING_IDS.has(id)) return false;
      if (filter === 'funding' && !(s.status === 'open' || s.status === 'soon')) return false;
      if (filter === 'collab' && !s.collab) return false;
      if (filter === 'saved' && !saved.has(id)) return false;
      if (query.trim()) {
        const q = query.trim().toLowerCase();
        if (q.startsWith('#')) {
          const tagSearch = q.slice(1).trim();
          if (tagSearch && !s.tags.some((t) => t.toLowerCase() === tagSearch || t.toLowerCase().includes(tagSearch))) {
            return false;
          }
        } else {
          const isDirectTagMatch = s.tags.some((t) => t.toLowerCase() === q || t.toLowerCase().includes(q));
          const hay = `${s.name} ${s.founder} ${s.tagline}`.toLowerCase();
          if (!isDirectTagMatch && !hay.includes(q)) return false;
        }
      }
      return true;
    });
  }, [filter, query, saved, startups]);

  const [title, sub] = HEADINGS[filter] || HEADINGS.all;
  const isTagSearch = query.trim().startsWith('#');

  return (
    <div>
      <Topbar />
      <div className="layout layout-2col">
        <LeftNav />
        <main className="center-col explore-page">
          <div className="explore-head">
            <h2>{title}</h2>
            <p>{sub}</p>
            <div className="explore-search">
              <Icon name="search" />
              <input
                type="text"
                placeholder="Search startups, founders, or #tag..."
                value={query}
                onChange={handleSearchChange}
              />
              {query && (
                <button
                  type="button"
                  className="icon-btn"
                  aria-label="Clear search"
                  style={{
                    position: 'absolute',
                    right: 10,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    padding: 4,
                  }}
                  onClick={handleClearSearch}
                >
                  <Icon name="x" />
                </button>
              )}
            </div>

            {isTagSearch && (
              <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Categorized by tag:</span>
                <span
                  className="tag-chip"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    fontWeight: 600,
                    color: 'var(--accent)',
                    borderColor: 'var(--accent)',
                  }}
                >
                  {query.trim()}
                  <button
                    type="button"
                    aria-label="Remove tag filter"
                    style={{
                      border: 'none',
                      background: 'none',
                      padding: 0,
                      cursor: 'pointer',
                      color: 'inherit',
                      fontSize: 14,
                      lineHeight: 1,
                      display: 'flex',
                    }}
                    onClick={handleClearSearch}
                  >
                    ×
                  </button>
                </span>
              </div>
            )}
          </div>

          <div className="filter-row" style={{ paddingBottom: 20 }}>
            {FILTER_TABS.map(([key, label]) => (
              <button
                key={key}
                className={`filter-pill${filter === key ? ' active' : ''}`}
                onClick={() => setFilter(key)}
              >
                {label}
              </button>
            ))}
          </div>

          {list.length === 0 ? (
            <div className="explore-empty">
              <Icon name="compass" style={{ width: 32, height: 32 }} />
              <p>
                {filter === 'saved'
                  ? 'No saved startups yet — bookmark one from the feed or explore grid to see it here.'
                  : query
                  ? `No startups match "${query}". Try searching a different keyword or #tag.`
                  : 'No startups match your filters.'}
              </p>
              {query && (
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  style={{ marginTop: 8 }}
                  onClick={handleClearSearch}
                >
                  Clear search
                </button>
              )}
            </div>
          ) : (
            <div className="explore-grid">
              {list.map(([id, s]) => {
                const pct = fundingPct(s.raised, s.goal);
                const meta = statusMeta(s.status);
                return (
                  <article className="explore-card" key={id} onClick={() => navigate(`/profile/${id}`)}>
                    <div className="explore-card-head">
                      <LogoBadge id={id} initials={s.initials} size={46} />
                      <span className={`status-pill ${meta.cls}`}>{meta.label}</span>
                    </div>
                    <h3>{s.name}{s.verified && <Icon name="check" />}</h3>
                    <p className="explore-tagline">{s.tagline}</p>
                    <div className="tags-row">
                      {s.tags.map((t) => (
                        <span
                          className="tag-chip"
                          key={t}
                          role="button"
                          tabIndex={0}
                          title={`Categorize by #${t}`}
                          style={{ cursor: 'pointer' }}
                          onClick={(e) => {
                            e.stopPropagation();
                            applyTagSearch(t);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.stopPropagation();
                              applyTagSearch(t);
                            }
                          }}
                        >
                          #{t}
                        </span>
                      ))}
                    </div>
                    <div className="gauge"><span style={{ width: `${pct}%` }} /></div>
                    <div className="funding-nums">
                      <span>Raised <b>{fmtMoney(s.raised)}</b></span>
                      <span className="muted">{pct}%</span>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
