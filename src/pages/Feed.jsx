import { useEffect, useMemo, useRef, useState } from 'react';
import Topbar from '../components/Topbar';
import LeftNav from '../components/LeftNav';
import FeedCard, { EventCard } from '../components/FeedCard';
import Avatar from '../components/Avatar';
import { useApp } from '../context/AppContext';

const FILTERS = ['All', 'Trending', 'Funding Open', 'Collaboration', 'Newest'];
const TRENDING_IDS = new Set(['healthsync', 'medai', 'nimbus', 'farmchain']);

export default function Feed() {
  const [filter, setFilter] = useState('All');
  const { posts, startups, loadMorePosts, hasMorePosts, postsLoading, openCreatePost, currentUser } = useApp();
  const sentinelRef = useRef(null);

  const filtered = useMemo(() => posts.filter((post) => {
    if (post.type === 'event') return filter === 'All' || filter === 'Newest';
    const s = startups[post.startupId];
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
