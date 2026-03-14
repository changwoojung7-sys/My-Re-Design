import { useEffect } from 'react';
import { App, type URLOpenListenerEvent } from '@capacitor/app';

type PaymentStatusResponse = {
  status: 'PAID' | 'CANCELED' | 'FAILED' | 'PENDING' | 'NOT_FOUND';
  code?: string;
  message?: string;
  orderId?: string;
  paymentKey?: string;
};

export type UsePaymentReturnOptions = {
  verifyPaymentOnServer: (params: { orderId: string; paymentKey: string }) => Promise<void>;
  fetchPaymentStatus: (orderId: string) => Promise<PaymentStatusResponse>;
  moveToPaymentCompletePage: (orderId: string) => void;
  moveToPaymentFailPage: (params: {
    orderId: string;
    code?: string;
    message?: string;
  }) => void;
};

const PENDING_ORDER_ID_KEY = 'pendingOrderId';
const PENDING_PAYMENT_STARTED_AT_KEY = 'pendingPaymentStartedAt';

export function savePendingOrder(orderId: string) {
  localStorage.setItem(PENDING_ORDER_ID_KEY, orderId);
  localStorage.setItem(PENDING_PAYMENT_STARTED_AT_KEY, String(Date.now()));
}

export function clearPendingOrder() {
  localStorage.removeItem(PENDING_ORDER_ID_KEY);
  localStorage.removeItem(PENDING_PAYMENT_STARTED_AT_KEY);
}

export function usePaymentReturn(options: UsePaymentReturnOptions) {
  useEffect(() => {
    let removed = false;
    let resumeCheckRunning = false;
    let appUrlListener: { remove: () => Promise<void> } | null = null;
    let resumeListener: { remove: () => Promise<void> } | null = null;

    const processUrl = async (url: string) => {
      try {
        console.log('[payment] processUrl:', url);

        const parsed = new URL(url);

        if (parsed.protocol !== 'myredesign:') {
          return;
        }

        // 원래 사용자의 코드 파라미터 + PortOne V1/V2 파라미터 하이브리드 지원
        const rawStatus = parsed.searchParams.get('status');
        const imp_success = parsed.searchParams.get('imp_success');
        const imp_uid = parsed.searchParams.get('imp_uid');
        const merchant_uid = parsed.searchParams.get('merchant_uid');
        const paymentIdRaw = parsed.searchParams.get('paymentId');
        const error_msg = parsed.searchParams.get('error_msg');

        let status = rawStatus;
        if (!status) {
           if (imp_success === 'true' || (paymentIdRaw && !parsed.searchParams.get('code'))) {
               status = 'success';
           } else {
               status = 'fail';
           }
        }

        const orderId = parsed.searchParams.get('orderId') ?? merchant_uid ?? paymentIdRaw ?? '';
        const paymentKey = parsed.searchParams.get('paymentKey') ?? imp_uid ?? paymentIdRaw ?? '';
        const code = parsed.searchParams.get('code') ?? '';
        const message =
          parsed.searchParams.get('message') ?? error_msg ?? '결제가 취소되었거나 실패했습니다.';

        if (status === 'success' && orderId && paymentKey) {
          await options.verifyPaymentOnServer({ orderId, paymentKey });
          clearPendingOrder();
          options.moveToPaymentCompletePage(orderId);
          return;
        }

        if (status === 'cancel' || status === 'fail') {
          clearPendingOrder();
          options.moveToPaymentFailPage({
            orderId,
            code,
            message,
          });
          return;
        }
      } catch (err) {
        console.error('[payment] processUrl error', err);
      }
    };

    const recoverPendingPayment = async () => {
      const pendingOrderId = localStorage.getItem(PENDING_ORDER_ID_KEY);
      if (!pendingOrderId) return;

      try {
        const result = await options.fetchPaymentStatus(pendingOrderId);
        console.log('[payment] recoverPendingPayment result:', result);

        if (result.status === 'PAID') {
          clearPendingOrder();
          options.moveToPaymentCompletePage(pendingOrderId);
          return;
        }

        if (result.status === 'CANCELED' || result.status === 'FAILED') {
          clearPendingOrder();
          options.moveToPaymentFailPage({
            orderId: pendingOrderId,
            code: result.code,
            message: result.message ?? '결제가 취소되었거나 실패했습니다.',
          });
          return;
        }

        // PENDING / NOT_FOUND 는 일단 유지
      } catch (err) {
        console.error('[payment] recoverPendingPayment error', err);
      }
    };

    const init = async () => {
      // 1) 앱이 딥링크로 시작된 경우
      const launch = await App.getLaunchUrl();
      if (!removed && launch?.url) {
        await processUrl(launch.url);
      }

      // 2) 앱 실행 중 새 딥링크 수신
      appUrlListener = await App.addListener('appUrlOpen', async (event: URLOpenListenerEvent) => {
        if (removed) return;
        console.log('[payment] appUrlOpen:', event.url);
        await processUrl(event.url);
      });

      // 3) 카드앱에서 취소 후 딥링크 없이 resume만 되는 경우 대비
      resumeListener = await App.addListener('resume', async () => {
        if (removed || resumeCheckRunning) return;
        resumeCheckRunning = true;
        try {
          console.log('[payment] app resumed -> checking payment status');
          // 의도적인 딜레이: appUrlOpen 이벤트가 먼저 처리되도록 시간차 부여
          setTimeout(async () => {
              await recoverPendingPayment();
          }, 1000);
        } finally {
          resumeCheckRunning = false;
        }
      });
    };

    void init();

    return () => {
      removed = true;
      if (appUrlListener) void appUrlListener.remove();
      if (resumeListener) void resumeListener.remove();
    };
  }, [options]);
}
