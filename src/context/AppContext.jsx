import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { api } from '../api/client';
import { timeAgo } from '../utils/timeAgo';

const AppContext = createContext(null);

const GUEST_USER = {
  id: null, slug: null, name: 'Guest', initials: '?', email: '', bio: '', location: '',
  saved_startups: [], followed_startups: [],
};

function transformUser(u) {
  return {
    id: u.id,
    slug: u.slug,
    name: u.name,
    initials: u.initials,
    email: u.email,
    bio: u.bio || '',
    location: u.location || '',
    saved_startups: u.saved_startups || [],
    followed_startups: u.followed_startups || [],
  };
}

function transformStartup(s) {
  return {
    name: s.name,
    initials: s.initials,
    verified: s.verified,
    founder: s.founder,
    ownerId: s.owner,
    tagline: s.tagline,
    status: s.status,
    tags: s.tags || [],
    goal: s.goal,
    raised: s.raised,
    deadline: s.deadline,
    overview: s.overview || '',
    team: (s.team || []).map((t) => [t.name, t.title]),
    timeline: (s.timeline || []).map((t) => [t.date_label, t.title, t.description]),
    docs: (s.docs || []).map((d) => [d.name, d.size]),
    collab: s.collab ? { role: s.collab.role, body: s.collab.body } : null,
    updates: (s.updates || []).map((u) => u.text),
  };
}

function transformComments(s) {
  return (s.comments || []).map((c) => ({ id: c.id, name: c.author_name, text: c.text, time: timeAgo(c.created_at) }));
}

function transformPost(p) {
  return {
    id: p.id,
    startupId: p.startup || undefined,
    type: p.kind === 'event' ? 'event' : undefined,
    postType: p.post_type,
    postTitle: p.title,
    postText: p.text,
    tags: p.tags || [],
    media: p.media || null,
    timestamp: timeAgo(p.created_at),
  };
}

function transformApplication(a) {
  return {
    id: a.id, startupId: a.startup, type: 'collaboration',
    role: a.role, name: a.name, email: a.email, link: a.link, message: a.message,
    applicantId: a.applicant, time: timeAgo(a.created_at), status: a.status,
  };
}

function transformInvestment(i) {
  return {
    id: i.id, startupId: i.startup, amount: i.amount,
    investorId: i.investor, time: timeAgo(i.created_at), status: i.status,
  };
}

