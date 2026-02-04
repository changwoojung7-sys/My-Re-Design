import { useState, useEffect } from 'react';
import { X, ChevronLeft, Send, MessageCircle, Clock, ChevronDown, ChevronUp, Lock } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';

import { TERMS_CONTENT, PRIVACY_CONTENT, REFUND_CONTENT } from '../../data/LegalData';

interface SupportModalProps {
    isOpen: boolean;
    onClose: () => void;
    initialView?: 'main' | 'terms' | 'privacy' | 'refund';
}

const FAQ_DATA: Record<string, { q: string; a: string }[]> = {
    '계정/로그인': [
        { q: '비밀번호를 잊어버렸어요.', a: '로그인 화면 하단의 "비밀번호 찾기"를 통해 이메일 인증 후 비밀번호를 재설정하실 수 있습니다.' },
        { q: '회원탈퇴는 어떻게 하나요?', a: '마이페이지 > 프로필 수정 > 회원탈퇴 메뉴에서 진행하실 수 있습니다. 탈퇴 시 모든 데이터는 삭제됩니다.' },
        { q: '아이디(이메일) 변경이 가능한가요?', a: '보안상의 이유로 아이디(이메일) 변경은 불가능합니다. 새로운 이메일 사용을 원하시면 신규 가입이 필요합니다.' },
    ],
    '결제/구독': [
        { q: '결제 내역은 어디서 보나요?', a: '마이페이지 > 구독 관리 메뉴의 하단 "결제 내역" 탭에서 확인하실 수 있습니다.' },
        { q: '환불 규정이 궁금해요.', a: '결제 당일 및 익일까지 전액 환불이 가능하며, 이후에는 사용 일수를 제외한 금액이 환불됩니다. 자세한 내용은 "환불정책"을 참고해주세요.' },
        { q: '구독 취소는 어떻게 하나요?', a: '본 서비스는 자동 결제(구독 갱신) 방식이 아니므로, 별도의 구독 취소 절차가 필요하지 않습니다. 기간 만료 시 자동으로 무료 상태로 전환됩니다.' },
    ],
    '미션/인증': [
        { q: '미션은 어떻게 생성하나요?', a: '홈(My Loop)에서 집중 영역 콤보의 미션을 선택하고, 조회 모드를 클릭하여 수정 모드로 전환한 뒤 목표 및 상세 내용을 작성하고 하단의 설계 저장 버튼을 눌러 미션을 생성합니다. 미션의 상세 내용은 미션 진행 중에도 수정 저장할 수 있습니다.' },
        { q: '미션 완료 후 추가로 생성할 수 있나요?', a: '진행 중인 미션이 종료되면 홈(My Loop)에서 해당 미션을 추가 등록할 수 있게 되며, 해당 미션을 선택 후 미션 생성 방법과 동일하게 생성하면 됩니다.' },
        { q: '미션을 삭제하고 싶어요.', a: '홈(My Loop)에서 삭제할 미션을 선택하고 수정 모드로 전환한 뒤, 하단의 "삭제하기" 버튼을 눌러 미션을 삭제할 수 있습니다. 미션을 삭제하면 그동안 진행했던 미션과 친구들의 좋아요. 댓글도 모두 삭제됩니다.' },
        { q: '미션은 언제 갱신되나요?', a: '매일 자정(00:00)에 새로운 AI 맞춤 미션이 갱신됩니다.' },
        { q: '이미 완료한 미션을 수정할 수 있나요?', a: '미션 인증 후에는 원칙적으로 수정이 불가능하나, 실수로 잘못 올린 경우 고객센터로 문의주시면 조치해 드립니다.' },
    ],
    '친구/소셜': [
        { q: '친구 추가는 어떻게 하나요?', a: '친구 탭 > 우측 상단 "친구 추가" 버튼을 눌러 전화번호 또는 이메일로 검색하여 등록할 수 있습니다.\n\n친구의 미션 히스토리를 보려면 "미션 히스토리 보기요청" 버튼을 통해 신청하고, 친구가 승인하면 친구의 미션 히스토리를 볼 수 있습니다.' },
        { q: '친구가 보낸 히스토리 보기 요청은 어떻게 승인하나요?', a: '마이페이지 > 상단의 종모양 아이콘 "요청 알림" 메뉴에서 친구가 보낸 요청을 확인하고 "승인" 버튼을 눌러 수락할 수 있습니다. 이미 승인된 권한은 동일한 메뉴 하단에서 언제든지 철회할 수 있습니다.' },
        { q: '내 기록을 비공개로 하고 싶어요.', a: '마이페이지 요청알림 에서 활성 권한(친구) 를 모두 철회버튼을 눌러 삭제하면 됩니다.' },
    ],
    '데이터/오류': [
        { q: '앱이 자꾸 종료됩니다.', a: '앱을 최신 버전으로 업데이트 해보시고, 계속 문제가 발생하면 기기 정보와 함께 문의 남겨주세요.' },
        { q: '데이터 백업 기능이 있나요?', a: '현재는 클라우드에 자동 저장되고 있습니다. 별도의 수동 백업 기능은 추후 지원 예정입니다.' },
    ],
    '기타문의': [
        { q: '제안하고 싶은 기능이 있어요.', a: '언제든 환영합니다! "문의하기" 버튼을 통해 의견을 보내주시면 서비스 개선에 반영하겠습니다.' },
    ],
};

