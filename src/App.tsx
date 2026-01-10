import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useStore } from './lib/store';

// Placeholder Components (Detailed implementations coming next)
import Login from './pages/Auth/Login';
import Onboarding from './pages/Onboarding/Onboarding';
import Today from './pages/Home/Today';
import Dashboard from './pages/Dashboard/Dashboard';
import History from './pages/History/History';
import Friends from './pages/Social/Friends';
import MyPage from './pages/MyPage/MyPage';
import BottomNav from './components/layout/BottomNav';

function Layout() {
  const { user } = useStore();
  const location = useLocation();

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

        {/* Main App Routes */}
        <Route path="/" element={user ? <MyPage /> : <Navigate to="/login" replace />} />
        <Route path="/today" element={<Today />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/history" element={<History />} />
        <Route path="/friends" element={<Friends />} />
        <Route path="/mypage" element={<MyPage />} />

        {/* Fallback */}
        <Route path="*" element={<Navigate to={user ? "/" : "/login"} replace />} />
      </Routes>

      {showNav && <BottomNav />}
    </div>
  );
}

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center p-0 m-0 overflow-hidden relative">
        <Layout />
      </div>
    </Router>
  );
}

export default App;
