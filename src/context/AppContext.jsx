import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { api } from '../api/client';
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

function transformComments(s) {
  return (s.comments || []).map((c) => ({ id: c.id, name: c.author_name, text: c.text, time: timeAgo(c.created_at) }));
}

function transformPost(p) {
  return {
    id: p.id,
    startupId: p.startup || undefined,
    authorId: p.author || undefined,
    type: p.kind === 'event' ? 'event' : undefined,
    postType: p.post_type,
    postTitle: p.title,
    postText: p.text,
    tags: p.tags || [],
    media: p.media || null,
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
  const [theme, setTheme] = useState(getInitialTheme);
  const [startups, setStartups] = useState({});
  const [posts, setPosts] = useState([]);
  const [comments, setComments] = useState({});
  const [applications, setApplications] = useState([]);
  const [investments, setInvestments] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [postModalOpen, setPostModalOpen] = useState(false);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    document.documentElement.style.colorScheme = theme;
    window.localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  function toggleTheme() {
    setTheme((cur) => (cur === 'dark' ? 'light' : 'dark'));
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
        await loadInbox(me.id);
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
    await loadInbox(user.id);
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
    setConversations([]);
    setNotifications([]);
    return user;
  }

  async function logOut() {
    await api.post('/auth/logout/').catch(() => {});
    setCurrentUser(GUEST_USER);
    setSignedIn(false);
    setApplications([]);
    setInvestments([]);
    setConversations([]);
    setNotifications([]);
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

  async function editPost(postId, newText) {
    const data = await api.patch(`/posts/${postId}/`, { text: newText });
    setPosts(cur => cur.map(p => p.id === postId ? { ...p, postText: data.text } : p));
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
    const unreadMessages = conversation.thread.filter((m) => m.from === 'them' && !m.read);
    if (unreadMessages.length === 0) return;
    await Promise.all(unreadMessages.map((message) => api.patch(`/messages/${message.id}/`, { read: true })));
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
    const unreadIds = notifications.filter((n) => !n.read).map((n) => n.id);
    if (unreadIds.length === 0) return;
    await Promise.all(unreadIds.map((id) => api.patch(`/notifications/${id}/`, { read: true })));
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
        theme, setTheme, toggleTheme,
        startups, createStartup, myStartups, collaboratingIds,
        saved, toggleSaved,
        followed, toggleFollow,
        posts, addPost, toggleLikePost, deletePost, pinPost, editPost, loadMorePosts,
        comments, addComment,
        applications, addApplication, setApplicationStatus,
        investments, addInvestment, cancelInvestment, setInvestmentStatus,
        conversations, startConversation, sendMessage, markConversationRead,
        notifications, markNotificationRead, markAllNotificationsRead,
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
