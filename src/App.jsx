import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AppProvider } from './context/AppContext';
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
import Settings from './pages/Settings';
import FounderDashboard from './pages/FounderDashboard';
import InvestorPortfolio from './pages/InvestorPortfolio';
import AccountProfile from './pages/AccountProfile';

export default function App() {
  return (
    <AppProvider>
      <BrowserRouter>
        <IconSprite />
        <ScrollToTop />
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/feed" element={<Feed />} />
          <Route path="/profile/:id" element={<Profile />} />
          <Route path="/explore" element={<Explore />} />
          <Route path="/messages" element={<Messages />} />
          <Route path="/notifications" element={<Notifications />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/account" element={<AccountProfile />} />
          <Route path="/dashboard/:id" element={<FounderDashboard />} />
          <Route path="/portfolio" element={<InvestorPortfolio />} />
          <Route path="*" element={<Landing />} />
        </Routes>
        <CreatePostModal />
      </BrowserRouter>
    </AppProvider>
  );
}