export function AppProvider({ children }) {
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(GUEST_USER);
  const [signedIn, setSignedIn] = useState(false);
  const [startups, setStartups] = useState({});
  const [posts, setPosts] = useState([]);
  const [comments, setComments] = useState({});
  const [applications, setApplications] = useState([]);
  const [investments, setInvestments] = useState([]);
  const [postModalOpen, setPostModalOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      const [startupList, postList, me] = await Promise.all([
        api.get('/startups/'),
        api.get('/posts/'),
        api.get('/auth/me/').catch(() => null),
      ]);
      if (cancelled) return;

      const nextStartups = {};
      const nextComments = {};
      startupList.forEach((s) => {
        nextStartups[s.slug] = transformStartup(s);
        nextComments[s.slug] = transformComments(s);
      });
      setStartups(nextStartups);
      setComments(nextComments);
      setPosts(postList.map(transformPost));

      if (me) {
        setCurrentUser(transformUser(me));
        setSignedIn(true);
        const [appList, investList] = await Promise.all([
          api.get('/applications/').catch(() => []),
          api.get('/investments/').catch(() => []),
        ]);
        if (cancelled) return;
        setApplications(appList.map(transformApplication));
        setInvestments(investList.map(transformInvestment));
      }

      setLoading(false);
    }

    init();
    return () => { cancelled = true; };
  }, []);

  async function login(email, password) {
    const user = await api.post('/auth/login/', { email, password });
    setCurrentUser(transformUser(user));
    setSignedIn(true);
    const [appList, investList] = await Promise.all([
      api.get('/applications/').catch(() => []),
      api.get('/investments/').catch(() => []),
    ]);
    setApplications(appList.map(transformApplication));
    setInvestments(investList.map(transformInvestment));
    return user;
  }

  async function registerUser({ name, email, password }) {
    const cleanName = name.trim() || 'New Founder';
    const [first, ...rest] = cleanName.split(' ');
    const user = await api.post('/auth/register/', {
      first_name: first, last_name: rest.join(' '), email: email.trim(), password,
    });
    setCurrentUser(transformUser(user));
    setSignedIn(true);
    setApplications([]);
    setInvestments([]);
    return user;
  }

  async function logOut() {
    await api.post('/auth/logout/').catch(() => {});
    setCurrentUser(GUEST_USER);
    setSignedIn(false);
    setApplications([]);
    setInvestments([]);
  }

  async function updateCurrentUser(patch) {
    const body = {};
    if (patch.name !== undefined) {
      const [first, ...rest] = patch.name.trim().split(' ');
      body.first_name = first || '';
      body.last_name = rest.join(' ');
    }
    if (patch.email !== undefined) body.email = patch.email;
    if (patch.bio !== undefined) body.bio = patch.bio;
    if (patch.location !== undefined) body.location = patch.location;
    const updated = await api.patch('/auth/me/', body);
    setCurrentUser(transformUser(updated));
  }

  async function toggleSaved(id) {
    const isSaved = currentUser.saved_startups.includes(id);
    await api.post(`/startups/${id}/${isSaved ? 'unsave' : 'save'}/`);
    setCurrentUser((cur) => ({
      ...cur,
      saved_startups: isSaved ? cur.saved_startups.filter((x) => x !== id) : [...cur.saved_startups, id],
    }));
  }

  async function toggleFollow(id) {
    const isFollowing = currentUser.followed_startups.includes(id);
    await api.post(`/startups/${id}/${isFollowing ? 'unfollow' : 'follow'}/`);
    setCurrentUser((cur) => ({
      ...cur,
      followed_startups: isFollowing ? cur.followed_startups.filter((x) => x !== id) : [...cur.followed_startups, id],
    }));
  }

  async function createStartup({ name, tagline, tags, overview, goal }) {
    const s = await api.post('/startups/', {
      name, tagline: tagline || '', tags: (tags || []).filter(Boolean), overview: overview || '', goal: Number(goal) || 0,
    });
    setStartups((cur) => ({ ...cur, [s.slug]: transformStartup(s) }));
    setComments((cur) => ({ ...cur, [s.slug]: transformComments(s) }));
    return s.slug;
  }

  async function addPost(post) {
    const created = await api.post('/posts/', {
      startup: post.startupId, post_type: post.postType, title: post.postTitle,
      text: post.postText, tags: post.tags || [], media: post.media || '',
    });
    setPosts((cur) => [transformPost(created), ...cur]);
  }

  function loadMorePosts(batch) {
    setPosts((cur) => [...cur, ...batch]);
  }

  async function addComment(startupId, text) {
    const created = await api.post('/comments/', { startup: startupId, text });
    setComments((cur) => ({
      ...cur,
      [startupId]: [...(cur[startupId] || []), { id: created.id, name: created.author_name, text: created.text, time: timeAgo(created.created_at) }],
    }));
  }

  async function addApplication(app) {
    const created = await api.post('/applications/', {
      startup: app.startupId, role: app.role, name: app.name, email: app.email, link: app.link, message: app.message,
    });
    setApplications((cur) => [transformApplication(created), ...cur]);
  }

  async function setApplicationStatus(id, status) {
    const updated = await api.patch(`/applications/${id}/`, { status });
    setApplications((cur) => cur.map((a) => (a.id === id ? transformApplication(updated) : a)));
  }

  async function addInvestment(startupId, amount) {
    const created = await api.post('/investments/', { startup: startupId, amount });
    setInvestments((cur) => [transformInvestment(created), ...cur]);
  }

  async function cancelInvestment(id) {
    await api.delete(`/investments/${id}/`);
    setInvestments((cur) => cur.filter((i) => i.id !== id));
  }

  async function setInvestmentStatus(id, status) {
    const updated = await api.patch(`/investments/${id}/`, { status });
    setInvestments((cur) => cur.map((i) => (i.id === id ? transformInvestment(updated) : i)));
  }

  function openCreatePost() {
    setPostModalOpen(true);
  }

  function closeCreatePost() {
    setPostModalOpen(false);
  }

  const saved = useMemo(() => new Set(currentUser.saved_startups), [currentUser.saved_startups]);
  const followed = useMemo(() => new Set(currentUser.followed_startups), [currentUser.followed_startups]);

  const myStartups = useMemo(
    () => Object.entries(startups).filter(([, s]) => s.ownerId === currentUser.id),
    [startups, currentUser.id],
  );

  const collaboratingIds = useMemo(
    () => [...new Set(
      applications
        .filter((a) => a.applicantId === currentUser.id && a.status === 'accepted')
        .map((a) => a.startupId),
    )].filter((id) => startups[id] && startups[id].ownerId !== currentUser.id),
    [applications, currentUser.id, startups],
  );

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'var(--bg)', color: 'var(--text-muted)', fontSize: 14,
      }}
      >
        Loading Forge &amp; Flight…
      </div>
    );
  }

  return (
    <AppContext.Provider
      value={{
        currentUser, updateCurrentUser, registerUser, login, logOut, signedIn, setSignedIn,
        startups, createStartup, myStartups, collaboratingIds,
        saved, toggleSaved,
        followed, toggleFollow,
        posts, addPost, loadMorePosts,
        comments, addComment,
        applications, addApplication, setApplicationStatus,
        investments, addInvestment, cancelInvestment, setInvestmentStatus,
        postModalOpen, openCreatePost, closeCreatePost,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
