// Utility to slice and provide cropped images from 'MyReDesign_히스토리 데모이미지 시안_세로.jpg'

export interface DemoCardData {
    id: string;
    category: string;
    categoryName: string;
    title: string;
    dayProgress: string; // e.g. "3/7 day"
    dayCount: number;
    totalDays: number;
    photoLabel: string;
    photoSubText: string;
    cropStyle: {
        backgroundPosition: string;
        backgroundSize: string;
    };
    icon: string;
    color: string;
}

export const DEMO_SAMPLE_CARDS: DemoCardData[] = [
    {
        id: 'demo-card-3', // 3rd card shown first as requested
        category: 'mind_connection',
        categoryName: '라이프스타일',
        title: '미니멀 캠핑 요리 도전 - 샘플',
        dayProgress: '2/7 day',
        dayCount: 2,
        totalDays: 7,
        photoLabel: "[라이프스타일 3일차]",
        photoSubText: "휴대용 버너 미니멀 캠핑 요리",
        cropStyle: {
            backgroundPosition: '10% 92%',
            backgroundSize: '240% 230%'
        },
        icon: '🍳',
        color: 'emerald'
    },
    {
        id: 'demo-card-1',
        category: 'body_wellness',
        categoryName: '건강',
        title: '매일 아침 스트레칭 - 샘플',
        dayProgress: '3/7 day',
        dayCount: 3,
        totalDays: 7,
        photoLabel: "[건강 2일차]",
        photoSubText: "완벽한 자세 아침 스트레칭",
        cropStyle: {
            backgroundPosition: '10% 18%',
            backgroundSize: '240% 230%'
        },
        icon: '🧘',
        color: 'blue'
    },
    {
        id: 'demo-card-2',
        category: 'growth_career',
        categoryName: '자기계발',
        title: '1시간 독서 및 기록 - 샘플',
        dayProgress: '5/7 day',
        dayCount: 5,
        totalDays: 7,
        photoLabel: "[자기계발 1일차]",
        photoSubText: "핵심 개념 정리 독서 노트",
        cropStyle: {
            backgroundPosition: '90% 18%',
            backgroundSize: '240% 230%'
        },
        icon: '📖',
        color: 'green'
    },
    {
        id: 'demo-card-4',
        category: 'funplay',
        categoryName: '크리에이티브',
        title: '매일 한 장, 필름 사진 아카이브',
        dayProgress: '6/7 day',
        dayCount: 6,
        totalDays: 7,
        photoLabel: "[크리에이티브 1일차]",
        photoSubText: "자연의 패턴 크리에이티브 필름 기록",
        cropStyle: {
            backgroundPosition: '90% 92%',
            backgroundSize: '240% 230%'
        },
        icon: '📷',
        color: 'orange'
    }
];

// Helper to generate full sliced data URLs via Canvas for offline reliability
let cachedSlices: Record<number, string> = {};

export async function getDemoSlicedImage(index: number): Promise<string> {
    if (cachedSlices[index]) return cachedSlices[index];

    return new Promise((resolve) => {
        const img = new Image();
        img.src = '/MyReDesign_히스토리 데모이미지 시안_세로.jpg';
        img.crossOrigin = 'anonymous';

        img.onload = () => {
            try {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                if (!ctx) return resolve(img.src);

                const iw = img.naturalWidth || img.width;
                const ih = img.naturalHeight || img.height;

                // Coordinates for 4 cards in 2x2 grid
                // index 1: top-left (건강)
                // index 2: top-right (자기계발)
                // index 3: bottom-left (라이프스타일/캠핑요리)
                // index 4: bottom-right (크리에이티브)
                let sx = 0, sy = 0, sw = iw / 2, sh = ih / 2;

                if (index === 1) {
                    sx = iw * 0.10;
                    sy = ih * 0.10;
                    sw = iw * 0.38;
                    sh = ih * 0.40;
                } else if (index === 2) {
                    sx = iw * 0.52;
                    sy = ih * 0.10;
                    sw = iw * 0.38;
                    sh = ih * 0.40;
                } else if (index === 3) {
                    sx = iw * 0.10;
                    sy = ih * 0.54;
                    sw = iw * 0.38;
                    sh = ih * 0.40;
                } else if (index === 4) {
                    sx = iw * 0.52;
                    sy = ih * 0.54;
                    sw = iw * 0.38;
                    sh = ih * 0.40;
                }

                canvas.width = sw;
                canvas.height = sh;
                ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);

                const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
                cachedSlices[index] = dataUrl;
                resolve(dataUrl);
            } catch (err) {
                console.error('Canvas slice error:', err);
                resolve('/MyReDesign_히스토리 데모이미지 시안_세로.jpg');
            }
        };

        img.onerror = () => {
            resolve('/MyReDesign_히스토리 데모이미지 시안_세로.jpg');
        };
    });
}
