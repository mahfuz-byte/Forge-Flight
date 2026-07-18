import { useLocation, useNavigate } from 'react-router-dom';
import { Icon } from './IconSprite';
import { useApp } from '../context/AppContext';

const ITEMS = [
  ['home', 'Home', '/feed'],
  ['compass', 'Explore Startups', '/explore'],
  ['coin', 'Funding Opportunities', '/explore?filter=funding'],
  ['handshake', 'Collaboration Openings', '/explore?filter=collab'],
  ['bookmark', 'Saved Startups', '/explore?filter=saved'],
  ['msg', 'Messages', '/messages'],
  ['bell', 'Notifications', '/notifications'],
];

export default function LeftNav() {
  const navigate = useNavigate();
  const location = useLocation();
  const { openCreatePost } = useApp();

  function isActive(href) {
    const [path, query] = href.split('?');
    if (location.pathname !== path) return false;
    return (location.search.slice(1) || '') === (query || '');
  }

  return (
    <nav className="side-left">
      {ITEMS.map(([icon, label, href]) => (
        <button
          key={href}
          className={`nav-item${isActive(href) ? ' active' : ''}`}
          onClick={() => navigate(href)}
        >
          <Icon name={icon} /><span>{label}</span>
        </button>
      ))}
      <button className={`nav-item${isActive('/account') ? ' active' : ''}`} onClick={() => navigate('/account')}>
        <Icon name="user" /><span>Profile</span>
      </button>
      <button className={`nav-item${isActive('/portfolio') ? ' active' : ''}`} onClick={() => navigate('/portfolio')}>
        <Icon name="chart" /><span>My Portfolio</span>
      </button>
      <button className={`nav-item${isActive('/settings') ? ' active' : ''}`} onClick={() => navigate('/settings')}>
        <Icon name="gear" /><span>Settings</span>
      </button>
      <button className="btn btn-accent nav-cta" style={{ width: '100%' }} onClick={openCreatePost}>
        <Icon name="bolt" /><span>Create post</span>
      </button>
    </nav>
  );
}