export default function SupportModal({ isOpen, onClose, initialView = 'main' }: SupportModalProps) {
    const navigate = useNavigate();
    const [view, setView] = useState<'main' | 'terms' | 'privacy' | 'refund'>('main');
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
    const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);
    const [showEmailOptions, setShowEmailOptions] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setView(initialView);
            // Reset states when opening
            if (initialView === 'main') {
                setSelectedCategory(null);
                setOpenFaqIndex(null);
                setShowEmailOptions(false);
            }
        }
    }, [isOpen, initialView]);

    if (!isOpen) return null;

    const handleFaqToggle = (index: number) => {
        setOpenFaqIndex(openFaqIndex === index ? null : index);
    };

    const handleEmailSelect = (type: 'gmail' | 'naver' | 'default') => {
        const email = 'yujinit2005@gmail.com';
        let url = '';

        switch (type) {
            case 'gmail':
                url = `https://mail.google.com/mail/?view=cm&fs=1&to=${email}`;
                window.open(url, '_blank');
                break;
            case 'naver':
                // Naver Mail popup compose URL pattern
                url = `https://mail.naver.com/v2/new?to=${email}`;
                window.open(url, '_blank');
                break;
            case 'default':
                window.location.href = `mailto:${email}`;
                break;
        }
        setShowEmailOptions(false);
    };

    const renderHeader = () => {
        if (view === 'main') {
            return (
                <div className="flex justify-between items-center p-4 border-b border-white/10">
                    <h2 className="text-lg font-bold text-white flex items-center gap-2">
                        <MessageCircle size={20} className="text-primary" />
                        Customer Center
                        <button
                            onClick={() => {
                                navigate('/admin');
                                onClose();
                            }}
                            className="text-white opacity-5 hover:opacity-20 transition-opacity ml-2"
                        >
                            <Lock size={16} />
                        </button>
                    </h2>
                    <div className="flex items-center gap-4">
                        <button onClick={onClose} className="text-slate-400 hover:text-white">
                            <X size={24} />
                        </button>
                    </div>
                </div>
            );
        } else {
            return (
                <div className="flex justify-between items-center p-4 border-b border-white/10">
                    <button onClick={() => setView('main')} className="text-slate-400 hover:text-white flex items-center gap-1">
                        <ChevronLeft size={24} />
                        <span className="text-xs font-bold">Back</span>
                    </button>
                    <h2 className="text-lg font-bold text-white">
                        {view === 'terms' ? '이용약관' : view === 'privacy' ? '개인정보처리방침' : '환불정책'}
                    </h2>
                    <div className="w-6" /> {/* Spacer */}
                </div>
            );
        }
    };

    const renderContent = () => {
        if (view === 'main') {
            return (
                <div className="p-5 overflow-y-auto no-scrollbar pb-10 relative">
                    {/* Greeting & Hours */}
                    <div className="mb-6">
                        <h3 className="text-xl font-bold text-white mb-1">무엇을 도와드릴까요?</h3>
                        <p className="text-slate-400 text-sm mb-4">궁금한 점이나 불편한 점이 있으시다면 언제든 문의해주세요.</p>

                        <div className="bg-white/5 rounded-2xl p-4 border border-white/10 mb-4">
                            <div className="flex items-start gap-3 mb-2">
                                <Clock className="text-accent mt-0.5" size={16} />
                                <div>
                                    <p className="text-sm font-bold text-white">운영시간</p>
                                    <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                                        평일: 09:30 ~ 17:30<br />
                                        (점심시간: 12:30 ~ 13:30)<br />
                                        휴무일: 토요일, 일요일, 공휴일
                                    </p>
                                </div>
                            </div>
                        </div>

                        <button
                            onClick={() => setShowEmailOptions(true)}
                            className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-blue-900/20 transition-all"
                        >
                            문의하기 <Send size={18} />
                        </button>
                        <p className="text-[10px] text-slate-500 text-center mt-2 flex items-center justify-center gap-1">
                            <Clock size={10} /> 내일 오전 09:30부터 운영해요
                        </p>
                    </div>

                    {/* FAQ Categories */}
                    <div className="mb-8">
                        {/* <h4 className="text-xs font-bold text-slate-500 mb-3 uppercase tracking-wider">자주 찾는 질문</h4> */}
                        <div className="flex flex-wrap gap-2 mb-4">
                            {Object.keys(FAQ_DATA).map(category => (
                                <button
                                    key={category}
                                    onClick={() => {
                                        setSelectedCategory(category === selectedCategory ? null : category);
                                        setOpenFaqIndex(null);
                                    }}
                                    className={`px-4 py-2 text-xs font-bold rounded-full border transition-colors ${selectedCategory === category
                                        ? 'bg-slate-700 text-white border-slate-500'
                                        : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-white/5'
                                        }`}
                                >
                                    {category}
                                </button>
                            ))}
                        </div>

                        {/* FAQ List */}
                        <AnimatePresence>
                            {selectedCategory && (
                                <motion.div
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 'auto' }}
                                    exit={{ opacity: 0, height: 0 }}
                                    className="overflow-hidden"
                                >
                                    <div className="space-y-2">
                                        {FAQ_DATA[selectedCategory].map((item, idx) => (
                                            <div key={idx} className="bg-white/5 rounded-xl border border-white/5 overflow-hidden">
                                                <button
                                                    onClick={() => handleFaqToggle(idx)}
                                                    className="w-full flex justify-between items-center p-4 text-left hover:bg-white/5 transition-colors"
                                                >
                                                    <span className="text-sm text-slate-200 font-medium">Q. {item.q}</span>
                                                    {openFaqIndex === idx ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
                                                </button>
                                                <AnimatePresence>
                                                    {openFaqIndex === idx && (
                                                        <motion.div
                                                            initial={{ height: 0 }}
                                                            animate={{ height: 'auto' }}
                                                            exit={{ height: 0 }}
                                                            className="overflow-hidden"
                                                        >
                                                            <div className="p-4 pt-0 text-xs text-slate-400 leading-relaxed border-t border-white/5 mt-2 pt-3 whitespace-pre-line">
                                                                A. {item.a}
                                                            </div>
                                                        </motion.div>
                                                    )}
                                                </AnimatePresence>
                                            </div>
                                        ))}
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>

                    {/* Divider */}
                    <div className="w-full h-px bg-white/10 mb-6" />

                    {/* Detailed Business Info */}
                    <div className="text-[10px] text-slate-500 text-center space-y-1 leading-relaxed">
                        <h4 className="font-bold text-slate-400 mb-2">사업자 정보</h4>
                        <p>상호 : 유진에이아이(YujinAI) | 대표자명 : 정창우</p>
                        <p>사업자등록번호 : 519-77-00622 | 통신판매업 신고번호 : 제 2026-용인기흥-00211 호</p>
                        <p>사업장 주소 : 경기도 용인시 기흥구 동백8로 87</p>
                        <p>고객센터 : yujinit2005@gmail.com</p>
                        <p>개인정보관리책임자 : 정창우</p>
                        <p>연락처 : 010-6614-4561</p>
                    </div>

                    {/* Policy Links in Modal */}
                    <div className="flex justify-center gap-4 mt-6">
                        <button onClick={() => setView('terms')} className="text-xs text-slate-400 hover:text-white underline">이용약관</button>
                        <button onClick={() => setView('privacy')} className="text-xs text-slate-400 hover:text-white underline">개인정보처리방침</button>
                        <button onClick={() => setView('refund')} className="text-xs text-slate-400 hover:text-white underline">환불정책</button>
                    </div>

                    {/* Email Selection Modal Overlay */}
                    <AnimatePresence>
                        {showEmailOptions && (
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-6 z-20"
                                onClick={() => setShowEmailOptions(false)}
                            >
                                <motion.div
                                    initial={{ scale: 0.9, opacity: 0 }}
                                    animate={{ scale: 1, opacity: 1 }}
                                    exit={{ scale: 0.9, opacity: 0 }}
                                    className="bg-slate-900 border border-white/10 rounded-2xl p-6 w-full max-w-xs shadow-2xl"
                                    onClick={e => e.stopPropagation()}
                                >
                                    <h3 className="text-lg font-bold text-white text-center mb-6">메일 발송 방법 선택</h3>
                                    <div className="space-y-3">
                                        <button
                                            onClick={() => handleEmailSelect('gmail')}
                                            className="w-full bg-[#EA4335] hover:bg-[#d93025] text-white font-bold py-3 rounded-xl transition-colors shadow-lg shadow-red-900/20"
                                        >
                                            구글(Gmail)
                                        </button>
                                        <button
                                            onClick={() => handleEmailSelect('naver')}
                                            className="w-full bg-[#03C75A] hover:bg-[#02b351] text-white font-bold py-3 rounded-xl transition-colors shadow-lg shadow-green-900/20"
                                        >
                                            네이버 메일
                                        </button>
                                        <button
                                            onClick={() => handleEmailSelect('default')}
                                            className="w-full bg-slate-700 hover:bg-slate-600 text-white font-bold py-3 rounded-xl transition-colors border border-white/10"
                                        >
                                            기본 메일 앱
                                        </button>
                                        <div className="h-2" />
                                        <button
                                            onClick={() => setShowEmailOptions(false)}
                                            className="w-full bg-transparent hover:bg-white/5 text-slate-400 font-bold py-3 rounded-xl transition-colors border border-white/10"
                                        >
                                            취소
                                        </button>
                                    </div>
                                </motion.div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            );
        }

        // Policy Views (Actual Content)
        let content = '';
        if (view === 'terms') content = TERMS_CONTENT;
        if (view === 'privacy') content = PRIVACY_CONTENT;
        if (view === 'refund') content = REFUND_CONTENT;

        return (
            <div className="flex-1 overflow-y-auto p-0 bg-[#0b1220]">
                <div
                    dangerouslySetInnerHTML={{ __html: content }}
                    className="legal-content-container p-6 pb-20"
                    onClick={(e) => {
                        const target = e.target as HTMLElement;
                        if (target.dataset.action === 'view-refund') {
                            setView('refund');
                        }
                    }}
                />
            </div>
        );
    };

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-end sm:items-center justify-center sm:p-4"
                onClick={onClose}
            >
                <motion.div
                    initial={{ y: "100%" }}
                    animate={{ y: 0 }}
                    exit={{ y: "100%" }}
                    transition={{ type: "spring", damping: 25, stiffness: 300 }}
                    className="bg-slate-900 w-full max-w-md h-[85vh] sm:h-[800px] rounded-t-3xl sm:rounded-3xl border border-white/10 flex flex-col shadow-2xl overflow-hidden relative"
                    onClick={e => e.stopPropagation()}
                >
                    {renderHeader()}
                    <div className="flex-1 overflow-hidden flex flex-col">
                        {renderContent()}
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
}
