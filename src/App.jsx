import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AppProvider, useApp } from './context/AppContext';
import IconSprite from './components/IconSprite';
import CreatePostModal from './components/CreatePostModal';
import ScrollToTop from './components/ScrollToTop';
import Landing from './pages/Landing';
import Login from './pages/Login';
import Feed from './pages/Feed';
import Profile from './pages/Profile';
import Explore from './pages/Explore';
import Messages from './pages/Messages';
import Notifications from './pages/Notifications';
import FounderDashboard from './pages/FounderDashboard';
import AccountProfile from './pages/AccountProfile';
import Settings from './pages/Settings';

// The admin panel is its own bundle: regular users never download it.
const AdminApp = lazy(() => import('./admin/AdminApp'));

// Platform-wide message set by super admins (System settings).
function SiteBanner() {
  const { site } = useApp();
  if (!site.site_banner) return null;
  return <div className="site-banner" role="status">{site.site_banner}</div>;
}

export default function App() {
  return (
    <AppProvider>
      <BrowserRouter>
        <IconSprite />
        <ScrollToTop />
        <SiteBanner />
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/feed" element={<Feed />} />
          <Route path="/profile/:id" element={<Profile />} />
          <Route path="/explore" element={<Explore />} />
          <Route path="/messages" element={<Messages />} />
          <Route path="/notifications" element={<Notifications />} />
          <Route path="/account" element={<AccountProfile />} />
          <Route path="/dashboard/:id" element={<FounderDashboard />} />
          <Route path="/settings" element={<Settings />} />
          <Route
            path="/admin/*"
            element={<Suspense fallback={<div style={{ padding: 40, textAlign: 'center' }}>Loading admin panel…</div>}><AdminApp /></Suspense>}
          />
          <Route path="*" element={<Landing />} />
        </Routes>
        <CreatePostModal />
      </BrowserRouter>
    </AppProvider>
  );
}
