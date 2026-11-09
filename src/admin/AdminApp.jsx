import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { Navigate, NavLink, Route, Routes, useNavigate } from 'react-router-dom';
import { Icon } from '../components/IconSprite';
import { useApp } from '../context/AppContext';
import { adminApi } from './adminApi';
import { ErrorState } from './components';
import { ADMIN_NAV, visibleNav } from './nav';
import AdminDashboard from './pages/AdminDashboard';
import ActivityLog from './pages/ActivityLog';
import '../styles/admin.css';

const AdminContext = createContext(null);

export function useAdmin() {
  return useContext(AdminContext);
}

/** Shown when the server says this account isn't an admin. Says nothing more. */
function NotAuthorized() {
  const navigate = useNavigate();
  return (
    <div className="admin-gate">
      <h1>Not authorized</h1>
      <p>This area is only for Forge &amp; Flight staff.</p>
      <button type="button" className="btn btn-accent btn-sm" onClick={() => navigate('/feed')}>Back to the app</button>
    </div>
  );
}

/** Routes the signed-in admin's role can open; anything else shows NotAuthorized. */
function Guarded({ capability, children }) {
  const { can } = useAdmin();
  return can(capability) ? children : <NotAuthorized />;
}

export default function AdminApp() {
  const { signedIn, theme, toggleTheme } = useApp();
  const navigate = useNavigate();
  const [me, setMe] = useState(null);
  const [error, setError] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);

  const load = useCallback(() => {
    setError(null);
    adminApi.get('/me/').then(setMe).catch(setError);
  }, []);

  useEffect(() => { if (signedIn) load(); }, [signedIn, load]);

  if (!signedIn) return <Navigate to="/login" replace />;
  if (error?.kind === 'forbidden' || error?.kind === 'auth') return <NotAuthorized />;
  if (error) return <div className="admin-gate"><ErrorState error={error} onRetry={load} /></div>;
  if (!me) return <div className="admin-gate"><p>Loading admin panel…</p></div>;

  const caps = new Set(me.capabilities);
  const can = (capability) => caps.has(capability);
  const nav = visibleNav(me.capabilities);
  const home = nav[0]?.to || '/feed';

  return (
    <AdminContext.Provider value={{ me, can }}>
      <div className={`admin-shell${menuOpen ? ' menu-open' : ''}`}>
        <aside className="admin-side" aria-label="Admin navigation">
          <div className="admin-brand">
            <span className="mark">F&amp;F</span>
            <span>Admin</span>
          </div>
          <nav onClick={() => setMenuOpen(false)}>
            {nav.map((item) => (
              <NavLink key={item.to} to={item.to} end={item.end} className={({ isActive }) => `admin-nav-item${isActive ? ' active' : ''}`}>
                <Icon name={item.icon} /><span>{item.label}</span>
              </NavLink>
            ))}
          </nav>
          <div className="admin-side-foot">
            <b>{me.name}</b>
            <span>{me.role_label}</span>
          </div>
        </aside>

        <div className="admin-main">
          <header className="admin-topbar">
            <button type="button" className="icon-btn admin-menu-btn" aria-label="Open admin menu" aria-expanded={menuOpen} onClick={() => setMenuOpen((v) => !v)}>
              <Icon name="chev" />
            </button>
            <span className="admin-role-pill" title={me.role_summary}>{me.role_label}</span>
            <span className="spacer" />
            <button type="button" className="icon-btn" aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`} onClick={toggleTheme}>
              <span aria-hidden="true">{theme === 'dark' ? '☀' : '☾'}</span>
            </button>
            <button type="button" className="btn btn-outline btn-sm" onClick={() => navigate('/feed')}>Back to app</button>
          </header>

          <main className="admin-content">
            <Routes>
              <Route index element={<Guarded capability="dashboard.view"><AdminDashboard /></Guarded>} />
              <Route path="activity" element={<Guarded capability="activity.view"><ActivityLog /></Guarded>} />
              {/* Modules not built yet (Phase 6) and unknown paths go to the admin home. */}
              {ADMIN_NAV.filter((n) => !n.ready).map((n) => (
                <Route key={n.to} path={n.to.replace('/admin/', '')} element={<Navigate to={home} replace />} />
              ))}
              <Route path="*" element={<Navigate to={home} replace />} />
            </Routes>
          </main>
        </div>
      </div>
    </AdminContext.Provider>
  );
}
