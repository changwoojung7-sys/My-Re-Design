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

import KakaoRedirectHandler from './components/common/KakaoRedirectHandler';
import { App as CapacitorApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { useLanguage } from './lib/i18n';

function App() {
  const { t } = useLanguage();
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

    // --- NEW: Auth State Synchronization ---
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log(`[Auth] Event: ${event}`, session?.user?.id);

      if (event === 'SIGNED_OUT') {
        // Clear global store if Supabase says we are logged out
        useStore.getState().setUser(null);
        // Optional: Clear persisted state manually if needed, but setUser(null) usually triggers UI update
      } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        // Ideally we might want to refresh the user profile here too to ensure data consistency
        // But for now, ensure we at least have a user
        if (!useStore.getState().user && session?.user) {
          // We have a session but no store user? Fetch profile.
          // This handles "Tab Refresh" cases well if persist didn't work, 
          // BUT since we use persist, this is a fallback.
          // Let's rely on the Login page to set the full user with profile data.
        }
      }
    });

    // Initial Check: Validate Session
    const validateSession = async () => {
      const { data: { session }, error } = await supabase.auth.getSession();
      const currentUser = useStore.getState().user;

      if (!session && currentUser) {
        console.warn("[Auth] Stale State Detected: User exists in Store but no active Supabase Session. Logging out.");
        // We have a UI user, but no Supabase key. This causes the RLS errors.
        // Action: Clear UI state to force re-login.
        useStore.getState().setUser(null);
        // supabase.auth.signOut(); // Just to be sure
      } else if (error) {
        console.error("[Auth] Session check error:", error);
      } else if (session) {
        console.log("[Auth] Session is valid.", session.user.email);
      }
    };
    validateSession();

    // --- NEW: Global Payment Result Check ---
    const checkPayment = async (customUrl?: string) => {
      // Import dynamically to avoid circular deps if any, or just import at top
      const { checkMobilePaymentResult } = await import('./lib/payment');
      const result = await checkMobilePaymentResult(customUrl);

      if (result) {
        // Clear URL Params to prevent double-alert on refresh
        if (!customUrl) {
          const url = new URL(window.location.href);
          url.searchParams.delete('imp_success');
          url.searchParams.delete('error_msg');
          url.searchParams.delete('imp_uid');
          url.searchParams.delete('merchant_uid');
          url.searchParams.delete('paymentId');
          url.searchParams.delete('code');
          url.searchParams.delete('message');
          window.history.replaceState({}, '', url.toString());
        }

        if (result.success) {
          const { data } = result;
          const msg = data
            ? `${t.paymentSuccessAlert}\n\n📄 상품명: ${data.planName}\n💰 결제금액: ₩${data.amount.toLocaleString()}`
            : t.paymentSuccessAlert;

          alert(msg);

          // Return to home page to clear state completely
          window.location.href = '/';
        } else {
          // Ensure error message is also localized or clear
          const errorMsg = result.error || 'Unknown error';

          // Check for specific technical errors and show user-friendly message
          const isCancelled = 
            (errorMsg.includes('Payment status is') && (errorMsg.includes('FAILED') || errorMsg.includes('CANCELLED'))) ||
            errorMsg.toLowerCase().includes('canc') || 
            errorMsg.includes('취소');

          if (isCancelled) {
            alert(t.paymentCancelledAlert);
          } else {
            alert(t.paymentFailedAlert.replace('{error}', errorMsg));
          }
          window.location.href = '/';
        }
      }
    };
    checkPayment();

    let appUrlListener: any = null;
    let resumeListener: any = null;

    if (Capacitor.isNativePlatform()) {
      const handlePaymentReturn = async () => {
        // 1. Cold Start 딥링크 캡처
        const launch = await CapacitorApp.getLaunchUrl();
        if (launch?.url && launch.url.includes('myredesign://')) {
          checkPayment(launch.url);
        }

        // 2. Background -> Foreground 딥링크 캡처
        CapacitorApp.addListener('appUrlOpen', ({ url }) => {
          if (url.includes('myredesign://')) {
            checkPayment(url);
          }
        }).then(listener => appUrlListener = listener);

        // 3. 앱 Resume 캡처 (딥링크 없이 PG사 취소/뒤로가기로 백그라운드에서 돌아올 때)
        CapacitorApp.addListener('resume', async () => {
          // 약간의 지연을 주어 appUrlOpen이 먼저 처리될 기회를 줌
          setTimeout(async () => {
             const pending = localStorage.getItem('pending_payment');
             if (pending) {
               // 딥링크가 안 왔는데 pending이 남아있다면 서버 상태 조회를 통해 복구/취소 처리
               const { checkPendingPaymentAndRecover } = await import('./lib/payment');
               const result = await checkPendingPaymentAndRecover();
               if (result) {
                 if (result.success) {
                    alert(t.paymentSuccessAlert || '결제가 성공적으로 복구되었습니다.');
                    window.location.href = '/';
                 } else {
                    const errorMsg = result.error || '';
                    if (errorMsg.includes('취소') || errorMsg.includes('미완료')) {
                      // Silently ignore or show brief toast if needed, alert is too aggressive for simple back button
                      console.log('Payment cancelled/uncompleted on resume.');
                    } else {
                      alert(`결제 복구 실패: ${errorMsg}`);
                    }
                 }
               }
             }
          }, 1000);
        }).then(listener => resumeListener = listener);
      };

      handlePaymentReturn();
    }

    return () => {
      subscription.unsubscribe();
      if (appUrlListener) appUrlListener.remove();
      if (resumeListener) resumeListener.remove();
    };
  }, []);

  return (
    <Router>
      <KakaoRedirectHandler>
        <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center p-0 m-0 overflow-hidden relative">
          <Layout />
        </div>
      </KakaoRedirectHandler>
    </Router>
  );
}

export default App;
