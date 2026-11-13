import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Icon } from './IconSprite';
import { useApp } from '../context/AppContext';
import CreateStartupModal from './CreateStartupModal';

const ITEMS = [
  ['home', 'Home', '/feed'],
  ['compass', 'Explore Startups', '/explore'],
  ['chart', 'Statistics', '/statistics'],
  ['msg', 'Messages', '/messages'],
  ['bell', 'Notifications', '/notifications'],
];

export default function LeftNav() {
  const navigate = useNavigate();
  const location = useLocation();
  const { openCreatePost, signedIn, logOut, unreadMessageCount, unreadNotificationCount } = useApp();
  const badges = { '/messages': unreadMessageCount, '/notifications': unreadNotificationCount };
  const [createStartupOpen, setCreateStartupOpen] = useState(false);

  function isActive(href) {
    const [path, query] = href.split('?');
    if (location.pathname !== path) return false;
    return (location.search.slice(1) || '') === (query || '');
  }

  return (
    <>
      <nav className="side-left">
        {ITEMS.map(([icon, label, href]) => (
          <button
            key={href}
            className={`nav-item${isActive(href) ? ' active' : ''}`}
            onClick={() => navigate(href)}
          >
            <Icon name={icon} /><span>{label}</span>
            {signedIn && badges[href] > 0 && (
              <span className="nav-badge" aria-label={`${badges[href]} unread`}>{badges[href] > 99 ? '99+' : badges[href]}</span>
            )}
          </button>
        ))}
        <button className={`nav-item${isActive('/account') ? ' active' : ''}`} onClick={() => navigate('/account')}>
          <Icon name="user" /><span>Profile</span>
        </button>
        {signedIn && (
          <>
            <button className="nav-item" onClick={async () => {
              await logOut();
              navigate('/');
            }}>
              <Icon name="logout" /><span>Log out</span>
            </button>
            <button className="btn btn-outline nav-cta" style={{ width: '100%' }} onClick={() => setCreateStartupOpen(true)}>
              <Icon name="flag" /><span>Create Startup</span>
            </button>
          </>
        )}
        <button className="btn btn-accent nav-cta" style={{ width: '100%' }} onClick={openCreatePost}>
          <Icon name="bolt" /><span>Create post</span>
        </button>
      </nav>
      <CreateStartupModal open={createStartupOpen} onClose={() => setCreateStartupOpen(false)} />
    </>
  );
}
