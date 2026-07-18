import { useState } from 'react';
import Topbar from '../components/Topbar';
import LeftNav from '../components/LeftNav';
import LogoBadge from '../components/LogoBadge';
import { Icon } from '../components/IconSprite';
import { useApp } from '../context/AppContext';
import '../styles/messages.css';

const INITIAL = [
  {
    id: 'healthsync', unread: 2, time: '2m',
    thread: [
      { from: 'them', text: 'Thanks for reaching out about the seed round — happy to walk you through the clinical trial data.', time: '10:02 AM' },
      { from: 'me', text: 'Would love that. Do you have 20 minutes this week?', time: '10:05 AM' },
      { from: 'them', text: "Thursday afternoon works — I'll send a calendar link.", time: '10:07 AM' },
    ],
  },
  {
    id: 'medai', unread: 0, time: '1h',
    thread: [
      { from: 'them', text: 'Appreciate you looking at our regulatory filing summary.', time: 'Yesterday' },
      { from: 'me', text: "It's thorough — I'll get back to you by Friday.", time: 'Yesterday' },
    ],
  },
  {
    id: 'farmchain', unread: 0, time: '6h',
    thread: [
      { from: 'them', text: 'Thanks for applying to the Flutter Developer role — we’ll review this week.', time: 'Mon' },
    ],
  },
  {
    id: 'ecoride', unread: 0, time: '2d',
    thread: [
      { from: 'them', text: 'Great meeting you at Pitch Day, let’s stay in touch.', time: 'Last week' },
    ],
  },
  {
    id: 'nimbus', unread: 0, time: '4d',
    thread: [
      { from: 'them', text: 'We closed the round — thanks so much for your interest.', time: 'Last week' },
    ],
  },
];

export default function Messages() {
  const { startups } = useApp();
  const [conversations, setConversations] = useState(INITIAL);
  const [activeId, setActiveId] = useState(INITIAL[0].id);
  const [mobileThreadOpen, setMobileThreadOpen] = useState(false);
  const [draft, setDraft] = useState('');

  const active = conversations.find((c) => c.id === activeId);
  const activeStartup = startups[activeId];

  function selectConversation(id) {
    setActiveId(id);
    setMobileThreadOpen(true);
    setConversations((cs) => cs.map((c) => (c.id === id ? { ...c, unread: 0 } : c)));
  }

  function sendMessage(e) {
    e.preventDefault();
    const text = draft.trim();
    if (!text) return;
    setConversations((cs) => cs.map((c) => (
      c.id === activeId ? { ...c, thread: [...c.thread, { from: 'me', text, time: 'Just now' }] } : c
    )));
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
              {conversations.map((c) => {
                const s = startups[c.id];
                const last = c.thread[c.thread.length - 1];
                return (
                  <button
                    key={c.id}
                    className={`conv-row${c.id === activeId ? ' active' : ''}`}
                    onClick={() => selectConversation(c.id)}
                  >
                    <LogoBadge id={c.id} initials={s.initials} size={40} />
                    <div className="conv-row-body">
                      <div className="conv-row-top">
                        <span className="conv-name">{s.founder}</span>
                        <span className="conv-time mono">{c.time}</span>
                      </div>
                      <div className="conv-row-bottom">
                        <span className="conv-preview">{last.from === 'me' ? 'You: ' : ''}{last.text}</span>
                        {c.unread > 0 && <span className="conv-unread">{c.unread}</span>}
                      </div>
                    </div>
                  </button>
                );
              })}
            </aside>

            <section className="thread-panel">
              <div className="thread-head">
                <button className="thread-back" onClick={() => setMobileThreadOpen(false)} aria-label="Back to conversations"><Icon name="back" /></button>
                <LogoBadge id={activeId} initials={activeStartup.initials} size={38} />
                <div><b>{activeStartup.founder}</b><span>{activeStartup.name}</span></div>
              </div>
              <div className="thread-body">
                {active.thread.map((m, i) => (
                  <div key={i} className={`bubble-row ${m.from}`}>
                    <div className="bubble">{m.text}<time>{m.time}</time></div>
                  </div>
                ))}
              </div>
              <form className="thread-compose" onSubmit={sendMessage}>
                <input
                  type="text"
                  placeholder={`Message ${activeStartup.founder}...`}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                />
                <button className="btn btn-accent btn-sm" type="submit">Send</button>
              </form>
            </section>
          </div>
        </main>
      </div>
    </div>
  );
}
