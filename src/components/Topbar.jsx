import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon } from './IconSprite';
import { useApp } from '../context/AppContext';
import Avatar from './Avatar';

export default function Topbar() {
  const [open, setOpen] = useState(null); // 'notif' | 'menu' | null
  const navigate = useNavigate();
  const {
    currentUser, logOut, theme, toggleTheme, signedIn, notifications, unreadNotificationCount, markNotificationRead,
  } = useApp();
  const latest = notifications.slice(0, 5);

  async function openNotification(n) {
    setOpen(null);
    if (!n.read) markNotificationRead(n.id).catch(() => {});
    navigate(n.link || '/notifications');
  }

  function toggle(key) {
    setOpen((cur) => (cur === key ? null : key));
  }

  async function handleLogOut() {
    setOpen(null);
    await logOut();
    navigate('/');
  }

  return (
    <div className="topbar" onClick={(e) => { if (!e.target.closest('.dropdown') && !e.target.closest('[data-dropdown]')) setOpen(null); }}>
      <div className="wordmark" onClick={() => navigate('/feed')}><span className="mark">F&amp;F</span></div>
      <form
        className="search-wrap"
        onSubmit={(e) => {
          e.preventDefault();
          const q = e.target.elements.q.value.trim();
          navigate(q ? `/explore?q=${encodeURIComponent(q)}` : '/explore');
        }}
      >
        <Icon name="search" />
        <input name="q" type="text" placeholder="Search startups, founders, industries..." />
      </form>
      <div className="topbar-actions">
        <button
          className="icon-btn theme-toggle"
          type="button"
          aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          onClick={toggleTheme}
          title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
        >
          <span aria-hidden="true">{theme === 'dark' ? '☀' : '☾'}</span>
        </button>
        <div style={{ position: 'relative' }}>
          <button
            className="icon-btn"
            data-dropdown="notif"
            aria-label={unreadNotificationCount ? `Notifications, ${unreadNotificationCount} unread` : 'Notifications'}
            onClick={() => toggle('notif')}
          >
            <Icon name="bell" />{unreadNotificationCount > 0 && <span className="dot" />}
          </button>
          {open === 'notif' && (
            <div className="dropdown" data-panel="notif">
              <h4>Notifications</h4>
              {!signedIn ? (
                <p className="notif-empty">Sign in to see your notifications.</p>
              ) : latest.length === 0 ? (
                <p className="notif-empty">You&rsquo;re all caught up.</p>
              ) : latest.map((n) => (
                <button
                  type="button"
                  key={n.id}
                  className="notif-item"
                  style={{ width: '100%', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', opacity: n.read ? 0.65 : 1 }}
                  onClick={() => openNotification(n)}
                >
                  <span className="n-dot" style={{ background: n.read ? 'var(--border)' : n.color }} />
                  <div><p>{n.text}</p><time>{n.time}</time></div>
                </button>
              ))}
              <button className="menu-item" style={{ justifyContent: 'center', color: 'var(--accent)', fontWeight: 700 }} onClick={() => { setOpen(null); navigate('/notifications'); }}>
                View all notifications
              </button>
            </div>
          )}
        </div>
        <Avatar
          src={currentUser.avatar}
          name={currentUser.name}
          initials={currentUser.initials}
          title="Your account"
          onClick={() => navigate('/account')}
        />
        <div style={{ position: 'relative' }}>
          <button className="icon-btn" data-dropdown="menu" aria-label="Account menu" onClick={() => toggle('menu')}>
            <Icon name="chev" />
          </button>
          {open === 'menu' && (
            <div className="dropdown" data-panel="menu">
              <button className="menu-item" onClick={() => { setOpen(null); navigate('/account'); }}><Icon name="user" />Your profile</button>
              <button className="menu-item" onClick={() => { setOpen(null); navigate('/settings'); }}><Icon name="gear" />Settings</button>
              {currentUser.role && currentUser.role !== 'user' && (
                <button className="menu-item" onClick={() => { setOpen(null); navigate('/admin'); }}><Icon name="chart" />Admin panel</button>
              )}
              <button className="menu-item" onClick={handleLogOut}><Icon name="back" />Log out</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
