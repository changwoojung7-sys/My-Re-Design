import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';

const KakaoRedirectHandler = ({ children }: { children: React.ReactNode }) => {
    const [isKakao, setIsKakao] = useState(false);
    const location = useLocation();

    useEffect(() => {
        const userAgent = navigator.userAgent.toLowerCase();

        // Check if user is in KakaoTalk in-app browser
        if (userAgent.indexOf('kakaotalk') > -1) {
            setIsKakao(true);

            // Android: Auto-redirect using Intent scheme
            if (userAgent.indexOf('android') > -1) {
                const currentUrl = window.location.href.replace(/https?:\/\//i, '');
                // Construct Intent URL for opening in Chrome
                // package=com.android.chrome ensures it tries Chrome, 
                // fallback scheme=http(s) ensures if Chrome fails content is handled
                const intentUrl = `intent://${currentUrl}#Intent;scheme=https;package=com.android.chrome;end`;
                window.location.href = intentUrl;
            }
        } else {
            setIsKakao(false);
        }
    }, [location]);

    if (!isKakao) {
        return <>{children}</>;
    }

    // Detect OS for specific instructions
    const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);

    return (
        <div className="fixed inset-0 z-[9999] bg-white flex flex-col items-center justify-center p-6 text-center">
            <div className="max-w-md w-full space-y-8">
                {/* Icon or Illustration */}
                <div className="mx-auto w-24 h-24 bg-yellow-400 rounded-full flex items-center justify-center text-4xl mb-6 shadow-lg">
                    ⚠️
                </div>

                <h1 className="text-2xl font-bold text-gray-900 mb-2">
                    외부 브라우저에서<br />열어주세요
                </h1>

                <p className="text-gray-600 mb-8 whitespace-pre-line leading-relaxed">
                    카카오톡 인앱 브라우저에서는<br />
                    보안 및 권한 문제로 인해<br />
                    인증이 정상적으로 진행되지 않습니다.
                </p>

                <div className="bg-gray-50 rounded-xl p-6 text-left shadow-inner border border-gray-100">
                    <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                        <span className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm">!</span>
                        해결 방법
                    </h3>

                    <div className="space-y-4 text-sm text-gray-700">
                        {isIOS ? (
                            // iOS Instructions
                            <ol className="space-y-3 list-decimal list-inside">
                                <li>화면 우측 하단의 <span className="font-bold inline-block px-2 py-0.5 bg-gray-200 rounded">⋯</span> (더보기) 또는 <span className="font-bold inline-block px-2 py-0.5 bg-gray-200 rounded">Share</span> 버튼을 눌러주세요.</li>
                                <li><span className="font-bold text-blue-600">Safari로 열기</span>를 선택해주세요.</li>
                            </ol>
                        ) : (
                            // Android Instructions (Fallback if auto-redirect fails)
                            <ol className="space-y-3 list-decimal list-inside">
                                <li>화면 우측 상단의 <span className="font-bold inline-block px-2 py-0.5 bg-gray-200 rounded">⋮</span> (메뉴) 버튼을 눌러주세요.</li>
                                <li><span className="font-bold text-blue-600">다른 브라우저로 열기</span>를 선택해주세요.</li>
                            </ol>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default KakaoRedirectHandler;
