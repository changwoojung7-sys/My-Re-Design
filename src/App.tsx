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
import { useLanguage } from './lib/i18n';
import { usePaymentReturn } from './lib/usePaymentReturn';

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

    return () => {
      subscription.unsubscribe();
    };
  }, []); // End of auth check useEffect

  // --- NEW: Global Payment Result Check via Custom Hook ---
  usePaymentReturn({
    verifyPaymentOnServer: async ({ orderId, paymentKey }: { orderId: string; paymentKey: string }) => {
      // 1. URL 기반 결과 파싱 및 DB 반영 로직 (lib/payment.ts 활용)
      const { checkMobilePaymentResult } = await import('./lib/payment');
      // PortOne의 응답 형식처럼 가짜 URL을 만들어 checkMobilePaymentResult가 파싱하게 함
      const dummyUrl = `myredesign://payment/result?imp_success=true&imp_uid=${paymentKey}&merchant_uid=${orderId}`;
      const result = await checkMobilePaymentResult(dummyUrl);
      if (result && !result.success) {
        throw new Error(result.error);
      }
    },
    fetchPaymentStatus: async (orderId: string) => {
      // resume 복구 시 DB에서 현재 트랜잭션의 상태와 검증 수행
      const { data: pendingRecord } = await supabase
        .from('payments')
        .select('*')
        .or(`merchant_uid.eq.${orderId},imp_uid.eq.${orderId}`)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!pendingRecord) return { status: 'NOT_FOUND' };

      if (pendingRecord.status === 'pending') {
         const mode = orderId.startsWith('pay_') ? 'real' : 'test';
         const { data: verifyData, error: verifyError } = await supabase.functions.invoke('verify-payment', {
             body: {
                 imp_uid: mode === 'real' ? undefined : pendingRecord.imp_uid,
                 payment_id: mode === 'real' ? pendingRecord.imp_uid : undefined,
                 merchant_uid: orderId,
                 mode: mode
             }
         });

         if (verifyError || verifyData?.error) {
             const { processPaymentFailure } = await import('./lib/payment');
             await processPaymentFailure(orderId);
             return { status: 'FAILED', message: verifyData?.error || '검증 실패' };
         }
         
         // 결제 실제 성공 처리 반영
         const { processPaymentSuccess } = await import('./lib/payment');
         const pendingPaymentStr = localStorage.getItem('pending_payment');
         if (pendingPaymentStr) {
             const paymentData = JSON.parse(pendingPaymentStr);
             await processPaymentSuccess(
                pendingRecord.imp_uid || pendingRecord.merchant_uid,
                paymentData.mode,
                paymentData.tier,
                paymentData.planType,
                paymentData.targetCategory,
                new Date(paymentData.startDate),
                new Date(paymentData.endDate),
                pendingRecord.merchant_uid
             );
         }
         return { status: 'PAID' }; 
      }

      if (pendingRecord.status === 'paid') return { status: 'PAID' };
      if (pendingRecord.status === 'cancelled') return { status: 'CANCELED' };
      return { status: 'FAILED' };
    },
    moveToPaymentCompletePage: (_orderId: string) => {
      alert(t.paymentSuccessAlert || '결제가 성공적으로 반영되었습니다.');
      window.location.href = '/';
    },
    moveToPaymentFailPage: ({ orderId: _orderId, code: _code, message }: { orderId: string; code?: string; message?: string }) => {
      const errorMsg = message?.toLowerCase() || '';
      if (errorMsg.includes('취소') || errorMsg.includes('cancel')) {
        console.log('Payment cancelled on resume:', message);
      } else {
        alert(t.paymentFailedAlert ? t.paymentFailedAlert.replace('{error}', message || '') : `결제 취소/실패: ${message}`);
      }
      window.location.href = '/';
    }
  });

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
