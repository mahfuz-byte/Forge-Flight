import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Topbar from '../components/Topbar';
import LeftNav from '../components/LeftNav';
import LogoBadge from '../components/LogoBadge';
import { Icon } from '../components/IconSprite';
import { useApp } from '../context/AppContext';
import '../styles/messages.css';

export default function Messages() {
  const navigate = useNavigate();
  const { startups, conversations, sendMessage: sendConversationMessage, markConversationRead } = useApp();
  const [activeId, setActiveId] = useState(null);
  const [mobileThreadOpen, setMobileThreadOpen] = useState(false);
  const [draft, setDraft] = useState('');

  useEffect(() => {
    if (conversations.length === 0) {
      setActiveId(null);
      return;
    }
    if (!activeId || !conversations.some((conversation) => conversation.id === activeId)) {
      setActiveId(conversations[0].id);
    }
  }, [conversations, activeId]);

  const active = conversations.find((conversation) => conversation.id === activeId) || null;
  const activeStartup = active ? startups[active.startupSlug] : null;

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
              <div className="conv-list-head"><h3>Messages</h3></div>
              {conversations.length === 0 ? (
                <div className="settings-card" style={{ margin: 0 }}>
                  <p className="settings-hint" style={{ marginBottom: 12 }}>No conversations yet. Start one from a startup profile.</p>
                  <button className="btn btn-accent btn-sm" onClick={() => navigate('/explore')}>Explore startups</button>
                </div>
              ) : conversations.map((conversation) => {
                const s = startups[conversation.startupSlug];
                const last = conversation.thread[conversation.thread.length - 1];
                return (
                  <button
                    key={conversation.id}
                    className={`conv-row${conversation.id === activeId ? ' active' : ''}`}
                    onClick={() => selectConversation(conversation.id)}
                  >
                    <LogoBadge id={conversation.startupSlug} initials={s?.initials || '?'} size={40} />
                    <div className="conv-row-body">
                      <div className="conv-row-top">
                        <span className="conv-name">{s?.name || conversation.startupName}</span>
                        <span className="conv-time mono">{conversation.time}</span>
                      </div>
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
                    <LogoBadge id={active.startupSlug} initials={activeStartup?.initials || '?'} size={38} />
                    <div>
                      <b>{activeStartup?.founder || active.startupName}</b>
                      <span>{activeStartup?.name || active.startupName}</span>
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
