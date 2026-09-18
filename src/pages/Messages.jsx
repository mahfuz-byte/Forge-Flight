import { useEffect, useState, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Topbar from '../components/Topbar';
import LeftNav from '../components/LeftNav';
import LogoBadge from '../components/LogoBadge';
import { Icon } from '../components/IconSprite';
import { useApp } from '../context/AppContext';
import { initialsOf } from '../data/startups';
import '../styles/messages.css';

export default function Messages() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { currentUser, startups, myStartups, conversations, sendMessage: sendConversationMessage, markConversationRead } = useApp();
  const [activeId, setActiveId] = useState(null);
  const [mobileThreadOpen, setMobileThreadOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [inboxFilter, setInboxFilter] = useState('all');

  const visibleConversations = useMemo(() => {
    return conversations.filter(c => {
      if (inboxFilter === 'all') return true;
      if (inboxFilter === 'personal') return c.initiatorId === currentUser.id;
      return c.startupSlug === inboxFilter;
    });
  }, [conversations, inboxFilter, currentUser.id]);

  useEffect(() => {
    if (visibleConversations.length === 0) {
      setActiveId(null);
      return;
    }
    const requestedId = searchParams.get('id');
    if (requestedId) {
      const match = visibleConversations.find((c) => String(c.id) === requestedId);
      if (match) {
        setActiveId(match.id);
        setSearchParams({}, { replace: true });
        return;
      }
    }
    if (!activeId || !visibleConversations.some((conversation) => conversation.id === activeId)) {
      setActiveId(visibleConversations[0].id);
    }
  }, [visibleConversations, activeId, searchParams, setSearchParams]);

  const active = visibleConversations.find((conversation) => conversation.id === activeId) || null;
  const activeStartup = active ? startups[active.startupSlug] : null;
  const activeIsOwner = activeStartup?.ownerId === currentUser.id;

  function selectConversation(id) {
    setActiveId(id);
    setMobileThreadOpen(true);
    markConversationRead(id);
  }

  async function sendMessage(e) {
    e.preventDefault();
    const text = draft.trim();
    if (!text || !active) return;
    await sendConversationMessage(active.id, text);
    setDraft('');
  }

  return (
    <div>
      <Topbar />
      <div className="layout layout-2col">
        <LeftNav />
        <main className="center-col messages-page">
          <div className={`messages-shell${mobileThreadOpen ? ' show-thread' : ''}`}>
            <aside className="conv-list">
              <div className="conv-list-head" style={{display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: '12px'}}>
                <h3 style={{margin: 0}}>Messages</h3>
                <select 
                  className="input" 
                  style={{ padding: '6px 10px', fontSize: '13px' }}
                  value={inboxFilter} 
                  onChange={(e) => {
                    setInboxFilter(e.target.value);
                    setActiveId(null);
                  }}
                >
                  <option value="all">All Messages</option>
                  <option value="personal">Personal Inbox</option>
                  {myStartups.map(([id, s]) => (
                    <option key={id} value={id}>{s.name} Inbox</option>
                  ))}
                </select>
              </div>
              {visibleConversations.length === 0 ? (
                <div className="settings-card" style={{ margin: 0 }}>
                  <p className="settings-hint" style={{ marginBottom: 12 }}>No conversations found for this filter.</p>
                  <button className="btn btn-accent btn-sm" onClick={() => navigate('/explore')}>Explore startups</button>
                </div>
              ) : visibleConversations.map((conversation) => {
                const s = startups[conversation.startupSlug];
                const isOwner = s?.ownerId === currentUser.id;
                const last = conversation.thread[conversation.thread.length - 1];
                return (
                  <button
                    key={conversation.id}
                    className={`conv-row${conversation.id === activeId ? ' active' : ''}`}
                    onClick={() => selectConversation(conversation.id)}
                  >
                    <LogoBadge id={isOwner ? conversation.initiatorId : conversation.startupSlug} initials={isOwner ? initialsOf(conversation.initiatorName) : (s?.initials || '?')} size={40} />
                    <div className="conv-row-body">
                      <div className="conv-row-top">
                        <span className="conv-name">{isOwner ? conversation.initiatorName : (s?.name || conversation.startupName)}</span>
                        <span className="conv-time mono">{conversation.time}</span>
                      </div>
                      {isOwner && <div style={{fontSize: '11px', color: 'var(--accent)', marginTop: '-2px', marginBottom: '4px', textAlign: 'left'}}>for {s?.name}</div>}
                      <div className="conv-row-bottom">
                        <span className="conv-preview">
                          {last?.from === 'me' ? 'You: ' : ''}
                          {last?.text || 'No messages yet'}
                        </span>
                        {conversation.unread > 0 && <span className="conv-unread">{conversation.unread}</span>}
                      </div>
                    </div>
                  </button>
                );
              })}
            </aside>

            <section className="thread-panel">
              {!active ? (
                <div className="settings-card" style={{ margin: 0 }}>
                  <h3 style={{ marginTop: 0 }}>No conversation selected</h3>
                  <p className="settings-hint">Choose a startup thread from the left.</p>
                </div>
              ) : (
                <>
                  <div className="thread-head">
                    <button className="thread-back" onClick={() => setMobileThreadOpen(false)} aria-label="Back to conversations"><Icon name="back" /></button>
                    <LogoBadge id={activeIsOwner ? active.initiatorId : active.startupSlug} initials={activeIsOwner ? initialsOf(active.initiatorName) : (activeStartup?.initials || '?')} size={38} />
                    <div>
                      <b>{activeIsOwner ? active.initiatorName : (activeStartup?.founder || active.startupName)}</b>
                      <span>{activeIsOwner ? `Inquiry for ${activeStartup?.name}` : (activeStartup?.name || active.startupName)}</span>
                    </div>
                  </div>
                  <div className="thread-body">
                    {active.thread.map((message) => (
                      <div key={message.id} className={`bubble-row ${message.from}`}>
                        <div className="bubble">
                          {message.text}
                          <time>{message.time}</time>
                        </div>
                      </div>
                    ))}
                  </div>
                  <form className="thread-compose" onSubmit={sendMessage}>
                    <input
                      type="text"
                      placeholder={`Message ${activeStartup?.founder || active.startupName}...`}
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                    />
                    <button className="btn btn-accent btn-sm" type="submit">Send</button>
                  </form>
                </>
              )}
            </section>
          </div>
        </main>
      </div>
    </div>
  );
}
