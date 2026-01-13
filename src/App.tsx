import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useStore } from './lib/store';
import { supabase } from './lib/supabase';
import { APP_VERSION } from './config/appConfig';
import { useEffect } from 'react';

// Placeholder Components (Detailed implementations coming next)
import Login from './pages/Auth/Login';
import ResetPassword from './pages/Auth/ResetPassword';
import InstallPrompt from './components/pwa/InstallPrompt';
import Onboarding from './pages/Onboarding/Onboarding';
import Today from './pages/Home/Today';
import Dashboard from './pages/Dashboard/Dashboard';
import History from './pages/History/History';
import Friends from './pages/Social/Friends';
import MyPage from './pages/MyPage/MyPage';
import Admin from './pages/Admin/Admin';
import BottomNav from './components/layout/BottomNav';
import SupportModal from './components/layout/SupportModal';
import { useState } from 'react';

function Layout() {
  const { user } = useStore();
  const location = useLocation();
  const [isSupportOpen, setIsSupportOpen] = useState(false);
  const [supportView, setSupportView] = useState<'main' | 'terms' | 'privacy' | 'refund'>('main');

  const openSupport = (view: 'main' | 'terms' | 'privacy' | 'refund' = 'main') => {
    setSupportView(view);
    setIsSupportOpen(true);
  };

  // Hide nav on login, onboarding
  const hideNavScopes = ['/login', '/onboarding'];
  const showNav = user && !hideNavScopes.includes(location.pathname);

  return (
    <div className="w-full h-[100dvh] max-w-md bg-background relative flex flex-col shadow-2xl overflow-hidden border-x border-slate-800">
      <Routes>
        {/* If not logged in, go to Login */}
        <Route path="/login" element={<Login />} />

        {/* If logged in but no DNA, go to Onboarding */}
        <Route path="/onboarding" element={<Onboarding />} />

        {/* Reset Password Route */}
        <Route path="/reset-password" element={<ResetPassword />} />

        {/* Main App Routes */}
        <Route path="/" element={user ? <MyPage /> : <Navigate to="/login" replace />} />
        <Route path="/today" element={<Today />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/history" element={<History />} />
        <Route path="/friends" element={<Friends />} />
        <Route path="/mypage" element={<MyPage />} />

        {/* Admin Route */}
        <Route path="/admin" element={<Admin />} />

        {/* Fallback */}
        <Route path="*" element={<Navigate to={user ? "/" : "/login"} replace />} />
      </Routes>

      {showNav && (
        <div className="absolute bottom-0 w-full z-50 flex flex-col shadow-[0_-5px_20px_rgba(0,0,0,0.5)]">
          <BottomNav onOpenSupport={openSupport} />
        </div>
      )}

      {/* Global Support Modal */}
      <SupportModal
        isOpen={isSupportOpen}
        onClose={() => setIsSupportOpen(false)}
        initialView={supportView}
      />

      {/* PWA Install Prompt */}
      <InstallPrompt />
    </div>
  );
}

function App() {
  // Version Check & Auto Logout Logic
  useEffect(() => {
    const checkVersion = async () => {
      const storedVersion = localStorage.getItem('app_version');

      if (storedVersion !== APP_VERSION) {
        console.log(`[System] New version detected (${storedVersion} -> ${APP_VERSION}). Clearing session.`);

        // 1. Sign out from Supabase (clears tokens)
        await supabase.auth.signOut();

        // 2. Clear Local Storage (clears any cached state)
        localStorage.clear();

        // 3. Set new version
        localStorage.setItem('app_version', APP_VERSION);

        // 4. Force Reload to ensure clean slate
        window.location.href = '/login';
      }
    };
    checkVersion();
  }, []);

  return (
    <Router>
      <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center p-0 m-0 overflow-hidden relative">
        <Layout />
      </div>
    </Router>
  );
}

export default App;
