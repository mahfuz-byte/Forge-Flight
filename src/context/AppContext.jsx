import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { api, getAuthToken, mediaUrl, setAuthToken } from '../api/client';
import { timeAgo } from '../utils/timeAgo';

const AppContext = createContext(null);

const THEME_KEY = 'forge-flight-theme';

const GUEST_USER = {
  id: null, slug: null, name: 'Guest', initials: '?', email: '', bio: '', location: '',
  saved_startups: [], followed_startups: [],
};

function getInitialTheme() {
  if (typeof window === 'undefined') return 'light';
  const stored = window.localStorage.getItem(THEME_KEY);
  if (stored === 'light' || stored === 'dark') return stored;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function transformUser(u) {
  return {
    id: u.id,
    slug: u.slug,
    name: u.name,
    initials: u.initials,
    email: u.email,
    role: u.role || 'user',
    hasPassword: u.has_password ?? true,
    googleLinked: Boolean(u.google_linked),
    bio: u.bio || '',
    location: u.location || '',
    avatar: mediaUrl(u.avatar),
    headline: u.headline || '',
    resume: mediaUrl(u.resume),
    skills: u.skills || '',
    experience_level: u.experience_level || '',
    portfolio_link: u.portfolio_link || '',
    investor_type: u.investor_type || '',
    investment_budget: u.investment_budget || '',
    investment_interests: u.investment_interests || '',
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
    founderAvatar: mediaUrl(s.founder_avatar),
    reviewStatus: s.review_status || 'approved',
    reviewNote: s.review_note || '',
    featured: Boolean(s.featured),
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
    docs: (s.docs || []).map((d) => ({ id: d.id, name: d.name, size: d.size, url: mediaUrl(d.file) })),
    collab: s.collab ? { role: s.collab.role, body: s.collab.body, isOpen: s.collab.is_open !== false } : null,
    updates: (s.updates || []).map((u) => u.text),
  };
}

function transformConversation(c, currentUserId) {
  const messages = c.messages || [];
  const thread = messages.map((m) => ({
    id: m.id,
    from: m.sender === currentUserId ? 'me' : 'them',
    text: m.text,
    time: timeAgo(m.created_at),
    read: m.read,
  }));
  const lastMessage = messages[messages.length - 1];
  return {
    id: c.id,
    startupId: c.startup,
    startupSlug: c.startup_slug || '',
    startupName: c.startup_name || '',
    initiatorId: c.initiator,
    initiatorName: c.initiator_name || '',
    initiatorAvatar: mediaUrl(c.initiator_avatar),
    thread,
    unread: thread.filter((m) => m.from === 'them' && !m.read).length,
    time: lastMessage ? timeAgo(lastMessage.created_at) : timeAgo(c.created_at),
    lastAt: lastMessage ? lastMessage.created_at : c.created_at,
  };
}

function transformNotification(n) {
  return {
    id: n.id,
    icon: n.icon || 'bell',
    color: n.color || 'var(--text-muted)',
    text: n.text,
    link: n.link || '/feed',
    read: n.read,
    time: timeAgo(n.created_at),
  };
}

function transformComment(c) {
  return {
    id: c.id, authorId: c.author, name: c.author_name, avatar: mediaUrl(c.author_avatar),
    text: c.text, time: timeAgo(c.created_at),
  };
}

function transformComments(s) {
  return (s.comments || []).map(transformComment);
}

function transformPost(p) {
  return {
    id: p.id,
    startupId: p.startup || undefined,
    authorId: p.author || undefined,
    authorName: p.author_name || '',
    authorAvatar: mediaUrl(p.author_avatar),
    type: p.kind === 'event' ? 'event' : undefined,
    postType: p.post_type,
    postTitle: p.title,
    postText: p.text,
    tags: p.tags || [],
    media: mediaUrl(p.media),
    likesCount: p.likes_count || 0,
    isLiked: !!p.is_liked,
    pinned: !!p.pinned,
    timestamp: timeAgo(p.created_at),
  };
}

function transformApplication(a) {
  return {
    id: a.id, startupId: a.startup, type: 'collaboration',
    role: a.role, name: a.name, email: a.email, link: a.link, message: a.message,
    applicantId: a.applicant, time: timeAgo(a.created_at), status: a.status,
    decidedAt: a.decided_at,
  };
}

function transformInvestment(i) {
  return {
    id: i.id, startupId: i.startup, amount: i.amount,
    investorId: i.investor, time: timeAgo(i.created_at), status: i.status,
    note: i.decision_note || '',
  };
}

export function AppProvider({ children }) {
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(GUEST_USER);
  const [signedIn, setSignedIn] = useState(false);
  const [theme, setTheme] = useState(getInitialTheme);
  const [startups, setStartups] = useState({});
  const [posts, setPosts] = useState([]);
  // Feed pagination (FE-05): the last page loaded and whether the server has more.
  const [postsPage, setPostsPage] = useState(0);
  const [hasMorePosts, setHasMorePosts] = useState(true);
  const [postsLoading, setPostsLoading] = useState(false);
  const [comments, setComments] = useState({});
  const [applications, setApplications] = useState([]);
  const [investments, setInvestments] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [postModalOpen, setPostModalOpen] = useState(false);
  // Platform switches from /api/site/ (banner, sign-up and Google availability).
  const [site, setSite] = useState({ registration_open: true, google_signin_enabled: true, site_banner: '' });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    document.documentElement.style.colorScheme = theme;
    window.localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  function toggleTheme() {
    setTheme((cur) => (cur === 'dark' ? 'light' : 'dark'));
  }

  async function loadFeedPage(page) {
    const data = await api.get('/posts/', { page });
    return { items: (data.results || []).map(transformPost), more: Boolean(data.next) };
  }

  // Reload the first feed page, e.g. after sign-in so "liked" states are this user's (FE-06).
  async function refreshFeed() {
    const { items, more } = await loadFeedPage(1).catch(() => ({ items: [], more: false }));
    setPosts(items);
    setPostsPage(1);
    setHasMorePosts(more);
  }

  async function loadMorePosts() {
    if (postsLoading || !hasMorePosts) return;
    setPostsLoading(true);
    try {
      const { items, more } = await loadFeedPage(postsPage + 1);
      setPosts((cur) => {
        const seen = new Set(cur.map((p) => p.id));
        return [...cur, ...items.filter((p) => !seen.has(p.id))];
      });
      setPostsPage((n) => n + 1);
      setHasMorePosts(more);
    } catch {
      setHasMorePosts(false);
    } finally {
      setPostsLoading(false);
    }
  }

  async function loadInbox(userId) {
    const [conversationList, notificationList] = await Promise.all([
      api.get('/conversations/').catch(() => []),
      api.get('/notifications/').catch(() => []),
    ]);
    setConversations(
      conversationList
        .map((c) => transformConversation(c, userId))
        .sort((a, b) => new Date(b.lastAt).getTime() - new Date(a.lastAt).getTime()),
    );
    setNotifications(notificationList.map(transformNotification));
  }

  useEffect(() => {
    let cancelled = false;

    async function init() {
      let me = null;
      if (getAuthToken()) {
        try {
          me = await api.get('/auth/me/');
        } catch {
          setAuthToken(null);
        }
      } else {
        me = await api.get('/auth/me/').catch(() => null);
      }
      const [startupList, firstPage, siteSettings] = await Promise.all([
        api.get('/startups/'),
        loadFeedPage(1).catch(() => ({ items: [], more: false })),
        api.get('/site/').catch(() => null),
      ]);
      if (cancelled) return;
      if (siteSettings) setSite(siteSettings);

      const nextStartups = {};
      const nextComments = {};
      startupList.forEach((s) => {
        nextStartups[s.slug] = transformStartup(s);
        nextComments[s.slug] = transformComments(s);
      });
      setStartups(nextStartups);
      setComments(nextComments);
      setPosts(firstPage.items);
      setPostsPage(1);
      setHasMorePosts(firstPage.more);

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
        await loadInbox(me.id);
      }

      setLoading(false);
    }

    init();
    return () => { cancelled = true; };
  }, []);

  // Shared by every way of signing in: load the user's private data.
  async function startSession(user) {
    if (user.token) setAuthToken(user.token);
    setCurrentUser(transformUser(user));
    setSignedIn(true);
    const [appList, investList] = await Promise.all([
      api.get('/applications/').catch(() => []),
      api.get('/investments/').catch(() => []),
    ]);
    setApplications(appList.map(transformApplication));
    setInvestments(investList.map(transformInvestment));
    await Promise.all([loadInbox(user.id), refreshFeed(), refreshStartups()]);
    return user;
  }

  // Reload startups for whoever is signed in: owners also see their own unapproved ones.
  async function refreshStartups() {
    const list = await api.get('/startups/').catch(() => null);
    if (!list) return;
    const nextStartups = {};
    const nextComments = {};
    list.forEach((st) => {
      nextStartups[st.slug] = transformStartup(st);
      nextComments[st.slug] = transformComments(st);
    });
    setStartups(nextStartups);
    setComments(nextComments);
  }

  async function login(email, password) {
    const user = await api.post('/auth/login/', { email, password });
    return startSession(user);
  }

  // Exchanges a Google ID token for a session. An existing account with the
  // same email is linked automatically by the backend.
  async function googleSignIn(credential) {
    const user = await api.post('/auth/google/', { credential });
    await startSession(user);
    return { user, created: Boolean(user.created) };
  }

  async function registerUser({ name, email, password }) {
    const cleanName = name.trim() || 'New Founder';
    const [first, ...rest] = cleanName.split(' ');
    const user = await api.post('/auth/register/', {
      first_name: first, last_name: rest.join(' '), email: email.trim(), password,
    });
    setAuthToken(user.token);
    setCurrentUser(transformUser(user));
    setSignedIn(true);
    setApplications([]);
    setInvestments([]);
    setConversations([]);
    setNotifications([]);
    await refreshFeed();
    return user;
  }

  async function logOut() {
    await api.post('/auth/logout/').catch(() => {});
    setAuthToken(null);
    setCurrentUser(GUEST_USER);
    setSignedIn(false);
    setApplications([]);
    setInvestments([]);
    setConversations([]);
    setNotifications([]);
    await Promise.all([refreshFeed(), refreshStartups()]);
  }

  // Keep messages and notifications in sync while signed in (FE-04 / FE-08):
  // poll every 30s and whenever the tab regains focus.
  useEffect(() => {
    if (!signedIn || !currentUser.id) return undefined;
    const userId = currentUser.id;
    const sync = () => { if (!document.hidden) loadInbox(userId).catch(() => {}); };
    const timer = window.setInterval(sync, 30000);
    window.addEventListener('focus', sync);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', sync);
    };
  }, [signedIn, currentUser.id]);

  async function changePassword(currentPassword, newPassword) {
    await api.post('/auth/password/', { current_password: currentPassword, new_password: newPassword });
    setCurrentUser((cur) => ({ ...cur, hasPassword: true }));
  }

  // Signed-in user connects their Google account (the backend links it to this account).
  async function connectGoogle(credential) {
    const user = await api.post('/auth/google/', { credential });
    setCurrentUser(transformUser(user));
  }

  async function updateCurrentUser(patch) {
    if (patch instanceof FormData) {
      const updated = await api.patch('/auth/me/', patch, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setCurrentUser(transformUser(updated));
      return;
    }

    const body = {};
    if (patch.name !== undefined) {
      const [first, ...rest] = patch.name.trim().split(' ');
      body.first_name = first || '';
      body.last_name = rest.join(' ');
    }
    if (patch.bio !== undefined) body.bio = patch.bio;
    if (patch.location !== undefined) body.location = patch.location;
    if (patch.headline !== undefined) body.headline = patch.headline;
    if (patch.skills !== undefined) body.skills = patch.skills;
    if (patch.experience_level !== undefined) body.experience_level = patch.experience_level;
    if (patch.portfolio_link !== undefined) body.portfolio_link = patch.portfolio_link;
    if (patch.investor_type !== undefined) body.investor_type = patch.investor_type;
    if (patch.investment_budget !== undefined) body.investment_budget = patch.investment_budget;
    if (patch.investment_interests !== undefined) body.investment_interests = patch.investment_interests;

    const updated = await api.patch('/auth/me/', body);
    setCurrentUser(transformUser(updated));
  }

  async function toggleSaved(id) {
    if (!signedIn) throw new Error('Sign in to save startups.');
    const isSaved = currentUser.saved_startups.includes(id);
    await api.post(`/startups/${id}/${isSaved ? 'unsave' : 'save'}/`);
    setCurrentUser((cur) => ({
      ...cur,
      saved_startups: isSaved ? cur.saved_startups.filter((x) => x !== id) : [...cur.saved_startups, id],
    }));
  }

  async function toggleFollow(id) {
    if (!signedIn) throw new Error('Sign in to follow startups.');
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
    let body;
    if (post.media instanceof File) {
      body = new FormData();
      body.append('startup', post.startupId);
      body.append('post_type', post.postType);
      body.append('title', post.postTitle);
      body.append('text', post.postText);
      (post.tags || []).forEach(t => body.append('tags', t));
      body.append('media', post.media);
    } else {
      body = {
        startup: post.startupId, post_type: post.postType, title: post.postTitle,
        text: post.postText, tags: post.tags || []
      };
    }
    const created = await api.post('/posts/', body);
    setPosts((cur) => [transformPost(created), ...cur]);
  }

  async function toggleLikePost(postId) {
    if (!signedIn) throw new Error('Sign in to like posts.');
    const data = await api.post(`/posts/${postId}/toggle_like/`);
    setPosts(cur => cur.map(p => p.id === postId ? { ...p, isLiked: data.is_liked, likesCount: data.likes_count } : p));
  }

  async function deletePost(postId) {
    await api.delete(`/posts/${postId}/`);
    setPosts(cur => cur.filter(p => p.id !== postId));
  }

  async function pinPost(postId, isPinned) {
    const data = await api.patch(`/posts/${postId}/`, { pinned: !isPinned });
    setPosts(cur => cur.map(p => p.id === postId ? { ...p, pinned: data.pinned } : p));
  }

  async function editPost(postId, updates) {
    const payload = {
      post_type: updates.postType,
      title: updates.postTitle,
      text: updates.postText,
      tags: updates.tags
    };
    if (updates.startupId) payload.startup = updates.startupId;

    const data = await api.patch(`/posts/${postId}/`, payload);
    setPosts(cur => cur.map(p => p.id === postId ? {
      ...p,
      startupId: data.startup,
      postType: data.post_type,
      postTitle: data.title,
      postText: data.text,
      tags: data.tags
    } : p));
  }

  async function addComment(startupId, text) {
    const created = await api.post('/comments/', { startup: startupId, text });
    setComments((cur) => ({
      ...cur,
      [startupId]: [...(cur[startupId] || []), transformComment(created)],
    }));
  }

  async function editComment(startupId, commentId, text) {
    const updated = await api.patch(`/comments/${commentId}/`, { text });
    setComments((cur) => ({
      ...cur,
      [startupId]: (cur[startupId] || []).map((c) => (c.id === commentId ? transformComment(updated) : c)),
    }));
  }

  async function deleteComment(startupId, commentId) {
    await api.delete(`/comments/${commentId}/`);
    setComments((cur) => ({ ...cur, [startupId]: (cur[startupId] || []).filter((c) => c.id !== commentId) }));
  }

  async function addApplication(app) {
    const created = await api.post('/applications/', {
      startup: app.startupId, role: app.role, name: app.name, email: app.email, link: app.link, message: app.message,
    });
    setApplications((cur) => [transformApplication(created), ...cur]);
  }

  // Founder decision on an application: status is 'accepted' or 'declined'.
  async function setApplicationStatus(id, status) {
    const action = status === 'accepted' ? 'accept' : 'decline';
    const updated = await api.post(`/applications/${id}/${action}/`);
    setApplications((cur) => cur.map((a) => (a.id === id ? transformApplication(updated) : a)));
  }

  async function withdrawApplication(id) {
    const updated = await api.post(`/applications/${id}/withdraw/`);
    setApplications((cur) => cur.map((a) => (a.id === id ? transformApplication(updated) : a)));
  }

  async function addInvestment(startupId, amount) {
    const created = await api.post('/investments/', { startup: startupId, amount });
    setInvestments((cur) => [transformInvestment(created), ...cur]);
  }

  // Investor withdraws a pending request. The record is kept (status "withdrawn").
  async function cancelInvestment(id) {
    const updated = await api.post(`/investments/${id}/withdraw/`);
    setInvestments((cur) => cur.map((i) => (i.id === id ? transformInvestment(updated) : i)));
  }

  async function refreshStartup(slug) {
    const s = await api.get(`/startups/${slug}/`);
    setStartups((cur) => ({ ...cur, [s.slug]: transformStartup(s) }));
  }

  // Founder decision on an investment: status is 'accepted' or 'rejected'.
  async function setInvestmentStatus(id, status, note = '') {
    const action = status === 'accepted' ? 'accept' : 'reject';
    const updated = await api.post(`/investments/${id}/${action}/`, { note });
    setInvestments((cur) => cur.map((i) => (i.id === id ? transformInvestment(updated) : i)));
    // Accepting changes the startup's raised amount (and maybe its status).
    if (status === 'accepted') await refreshStartup(updated.startup);
  }

  // Goal, round status and deadline label. `raised` is computed by the server.
  async function updateFunding(slug, { goal, status, deadline }) {
    const s = await api.patch(`/startups/${slug}/`, { goal: Number(goal) || 0, status, deadline });
    setStartups((cur) => ({ ...cur, [s.slug]: transformStartup(s) }));
  }

  async function updateStartup(slug, { name, tagline, tags, overview }) {
    const s = await api.patch(`/startups/${slug}/`, { name, tagline, tags, overview });
    setStartups((cur) => ({ ...cur, [s.slug]: transformStartup(s) }));
  }

  async function deleteStartup(slug) {
    await api.delete(`/startups/${slug}/`);
    setStartups((cur) => {
      const next = { ...cur };
      delete next[slug];
      return next;
    });
    setPosts((cur) => cur.filter((p) => p.startupId !== slug));
  }

  async function uploadDocument(slug, file, name) {
    const body = new FormData();
    body.append('file', file);
    if (name) body.append('name', name);
    await api.post(`/startups/${slug}/documents/`, body);
    await refreshStartup(slug);
  }

  async function removeDocument(slug, docId) {
    await api.delete(`/startups/${slug}/documents/${docId}/`);
    setStartups((cur) => ({ ...cur, [slug]: { ...cur[slug], docs: cur[slug].docs.filter((d) => d.id !== docId) } }));
  }

  async function saveCollaboration(slug, { role, body, isOpen }) {
    const collab = await api.put(`/startups/${slug}/collaboration/`, { role, body, is_open: isOpen });
    setStartups((cur) => ({
      ...cur,
      [slug]: { ...cur[slug], collab: { role: collab.role, body: collab.body, isOpen: collab.is_open } },
    }));
  }

  async function startConversation(startupSlug) {
    // Check if we already have a conversation with this startup
    const existing = conversations.find(c => c.startupSlug === startupSlug);
    if (existing) {
      return existing.id;
    }
    // Create new conversation
    const created = await api.post('/conversations/', { startup: startupSlug });
    const transformed = transformConversation(created, currentUser.id);
    setConversations(cur => [transformed, ...cur].sort((a, b) => new Date(b.lastAt).getTime() - new Date(a.lastAt).getTime()));
    return transformed.id;
  }

  async function sendMessage(conversationId, text) {
    const created = await api.post('/messages/', { conversation: conversationId, text });
    setConversations((cur) => cur.map((conversation) => {
      if (conversation.id !== conversationId) return conversation;
      const nextThread = [...conversation.thread, {
        id: created.id,
        from: 'me',
        text: created.text,
        time: timeAgo(created.created_at),
        read: created.read,
      }];
      return {
        ...conversation,
        thread: nextThread,
        unread: nextThread.filter((m) => m.from === 'them' && !m.read).length,
        time: timeAgo(created.created_at),
        lastAt: created.created_at,
      };
    }).sort((a, b) => new Date(b.lastAt).getTime() - new Date(a.lastAt).getTime()));
  }

  async function markConversationRead(conversationId) {
    const conversation = conversations.find((c) => c.id === conversationId);
    if (!conversation) return;
    const unreadCount = conversation.unread ?? conversation.thread.filter((m) => m.from === 'them' && !m.read).length;
    if (unreadCount === 0) return;
    await api.post(`/conversations/${conversationId}/read/`);
    setConversations((cur) => cur.map((c) => {
      if (c.id !== conversationId) return c;
      return {
        ...c,
        unread: 0,
        thread: c.thread.map((message) => (message.from === 'them' ? { ...message, read: true } : message)),
      };
    }));
  }

  async function markNotificationRead(notificationId) {
    await api.patch(`/notifications/${notificationId}/`, { read: true });
    setNotifications((cur) => cur.map((notification) => (
      notification.id === notificationId ? { ...notification, read: true } : notification
    )));
  }

  async function markAllNotificationsRead() {
    if (!notifications.some((n) => !n.read)) return;
    await api.post('/notifications/read_all/');
    setNotifications((cur) => cur.map((notification) => ({ ...notification, read: true })));
  }

  function openCreatePost() {
    setPostModalOpen(true);
  }

  function closeCreatePost() {
    setPostModalOpen(false);
  }

  const saved = useMemo(() => new Set(currentUser.saved_startups), [currentUser.saved_startups]);
  const followed = useMemo(() => new Set(currentUser.followed_startups), [currentUser.followed_startups]);

  const unreadMessageCount = useMemo(
    () => conversations.reduce((sum, c) => sum + c.unread, 0),
    [conversations],
  );
  const unreadNotificationCount = useMemo(
    () => notifications.filter((n) => !n.read).length,
    [notifications],
  );

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
        currentUser, updateCurrentUser, registerUser, login, googleSignIn, logOut, signedIn, setSignedIn,
        changePassword, connectGoogle,
        theme, setTheme, toggleTheme, site,
        startups, createStartup, updateStartup, deleteStartup, uploadDocument, removeDocument,
        myStartups, collaboratingIds,
        saved, toggleSaved,
        followed, toggleFollow,
        posts, addPost, toggleLikePost, deletePost, pinPost, editPost,
        loadMorePosts, hasMorePosts, postsLoading,
        comments, addComment, editComment, deleteComment,
        applications, addApplication, setApplicationStatus, withdrawApplication,
        investments, addInvestment, cancelInvestment, setInvestmentStatus,
        updateFunding, saveCollaboration,
        conversations, startConversation, sendMessage, markConversationRead, unreadMessageCount,
        notifications, markNotificationRead, markAllNotificationsRead, unreadNotificationCount,
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
