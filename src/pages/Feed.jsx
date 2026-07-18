import { useEffect, useMemo, useRef, useState } from 'react';
import Topbar from '../components/Topbar';
import LeftNav from '../components/LeftNav';
import RightRail from '../components/RightRail';
import FeedCard, { EventCard } from '../components/FeedCard';
import { nextPostBatch, MORE_POOL_SIZE } from '../data/posts';
import { useApp } from '../context/AppContext';

const FILTERS = ['All', 'Trending', 'Funding Open', 'Collaboration', 'Newest'];
const TRENDING_IDS = new Set(['healthsync', 'medai', 'nimbus', 'farmchain']);
const MAX_LOAD_ROUNDS = 3;

export default function Feed() {
  const [filter, setFilter] = useState('All');
  const [loading, setLoading] = useState(false);
  const [loadRounds, setLoadRounds] = useState(0);
  const { posts, startups, loadMorePosts, openCreatePost, currentUser } = useApp();
  const sentinelRef = useRef(null);

  const filtered = useMemo(() => posts.filter((post) => {
    if (post.type === 'event') return filter === 'All' || filter === 'Newest';
    const s = startups[post.startupId];
    if (filter === 'Trending') return TRENDING_IDS.has(post.startupId);
    if (filter === 'Funding Open') return s.status === 'open';
    if (filter === 'Collaboration') return post.postType === 'Collaboration Post';
    return true;
  }), [posts, filter, startups]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return undefined;
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && !loading && loadRounds < MAX_LOAD_ROUNDS) {
        setLoading(true);
        setTimeout(() => {
          loadMorePosts(nextPostBatch(Math.min(3, MORE_POOL_SIZE)));
          setLoadRounds((r) => r + 1);
          setLoading(false);
        }, 700);
      }
    }, { rootMargin: '200px' });
    observer.observe(el);
    return () => observer.disconnect();
  }, [loading, loadRounds, loadMorePosts]);

  return (
    <div>
      <Topbar />
      <div className="layout">
        <LeftNav />
        <main className="center-col">
          <div className="filter-row">
            {FILTERS.map((f) => (
              <button key={f} className={`filter-pill${filter === f ? ' active' : ''}`} onClick={() => setFilter(f)}>{f}</button>
            ))}
          </div>
          <div className="composer-strip">
            <button className="avatar" onClick={openCreatePost}>{currentUser.initials}</button>
            <input type="text" placeholder="Share a progress update..." readOnly style={{ cursor: 'pointer' }} onClick={openCreatePost} />
          </div>
          <div>
            {filtered.length === 0 ? (
              <div className="feed-end"><span className="feed-caught-up">No posts match this filter yet.</span></div>
            ) : filtered.map((post) => (
              post.type === 'event'
                ? <EventCard key={post.id} post={post} />
                : <FeedCard key={post.id} post={post} />
            ))}
          </div>
          <div ref={sentinelRef} className="feed-end">
            {loading && <span className="feed-loading"><span className="spinner" />Loading more...</span>}
            {!loading && loadRounds >= MAX_LOAD_ROUNDS && <span className="feed-caught-up">You&rsquo;re all caught up.</span>}
          </div>
        </main>
        <RightRail />
      </div>
    </div>
  );
}
