import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Topbar from '../components/Topbar';
import LeftNav from '../components/LeftNav';
import LogoBadge from '../components/LogoBadge';
import { Icon } from '../components/IconSprite';
import { useApp } from '../context/AppContext';
import { api } from '../api/client';
import { timeAgo } from '../utils/timeAgo';
import { initialsOf } from '../data/startups';
import Avatar from '../components/Avatar';
import '../styles/messages.css';

export default function Messages() {
  const { currentUser, signedIn, startups, myStartups } = useApp();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedStartup = searchParams.get('startup');
  const requestedId = searchParams.get('id');
  const [conversations, setConversations] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [mobileThreadOpen, setMobileThreadOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [startupChoice, setStartupChoice] = useState('');
  const [inboxFilter, setInboxFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    const items = await api.get('/conversations/');
    setConversations(items);
    setActiveId((previous) => items.some((c) => c.id === previous)
      ? previous
      : (window.matchMedia('(max-width: 780px)').matches ? null : (items[0]?.id ?? null)));
    setLoading(false);
    setError('');
  }, []);

  useEffect(() => {
    if (!signedIn) {
      setLoading(false);
      return;
    }
    let stopped = false;
    let inFlight = false;
    async function poll() {
      if (stopped || inFlight) return;
      inFlight = true;
      try {
        await refresh();
      } catch {
        if (!stopped) {
          setLoading(false);
          setError('Could not load messages. Check that the backend is running.');
        }
      } finally {
        inFlight = false;
      }
    }
    poll();
    const timer = window.setInterval(poll, 3000);
    return () => { stopped = true; window.clearInterval(timer); };
  }, [signedIn, refresh]);

  useEffect(() => {
    if (!signedIn || !requestedStartup) return;
    let cancelled = false;
    api.post('/conversations/', { startup: requestedStartup }).then((conversation) => {
      if (cancelled) return;
      setConversations((items) => [conversation, ...items.filter((c) => c.id !== conversation.id)]);
      setActiveId(conversation.id);
      setMobileThreadOpen(true);
      setSearchParams({}, { replace: true });
    }).catch((err) => {
      if (!cancelled) {
        setError(err.data?.startup?.[0] || err.data?.detail || 'Could not start the conversation.');
        setSearchParams({}, { replace: true });
      }
    });
    return () => { cancelled = true; };
  }, [requestedStartup, signedIn, setSearchParams]);

  useEffect(() => {
    if (!signedIn || !requestedId) return;
    const match = conversations.find((c) => String(c.id) === requestedId);
    if (match) {
      setInboxFilter('all');
      setActiveId(match.id);
      setMobileThreadOpen(true);
      setSearchParams({}, { replace: true });
    }
  }, [requestedId, conversations, signedIn, setSearchParams]);

  const ordered = useMemo(() => [...conversations].sort((a, b) => {
    const aLast = a.messages.at(-1)?.created_at || a.created_at;
    const bLast = b.messages.at(-1)?.created_at || b.created_at;
    return new Date(bLast) - new Date(aLast);
  }), [conversations]);

  const visibleConversations = useMemo(() => ordered.filter((c) => (
    inboxFilter === 'all'
      || (inboxFilter === 'personal' ? c.initiator === currentUser.id : (c.startup === inboxFilter || c.startup_slug === inboxFilter))
  )), [ordered, inboxFilter, currentUser.id]);

  const active = visibleConversations.find((c) => c.id === activeId);
  const otherName = active && (active.initiator === currentUser.id ? active.owner_name : active.initiator_name);
  const availableStartups = Object.entries(startups).filter(([, s]) => s.ownerId !== currentUser.id);

  useEffect(() => {
    if (visibleConversations.some((c) => c.id === activeId)) return;
    setActiveId(window.matchMedia('(max-width: 780px)').matches ? null : (visibleConversations[0]?.id ?? null));
  }, [visibleConversations, activeId]);

  useEffect(() => {
    if (!active || (window.matchMedia('(max-width: 780px)').matches && !mobileThreadOpen)
      || !active.messages.some((m) => m.sender !== currentUser.id && !m.read)) return;
    const id = active.id;
    api.post(`/conversations/${id}/read/`).then(() => {
      setConversations((items) => items.map((c) => c.id === id ? {
        ...c,
        messages: c.messages.map((m) => m.sender !== currentUser.id ? { ...m, read: true } : m),
      } : c));
    }).catch(() => {});
  }, [active, currentUser.id, mobileThreadOpen]);

  function selectConversation(id) {
    setActiveId(id);
    setMobileThreadOpen(true);
    setDraft('');
    api.post(`/conversations/${id}/read/`).then(() => {
      setConversations((items) => items.map((c) => c.id === id ? {
        ...c,
        messages: c.messages.map((m) => m.sender !== currentUser.id ? { ...m, read: true } : m),
      } : c));
    }).catch(() => {});
  }

  async function startConversation(e) {
    e.preventDefault();
    if (!startupChoice || busy) return;
    setBusy(true);
    setError('');
    try {
      const conversation = await api.post('/conversations/', { startup: startupChoice });
      setConversations((items) => [conversation, ...items.filter((c) => c.id !== conversation.id)]);
      setActiveId(conversation.id);
      setStartupChoice('');
      setMobileThreadOpen(true);
    } catch (err) {
      setError(err.data?.startup?.[0] || err.data?.detail || 'Could not start the conversation.');
    } finally {
      setBusy(false);
    }
  }

  async function sendMessage(e) {
    e.preventDefault();
    const text = draft.trim();
    if (!text || !activeId || busy) return;
    const conversationId = activeId;
    setBusy(true);
    setError('');
    try {
      const message = await api.post('/messages/', { conversation: conversationId, text });
      setConversations((items) => items.map((c) => c.id === conversationId ? {
        ...c, messages: [...c.messages, message],
      } : c));
      setDraft('');
    } catch (err) {
      setError(err.data?.conversation?.[0] || err.data?.text?.[0] || err.data?.detail || 'Could not send the message.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <Topbar />
      <div className="layout layout-2col">
        <LeftNav />
        <main className="center-col messages-page">
          <div className={`messages-shell${mobileThreadOpen ? ' show-thread' : ''}`}>
            <aside className="conv-list">
              <div className="conv-list-head">
                <h3>Messages</h3>
                {signedIn && (
                  <select className="inbox-filter input" style={{ padding: '6px 10px', fontSize: '13px' }} aria-label="Filter conversations" value={inboxFilter} onChange={(e) => { setInboxFilter(e.target.value); setActiveId(null); }}>
                    <option value="all">All Messages</option>
                    <option value="personal">Personal Inbox</option>
                    {myStartups.map(([slug, s]) => <option key={slug} value={slug}>{s.name} Inbox</option>)}
                  </select>
                )}
                {signedIn && (
                  <form className="new-conversation" onSubmit={startConversation}>
                    <select aria-label="Choose a startup to message" value={startupChoice} onChange={(e) => setStartupChoice(e.target.value)}>
                      <option value="">Message a founder…</option>
                      {availableStartups.map(([slug, s]) => <option key={slug} value={slug}>{s.founder} · {s.name}</option>)}
                    </select>
                    <button className="btn btn-accent btn-sm" type="submit" disabled={!startupChoice || busy}>Start</button>
                  </form>
                )}
              </div>
              {error && <p className="messages-error" role="alert">{error}</p>}
              {!signedIn && <p className="messages-empty">Log in to see your conversations. <button onClick={() => navigate('/login')}>Log in</button></p>}
              {signedIn && loading && <p className="messages-empty">Loading conversations…</p>}
              {signedIn && !loading && visibleConversations.length === 0 && <p className="messages-empty">No conversations here yet. Choose a founder above or open a startup profile to start one.</p>}
              {visibleConversations.map((c) => {
                const last = c.messages.at(-1);
                const isOwner = c.initiator !== currentUser.id;
                const name = c.initiator === currentUser.id ? c.owner_name : c.initiator_name;
                const unread = c.messages.filter((m) => m.sender !== currentUser.id && !m.read).length;
                return (
                  <button key={c.id} className={`conv-row${c.id === activeId ? ' active' : ''}`} onClick={() => selectConversation(c.id)}>
                    {isOwner
                      ? <Avatar src={c.initiator_avatar} name={c.initiator_name} initials={initialsOf(c.initiator_name)} size={40} />
                      : <LogoBadge id={c.startup_slug || c.startup} initials={c.startup_initials || '?'} size={40} />}
                    <div className="conv-row-body">
                      <div className="conv-row-top"><span className="conv-name">{name}</span><span className="conv-time mono">{timeAgo(last?.created_at || c.created_at)}</span></div>
                      {isOwner && <span className="conv-startup">for {c.startup_name}</span>}
                      <div className="conv-row-bottom">
                        <span className="conv-preview">{last ? `${last.sender === currentUser.id ? 'You: ' : ''}${last.text}` : c.startup_name}</span>
                        {unread > 0 && <span className="conv-unread">{unread}</span>}
                      </div>
                    </div>
                  </button>
                );
              })}
            </aside>

            <section className="thread-panel">
              {error && <p className="messages-error" role="alert">{error}</p>}
              {active ? (
                <>
                  <div className="thread-head">
                    <button className="thread-back" onClick={() => setMobileThreadOpen(false)} aria-label="Back to conversations"><Icon name="back" /></button>
                    {active.initiator !== currentUser.id
                      ? <Avatar src={active.initiator_avatar} name={active.initiator_name} initials={initialsOf(active.initiator_name)} size={38} />
                      : <LogoBadge id={active.startup_slug || active.startup} initials={active.startup_initials || '?'} size={38} />}
                    <div>
                      <b>{otherName}</b>
                      <span>{active.initiator !== currentUser.id ? `Inquiry for ${active.startup_name}` : active.startup_name}</span>
                    </div>
                  </div>
                  <div className="thread-body">
                    {active.messages.length === 0 && <p className="messages-empty">Say hello to start the conversation.</p>}
                    {active.messages.map((m) => (
                      <div key={m.id} className={`bubble-row ${m.sender === currentUser.id ? 'me' : 'them'}`}>
                        <div className="bubble">{m.text}<time>{new Date(m.created_at).toLocaleString()}</time></div>
                      </div>
                    ))}
                  </div>
                  <form className="thread-compose" onSubmit={sendMessage}>
                    <input type="text" aria-label="Message text" placeholder={`Message ${otherName}...`} value={draft} onChange={(e) => setDraft(e.target.value)} />
                    <button className="btn btn-accent btn-sm" type="submit" disabled={busy || !draft.trim()}>Send</button>
                  </form>
                </>
              ) : <p className="messages-empty">Select a conversation to read messages.</p>}
            </section>
          </div>
        </main>
      </div>
    </div>
  );
}
