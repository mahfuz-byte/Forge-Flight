import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Topbar from '../components/Topbar';
import LeftNav from '../components/LeftNav';
import FeedCard, { EventCard } from '../components/FeedCard';
import Avatar from '../components/Avatar';
import LogoBadge from '../components/LogoBadge';
import { Icon } from '../components/IconSprite';
import { fmtMoney } from '../data/startups';
import { useApp } from '../context/AppContext';

const FILTERS = ['All', 'Trending', 'Funding Open', 'Collaboration', 'Newest'];
const TRENDING_IDS = new Set(['healthsync', 'medai', 'nimbus', 'farmchain']);

export default function Feed() {
  const [filter, setFilter] = useState('All');
  const navigate = useNavigate();
  const {
    posts, startups, loadMorePosts, hasMorePosts, postsLoading, openCreatePost, currentUser,
    signedIn, myStartups, investments, applications,
  } = useApp();
  const sentinelRef = useRef(null);

  const firstStartupEntry = myStartups && myStartups.length > 0 ? myStartups[0] : null;
  const [firstSlug, firstStartup] = firstStartupEntry || [null, null];

  const pendingRequests = useMemo(() => {
    if (!myStartups || myStartups.length === 0) return 0;
    const slugs = new Set(myStartups.map(([s]) => s));
    const pInv = (investments || []).filter((i) => slugs.has(i.startupId) && i.status === 'pending').length;
    const pApp = (applications || []).filter((a) => slugs.has(a.startupId) && a.status === 'pending').length;
    return pInv + pApp;
  }, [myStartups, investments, applications]);

  const filtered = useMemo(() => posts.filter((post) => {
    if (post.type === 'event') return filter === 'All' || filter === 'Newest';
    const s = startups[post.startupId];
    // Pending and unapproved startups are hidden from the feed
    if (s && s.reviewStatus !== 'approved') return false;
    if (filter === 'Trending') return TRENDING_IDS.has(post.startupId);
    if (filter === 'Funding Open') return s?.status === 'open';
    if (filter === 'Collaboration') return post.postType === 'Collaboration Post';
    return true;
  }), [posts, filter, startups]);

  // Fetch the next page from the server when the end of the feed scrolls into view (FE-05).
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasMorePosts) return undefined;
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) loadMorePosts();
    }, { rootMargin: '200px' });
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMorePosts, loadMorePosts]);

  return (
    <div>
      <Topbar />
      <div className="layout layout-2col">
        <LeftNav />
        <main className="center-col">
          <div className="filter-row">
            {FILTERS.map((f) => (
              <button key={f} className={`filter-pill${filter === f ? ' active' : ''}`} onClick={() => setFilter(f)}>{f}</button>
            ))}
          </div>
          {signedIn && firstStartup && (
            <div className="manage-startup-banner">
              <div className="ms-banner-left">
                <LogoBadge id={firstSlug} initials={firstStartup.initials} size={42} />
                <div className="ms-banner-info">
                  <div className="ms-banner-title">
                    <b>Manage Startup: {firstStartup.name}</b>
                    {firstStartup.reviewStatus === 'pending' ? (
                      <span
                        className="status-pill status-eval"
                        style={{ background: 'var(--warning-soft)', color: 'var(--warning)', borderColor: 'var(--warning)' }}
                      >
                        Pending Approval
                      </span>
                    ) : (
                      <span className={`status-pill ${firstStartup.status === 'open' ? 'status-open' : 'status-soon'}`}>
                        {firstStartup.status === 'open' ? 'Funding Open' : firstStartup.status}
                      </span>
                    )}
                  </div>
                  <span className="ms-banner-sub">
                    Raised {fmtMoney(firstStartup.raised)} of {fmtMoney(firstStartup.goal)}
                    {pendingRequests > 0 ? ` · ${pendingRequests} pending request${pendingRequests > 1 ? 's' : ''}` : ''}
                  </span>
                </div>
              </div>
              <div className="ms-banner-actions">
                <button
                  type="button"
                  className="btn btn-accent btn-sm"
                  onClick={() => navigate(`/dashboard/${firstSlug}`)}
                >
                  <Icon name="flag" /> Manage Startup
                </button>
              </div>
            </div>
          )}
          <div className="composer-strip">
            <Avatar src={currentUser.avatar} name={currentUser.name} initials={currentUser.initials} onClick={openCreatePost} className="avatar" />
            <input type="text" placeholder="Share a progress update..." readOnly style={{ cursor: 'pointer' }} onClick={openCreatePost} />
          </div>
          <div>
            {filtered.length === 0 && !postsLoading ? (
              <div className="feed-end"><span className="feed-caught-up">No posts match this filter yet.</span></div>
            ) : filtered.map((post) => (
              post.type === 'event'
                ? <EventCard key={post.id} post={post} />
                : <FeedCard key={post.id} post={post} />
            ))}
          </div>
          <div ref={sentinelRef} className="feed-end">
            {postsLoading && <span className="feed-loading"><span className="spinner" />Loading more...</span>}
            {!postsLoading && hasMorePosts && (
              <button className="btn btn-outline btn-sm" onClick={loadMorePosts}>Load more</button>
            )}
            {!postsLoading && !hasMorePosts && posts.length > 0 && <span className="feed-caught-up">You&rsquo;re all caught up.</span>}
          </div>
        </main>
      </div>
    </div>
  );
}
