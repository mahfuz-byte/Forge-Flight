import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Topbar from '../components/Topbar';
import LeftNav from '../components/LeftNav';
import RightRail from '../components/RightRail';
import LogoBadge from '../components/LogoBadge';
import { Icon } from '../components/IconSprite';
import { statusMeta, fmtMoney, fundingPct } from '../data/startups';
import { useApp } from '../context/AppContext';
import '../styles/explore.css';

const FILTER_TABS = [
  ['all', 'All Startups'],
  ['funding', 'Funding Open'],
  ['collab', 'Collaboration'],
  ['saved', 'Saved'],
];

const HEADINGS = {
  all: ['Explore Startups', 'Discover every startup building in public on Forge & Flight.'],
  funding: ['Funding Opportunities', 'Startups with an open or upcoming funding window.'],
  collab: ['Collaboration Openings', 'Open roles founders are hiring for right now.'],
  saved: ['Saved Startups', 'Startups you’ve bookmarked to revisit later.'],
};

export default function Explore() {
  const [params, setParams] = useSearchParams();
  const filter = params.get('filter') || 'all';
  const [query, setQuery] = useState(() => params.get('q') || '');
  const [tag, setTag] = useState('All');
  const navigate = useNavigate();
  const { saved, startups } = useApp();

  function setFilter(next) {
    const nextParams = {};
    if (next !== 'all') nextParams.filter = next;
    if (query) nextParams.q = query;
    setParams(nextParams);
  }

  const allTags = useMemo(
    () => [...new Set(Object.values(startups).flatMap((s) => s.tags))].sort(),
    [startups],
  );

  const list = useMemo(() => {
    return Object.entries(startups).filter(([id, s]) => {
      if (filter === 'funding' && !(s.status === 'open' || s.status === 'soon')) return false;
      if (filter === 'collab' && !s.collab) return false;
      if (filter === 'saved' && !saved.has(id)) return false;
      if (tag !== 'All' && !s.tags.includes(tag)) return false;
      if (query) {
        const q = query.toLowerCase();
        const hay = `${s.name} ${s.founder} ${s.tagline} ${s.tags.join(' ')}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [filter, tag, query, saved, startups]);

  const [title, sub] = HEADINGS[filter] || HEADINGS.all;

  return (
    <div>
      <Topbar />
      <div className="layout">
        <LeftNav />
        <main className="center-col explore-page">
          <div className="explore-head">
            <h2>{title}</h2>
            <p>{sub}</p>
            <div className="explore-search">
              <Icon name="search" />
              <input
                type="text"
                placeholder="Search startups, founders, industries..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
          </div>

          <div className="filter-row">
            {FILTER_TABS.map(([key, label]) => (
              <button key={key} className={`filter-pill${filter === key ? ' active' : ''}`} onClick={() => setFilter(key)}>{label}</button>
            ))}
          </div>

          <div className="tag-filter-row">
            <button className={`tag-filter${tag === 'All' ? ' active' : ''}`} onClick={() => setTag('All')}>All industries</button>
            {allTags.map((t) => (
              <button key={t} className={`tag-filter${tag === t ? ' active' : ''}`} onClick={() => setTag(t)}>#{t}</button>
            ))}
          </div>

          {list.length === 0 ? (
            <div className="explore-empty">
              <Icon name="compass" style={{ width: 32, height: 32 }} />
              <p>{filter === 'saved' ? 'No saved startups yet — bookmark one from the feed or explore grid to see it here.' : 'No startups match your filters.'}</p>
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
                    <div className="tags-row">{s.tags.map((t) => <span className="tag-chip" key={t}>#{t}</span>)}</div>
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
        <RightRail />
      </div>
    </div>
  );
}
