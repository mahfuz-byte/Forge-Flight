import { useNavigate } from 'react-router-dom';
import Topbar from '../components/Topbar';
import LeftNav from '../components/LeftNav';
import { Icon } from '../components/IconSprite';
import { useApp } from '../context/AppContext';
import '../styles/notifications.css';

export default function Notifications() {
  const navigate = useNavigate();
  const { notifications, markNotificationRead, markAllNotificationsRead } = useApp();
  const unreadCount = notifications.filter((notification) => !notification.read).length;

  async function markAllRead() {
    await markAllNotificationsRead();
  }

  async function open(notification) {
    await markNotificationRead(notification.id);
    navigate(notification.link || '/feed');
  }

  return (
    <div>
      <Topbar />
      <div className="layout layout-2col">
        <LeftNav />
        <main className="center-col notifications-page">
          <div className="notif-page-head">
            <div>
              <h2>Notifications</h2>
              <p>{unreadCount > 0 ? `${unreadCount} unread` : "You're all caught up."}</p>
            </div>
            <button className="btn btn-outline btn-sm" onClick={markAllRead} disabled={unreadCount === 0}>Mark all as read</button>
          </div>
          <div className="notif-page-list">
            {notifications.length === 0 ? (
              <div className="settings-card" style={{ margin: 0 }}>
                <p className="settings-hint" style={{ marginBottom: 0 }}>No notifications yet.</p>
              </div>
            ) : notifications.map((notification) => (
              <button key={notification.id} className={`notif-page-item${notification.read ? '' : ' unread'}`} onClick={() => open(notification)}>
                <span className="np-icon" style={{ color: notification.color }}><Icon name={notification.icon} /></span>
                <span className="np-text">{notification.text}</span>
                <time className="np-time mono">{notification.time}</time>
                {!notification.read && <span className="np-dot" />}
              </button>
            ))}
          </div>
        </main>
      </div>
    </div>
  );
}
