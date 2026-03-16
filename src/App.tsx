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
// import { usePaymentReturn } from './lib/usePaymentReturn'; // 제거됨


function App() {
  const { t } = useLanguage();
  // Version Check & Auto Logout Logic
  useEffect(() => {
    const checkVersion = async () => {
      const storedVersion = localStorage.getItem('app_version');

      if (storedVersion !== APP_VERSION) {
        console.log(`[System] New version detected (${storedVersion} -> ${APP_VERSION}).`);

        // [수정] 결제 진행 중이면 로그아웃 건너뜀
        const pendingPayment = localStorage.getItem('pending_payment');
        if (pendingPayment) {
          console.log('[System] Payment in progress, skipping version clear.');
          localStorage.setItem('app_version', APP_VERSION);
          return;
        }

        // [개선] 로그아웃 시에도 Supabase 세션 키는 보존하여 불필요한 재로그인 방지
        const keysToKeep = ['app_version', 'pending_payment'];
        // Supabase 인증 키 (sb-xxx-auth-token) 패턴 보존
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && (key.startsWith('sb-') || keysToKeep.includes(key))) {
            // 보존할 키는 제외
          } else if (key) {
            localStorage.removeItem(key);
          }
        }

        localStorage.setItem('app_version', APP_VERSION);
        console.log('[System] Storage cleared except auth/payment keys.');
      }
    };
    checkVersion();

    // --- NEW: Auth State Synchronization ---
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log(`[Auth] Event: ${event}`, session?.user?.id);

      if (event === 'SIGNED_OUT') {
        // [수정] 결제 복귀 직후 WebView 재로드 시 세션이 일시적으로 SIGNED_OUT으로 잡힘
        // pending_payment가 있으면 결제 중이므로 로그아웃 이벤트 무시
        if (localStorage.getItem('pending_payment')) {
          console.log('[Auth] SIGNED_OUT ignored — payment in progress.');
          return;
        }
        useStore.getState().setUser(null);
      } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        if (!useStore.getState().user && session?.user) {
          // 세션은 있지만 스토어에 유저가 없는 경우 — Login 페이지에서 처리
        }
      }
    });

    // Initial Check: Validate Session
    const validateSession = async () => {
      // [수정] 결제 복귀 직후 React 재초기화 시 세션이 스토리지에서 로드될 시간을 줌 (500ms)
      await new Promise(resolve => setTimeout(resolve, 500));

      if (localStorage.getItem('pending_payment')) {
        console.log('[Auth] validateSession: payment in progress, skipping logout check.');
        return;
      }

      const { data: { session }, error } = await supabase.auth.getSession();
      const currentUser = useStore.getState().user;

      // session이 확실히 없는 경우에만 스토어 유저 정리
      if (!session && currentUser) {
        console.warn("[Auth] Stale State Detected: Logging out.");
        useStore.getState().setUser(null);
      } else if (error) {
        console.error("[Auth] Session check error:", error);
      }
    };
    validateSession();

    return () => {
      subscription.unsubscribe();
    };
  }, []); // End of auth check useEffect

  // ─────────────────────────────────────────────────────────────
  // [추가] appUrlOpen — 결제 후 앱 복귀 시 이벤트 수신 (App 최상위 등록)
  // Paywall이 마운트되기 전에도 이벤트를 놓치지 않음
  // ─────────────────────────────────────────────────────────────
  useEffect(() => {
    // ── localStorage 폴링 방식으로 결제 결과 수신 ──────────────
    // appUrlOpen/Intent 타이밍 문제 없이 React 마운트 후 안전하게 처리
    const checkPaymentResult = async () => {
      const resultQuery = localStorage.getItem('payment_return_result');
      if (!resultQuery) return;

      // 즉시 제거해서 중복 처리 방지
      localStorage.removeItem('payment_return_result');
      console.log('[App] payment_return_result 감지:', resultQuery);

      const params = new URLSearchParams(resultQuery);
      const code = params.get('code');
      const message = params.get('message') || params.get('error_msg') || '';
      const paymentId = params.get('paymentId');
      const txId = params.get('txId');

      const isFailed = code === 'FAILURE_TYPE_PG';
      const isSuccess = code === 'SUCCESS' || (!code && !!paymentId && !!txId);

      console.log('[App] 결제 판정 — isFailed:', isFailed, 'isSuccess:', isSuccess);

      if (isFailed) {
        localStorage.removeItem('pending_payment');
        const isCancel = message.includes('취소') || message.toLowerCase().includes('cancel');
        alert(isCancel ? '결제를 취소하셨습니다.' : `결제 실패: ${message || '알 수 없는 오류'}`);

      } else if (isSuccess) {
        try {
          const { checkMobilePaymentResult } = await import('./lib/payment');
          const fullUrl = 'myredesign://payment/result?' + resultQuery;
          const result = await checkMobilePaymentResult(fullUrl);
          if (result?.success) {
            localStorage.removeItem('pending_payment');
            alert(t.subscriptionSuccessful || '결제가 성공적으로 완료되었습니다.');
            window.location.href = '/';
          } else {
            alert(`결제 처리 오류: ${result?.error || '서버 오류'}`);
          }
        } catch (e: any) {
          alert(`결제 처리 중 오류: ${e.message}`);
        }
      }
    };

    // 마운트 직후 + 500ms 후 두 번 체크 (restoreApp 타이밍 대응)
    checkPaymentResult();
    const timer = setTimeout(checkPaymentResult, 500);
    return () => clearTimeout(timer);

  }, [t.subscriptionSuccessful]);

  // --- 중앙 집중식 결제 복구 훅 (중복 리스너 제거 버전) ---
  // 아래 훅에서는 appUrlOpen 리스너를 실행하지 않도록 내부 설정을 확인하거나, 
  // 여기서는 중복 방지를 위해 주석 처리하거나 리팩토링이 필요합니다.
  // 우선 App.tsx의 최상위 리스너가 강력하므로, 중복 처리를 막기 위해 이 훅 호출을 조정합니다.
  /*
  usePaymentReturn({
    ...
  });
  */

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
