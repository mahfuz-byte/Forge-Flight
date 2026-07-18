import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon } from './IconSprite';
import { useApp } from '../context/AppContext';

export default function Topbar() {
  const [open, setOpen] = useState(null); // 'notif' | 'menu' | null
  const navigate = useNavigate();
  const { currentUser, logOut } = useApp();

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
        <div style={{ position: 'relative' }}>
          <button className="icon-btn" data-dropdown="notif" aria-label="Notifications" onClick={() => toggle('notif')}>
            <Icon name="bell" /><span className="dot" />
          </button>
          {open === 'notif' && (
            <div className="dropdown" data-panel="notif">
              <h4>Notifications</h4>
              <div className="notif-item"><span className="n-dot" /><div><p><b>MedAI</b> opened its seed funding round.</p><time>12m ago</time></div></div>
              <div className="notif-item"><span className="n-dot" /><div><p><b>Priya Nair</b> commented on your update.</p><time>1h ago</time></div></div>
              <div className="notif-item"><span className="n-dot" style={{ background: 'var(--info)' }} /><div><p>Reminder — <b>Pitch Day</b> starts in 2 days.</p><time>3h ago</time></div></div>
              <button className="menu-item" style={{ justifyContent: 'center', color: 'var(--accent)', fontWeight: 700 }} onClick={() => { setOpen(null); navigate('/notifications'); }}>
                View all notifications
              </button>
            </div>
          )}
        </div>
        <button className="avatar" onClick={() => navigate('/account')} title="Your account">{currentUser.initials}</button>
        <div style={{ position: 'relative' }}>
          <button className="icon-btn" data-dropdown="menu" aria-label="Account menu" onClick={() => toggle('menu')}>
            <Icon name="chev" />
          </button>
          {open === 'menu' && (
            <div className="dropdown" data-panel="menu">
              <button className="menu-item" onClick={() => { setOpen(null); navigate('/account'); }}><Icon name="user" />Your profile</button>
              <button className="menu-item" onClick={() => { setOpen(null); navigate('/portfolio'); }}><Icon name="chart" />My Portfolio</button>
              <button className="menu-item" onClick={() => { setOpen(null); navigate('/settings'); }}><Icon name="gear" />Settings</button>
              <button className="menu-item" onClick={handleLogOut}><Icon name="back" />Log out</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
