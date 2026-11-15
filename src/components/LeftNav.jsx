import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Icon } from './IconSprite';
import { useApp } from '../context/AppContext';
import CreateStartupModal from './CreateStartupModal';

const ITEMS = [
  ['home', 'Home', '/feed'],
  ['compass', 'Explore', '/explore'],
  ['chart', 'Stats', '/statistics'],
  ['msg', 'Messages', '/messages'],
  ['bell', 'Notifications', '/notifications'],
];

export default function LeftNav() {
  const navigate = useNavigate();
  const location = useLocation();
  const {
    openCreatePost, signedIn, logOut, unreadMessageCount, unreadNotificationCount,
    myStartups, investments, applications,
  } = useApp();
  const badges = { '/messages': unreadMessageCount, '/notifications': unreadNotificationCount };
  const [createStartupOpen, setCreateStartupOpen] = useState(false);

  function isActive(href) {
    const [path, query] = href.split('?');
    if (location.pathname !== path) return false;
    return (location.search.slice(1) || '') === (query || '');
  }

  const isManageActive = location.pathname.startsWith('/dashboard') || location.pathname.startsWith('/manage-startup');
  const myStartupSlugs = new Set((myStartups || []).map(([s]) => s));
  const pendingCount = (investments || []).filter((i) => myStartupSlugs.has(i.startupId) && i.status === 'pending').length
    + (applications || []).filter((a) => myStartupSlugs.has(a.startupId) && a.status === 'pending').length;

  return (
    <>
      <nav className="side-left">
        {ITEMS.map(([icon, label, href]) => (
          <button
            key={href}
            className={`nav-item${isActive(href) ? ' active' : ''}`}
            aria-label={label}
            onClick={() => navigate(href)}
          >
            <Icon name={icon} /><span className={`nav-label-full${href === '/messages' || href === '/notifications' ? ' nav-label-switch' : ''}`}>{label}</span>
            {(href === '/messages' || href === '/notifications') && <span className="nav-label-mobile">{href === '/messages' ? 'Inbox' : 'Alerts'}</span>}
            {signedIn && badges[href] > 0 && (
              <span className="nav-badge" aria-label={`${badges[href]} unread`}>{badges[href] > 99 ? '99+' : badges[href]}</span>
            )}
          </button>
        ))}
        {signedIn && (
          <button
            className={`nav-item${isManageActive ? ' active' : ''}`}
            onClick={() => {
              if (myStartups && myStartups.length > 0) {
                navigate(`/dashboard/${myStartups[0][0]}`);
              } else {
                navigate('/dashboard');
              }
            }}
          >
            <Icon name="flag" /><span className="nav-label-full">Manage Startup</span>
            <span className="nav-label-mobile">Manage</span>
            {pendingCount > 0 && (
              <span className="nav-badge" aria-label={`${pendingCount} pending requests`}>{pendingCount}</span>
            )}
          </button>
        )}
        <button className={`nav-item${isActive('/account') ? ' active' : ''}`} onClick={() => navigate('/account')}>
          <Icon name="user" /><span>Profile</span>
        </button>
        {signedIn && (
          <>
            <button className="nav-item nav-logout" onClick={async () => {
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
